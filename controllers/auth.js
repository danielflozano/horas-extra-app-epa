const { response } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); 
const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/refreshToken'); 
const nodemailer = require('nodemailer');
const config = require('../config/config');
const { generarJWT } = require('../helpers/jwt');

// --- FUNCIÓN SIN CAMBIOS ---
const crearUsuario = async (req, res = response) => {
  const { name, email, password, rol } = req.body;
  try {
    let usuario = await Usuario.findOne({ email });
    if (usuario) {
      return res.status(400).json({ ok: false, msg: 'El correo ya está registrado' });
    }
    usuario = new Usuario({ name, email, password, rol: rol || 'Usuario' });
    const salt = await bcrypt.genSalt();
    usuario.password = await bcrypt.hash(password, salt);
    await usuario.save();
    
    // Al crear, generamos tokens igual que en el login
    const token = await generarJWT(usuario.id, usuario.name, usuario.rol, '15m');
    const refreshtoken = await generarJWT(usuario.id, usuario.name, usuario.rol, '7d');
    
    // Guardamos el refresh token
    const nuevoRefreshToken = new RefreshToken({
      token: refreshtoken,
      user: usuario.id,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    await nuevoRefreshToken.save();

    res.status(201).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      rol: usuario.rol,
      token,
      refreshtoken
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: 'Por favor hable con el administrador' });
  }
};


// --- FUNCIÓN MODIFICADA ---
const loginUsuario = async (req, res = response) => {
  const { email, password } = req.body;
  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(400).json({ ok: false, msg: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, usuario.password);
    if (!validPassword) {
      return res.status(400).json({ ok: false, msg: 'Credenciales inválidas' });
    }

    // Generar tokens
    const token = await generarJWT(usuario.id, usuario.name, usuario.rol, '15m');
    const refreshtoken = await generarJWT(usuario.id, usuario.name, usuario.rol, '7d');

    // --- LÓGICA MODIFICADA ---
    // 1. Borrar cualquier refresh token antiguo que el usuario pueda tener
    await RefreshToken.deleteMany({ user: usuario.id });
    // 2. Guardar el nuevo refresh token en la base de datos
    const nuevoRefreshToken = new RefreshToken({
      token: refreshtoken,
      user: usuario.id,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días desde ahora
    });
    await nuevoRefreshToken.save();
    // --- FIN DE LA LÓGICA MODIFICADA ---

    res.status(200).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      rol: usuario.rol,
      token,
      refreshtoken
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: 'Por favor hable con el administrador' });
  }
};
// --- NUEVA FUNCIÓN ---
const logoutUsuario = async (req, res = response) => {
  const { refreshtoken } = req.body;
  if (!refreshtoken) {
    return res.status(400).json({ ok: false, msg: 'No se proporcionó el token de refresco.' });
  }
  try {
    // Busca y elimina el token de la base de datos
    await RefreshToken.findOneAndDelete({ token: refreshtoken });
    res.status(200).json({ ok: true, msg: 'Sesión cerrada exitosamente.' });
  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: 'Error en el servidor' });
  }
};


// --- FUNCIÓN REVALIDARTOKEN REEMPLAZADA Y CORREGIDA ---
const revalidarToken = async (req, res = response) => {
  const { refreshtoken } = req.body;
  if (!refreshtoken) {
    return res.status(400).json({ ok: false, msg: 'No se proporcionó token de refresco.' });
  }
  try {
    // 1. Verificar si el token de refresco está en nuestra base de datos
    const refreshTokenDB = await RefreshToken.findOne({ token: refreshtoken });
    if (!refreshTokenDB) {
      return res.status(401).json({ ok: false, msg: 'Token de refresco no válido o sesión cerrada.' });
    }

    // 2. Verificar la firma del token para obtener los datos del usuario
    // (Asumo que tu helper `generarJWT` no verifica, si lo hace, necesitarás un `verificarJWT`)
    const { uid, name, rol } = jwt.verify(refreshtoken, process.env.JWT_SECRET);
    
    // 3. Generar un nuevo token de acceso de corta duración
    const nuevoTokenAcceso = await generarJWT(uid, name, rol, '15m');
    
    res.json({
      ok: true,
      token: nuevoTokenAcceso,
      uid, name, rol
    });

  } catch (error) {
    // Esto generalmente ocurre si el token ha expirado
    console.log(error);
    return res.status(401).json({ ok: false, msg: 'Token de refresco expirado o inválido.' });
  }
};


