const { response } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); 
const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/refreshToken'); 
const nodemailer = require('nodemailer');
const config = require('../config/config');
const { generarJWT } = require('../helpers/jwt');
const validator = require('validator');

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

const revalidarToken = async (req, res = response) => {
  const { refreshtoken } = req.body;
  if (!refreshtoken) {
    return res.status(400).json({ ok: false, msg: 'No se proporcionó token de refresco.' });
  }
  try {
  
    const refreshTokenDB = await RefreshToken.findOne({ token: refreshtoken });
    if (!refreshTokenDB) {
      return res.status(401).json({ ok: false, msg: 'Token de refresco no válido o sesión cerrada.' });
    }
    const { uid, name, rol } = jwt.verify(refreshtoken, process.env.JWT_SECRET);
    
    const nuevoTokenAcceso = await generarJWT(uid, name, rol, '15m');
    
    res.json({
      ok: true,
      token: nuevoTokenAcceso,
      uid, name, rol
    });

  } catch (error) {
    console.log(error);
    return res.status(401).json({ ok: false, msg: 'Token de refresco expirado o inválido.' });
  }
};


const ActualizarDatos = async (req, res = response) => {

  const { id } = req.params;
  
  const updateData = req.body;

  try {
    delete updateData.password;
    
  
    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      id,          
      updateData, 
      {            
        new: true, 
        runValidators: true 
      }
    );

    if (!usuarioActualizado) {
      return res.status(404).json({
        ok: false,
        msg: 'Usuario a actualizar no encontrado'
      });
    }

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
    // 1) Campo presente
    if (!email) {
      return res.status(400).json({
        ok: false,
        msg: "Debes ingresar un correo electrónico."
      });
    }

    // 2) Normalizar y trim
    const emailNormalized = String(email).trim().toLowerCase();

    // 3) Validar formato
    if (!validator.isEmail(emailNormalized)) {
      return res.status(400).json({
        ok: false,
        msg: "Formato de correo inválido. Debe ser algo@dominio.com"
      });
    }

    // 4) Buscar usuario (asegúrate de guardar los emails en minúsculas en tu BD)
    const usuario = await Usuario.findOne({ email: emailNormalized });

    if (!usuario) {
      return res.status(404).json({
        ok: false,
        msg: "El correo ingresado no está registrado en el sistema."
      });
    }

    // 5) Generar y guardar código
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    usuario.resetCode = resetCode;
    usuario.resetCodeExpires = Date.now() + 10 * 60 * 1000; // 10 minutos
    await usuario.save();

    // 6) Enviar correo
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: config.emailUser, pass: config.emailPass }
    });

    await transporter.sendMail({
      from: `"Soporte App" <${config.emailUser}>`,
      to: emailNormalized,
      subject: "Recuperación de contraseña",
      html: `
        <p>Hola ${usuario.name},</p>
        <p>Tu código de recuperación es:</p>
        <h2>${resetCode}</h2>
        <p>Este código vence en 10 minutos.</p>
      `
    });

    return res.json({ ok: true, msg: "Se ha enviado un código de verificación a su correo." });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ ok: false, msg: "Error en el servidor." });
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
    const { email, nuevaPassword, confirmarPassword } = req.body;

    try {
      if (nuevaPassword !== confirmarPassword) {
        return res.status(400).json({
          ok: false,
          msg: "Las contraseñas no coinciden."
        });
      }

      // Buscar usuario que tenga resetVerified = true
      const usuario = await Usuario.findOne({email, resetVerified: true });

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