const ActualizarDatos = async (req, res = response) => {
  // El middleware 'SuperAdmin' ya verificó los permisos.
  // Solo necesitamos el ID del usuario a modificar desde la URL.
  const { id } = req.params;
  
  // Y los datos a actualizar desde el cuerpo de la petición.
  const updateData = req.body;

  try {
    // Es una buena práctica evitar que un admin cambie la contraseña 
    // o el rol de un usuario accidentalmente desde una ruta de "actualización general".
    // Si quieres actualizar esos campos, es mejor tener rutas específicas.
    delete updateData.password;
    
    // Ejecutamos la actualización en un solo paso con los datos correctos.
    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      id,          // 1. El ID del usuario a actualizar
      updateData,  // 2. El objeto con los datos que se van a cambiar
      {            // 3. Opciones
        new: true, // Devuelve el documento ya actualizado
        runValidators: true // Ejecuta las validaciones del Schema
      }
    );

    // Si no se encontró un usuario con ese ID en la base de datos
    if (!usuarioActualizado) {
      return res.status(404).json({
        ok: false,
        msg: 'Usuario a actualizar no encontrado'
      });
    }

    // La actualización fue exitosa
    res.json({
      ok: true,
      msg: 'Usuario actualizado correctamente por el administrador',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar los datos. Contacte al administrador.'
    });
  }
};

const solicitarReset = async (req, res) => {
  const { email } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(200).json({
        ok: true,
        msg: "Si el correo existe, se enviará un código de verificación."
      });
    }

    // Generar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    usuario.resetCode = resetCode;
    usuario.resetCodeExpires = Date.now() + 10 * 60 * 1000; // expira en 10 min
    await usuario.save();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config.emailUser,
        pass: config.emailPass
      }
    });

    await transporter.sendMail({
      from: `"Soporte App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Recuperación de contraseña",
      html: `
    <p>Hola ${usuario.name},</p>
    <p>Tu código de recuperación es:</p>
    <h2>${resetCode}</h2>
    <p>Este código vence en 10 minutos.</p>
  `
    });

    res.json({
      ok: true,
      msg: "Se ha enviado un código de verificación a su correo."
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: "Error en el servidor" });
  }
};
const verificarCodigo = async (req, res) => {
  const { email, codigo } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario || usuario.resetCode !== codigo || usuario.resetCodeExpires < Date.now()) {
      return res.status(400).json({
        ok: false,
        msg: "Código inválido o expirado."
      });
    }

    // Marcar como verificado
    usuario.resetVerified = true;
    await usuario.save();

    res.json({
      ok: true,
      msg: "Código válido, puede cambiar la contraseña."
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: "Error en el servidor" });
  }
};


const resetPassword = async (req, res) => {
  const { nuevaPassword, confirmarPassword } = req.body;

  try {
    if (nuevaPassword !== confirmarPassword) {
      return res.status(400).json({
        ok: false,
        msg: "Las contraseñas no coinciden."
      });
    }

    // Buscar usuario que tenga resetVerified = true
    const usuario = await Usuario.findOne({ resetVerified: true });

    if (!usuario) {
      return res.status(400).json({
        ok: false,
        msg: "No hay un proceso de recuperación activo."
      });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt();
    usuario.password = await bcrypt.hash(nuevaPassword, salt);

    // Limpiar datos de recuperación
    usuario.resetCode = undefined;
    usuario.resetCodeExpires = undefined;
    usuario.resetVerified = false;

    await usuario.save();

    res.json({
      ok: true,
      msg: "Contraseña restablecida correctamente."
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ ok: false, msg: "Error en el servidor" });
  }
};


module.exports = {
  crearUsuario,
  loginUsuario,
  logoutUsuario, 
  revalidarToken, 
  ActualizarDatos,
  solicitarReset,
  verificarCodigo,
  resetPassword
};