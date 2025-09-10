const { response } = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { generarJWT } = require('../helpers/jwt');
const nodemailer = require('nodemailer');
const config = require('../config/config');

const crearUsuario = async (req, res = response) => {
  const { name, email, password, rol } = req.body;

  try {
    // Verificar si el correo ya existe
    let usuario = await Usuario.findOne({ email });
    if (usuario) {
      return res.status(400).json({
        ok: false,
        msg: 'El correo ya está registrado'
      });
    }

    // Crear instancia del usuario
    usuario = new Usuario({
      name,
      email,
      password,
      rol: rol || 'Usuario'
    });

    // Encriptar contraseña
    const salt = await bcrypt.genSalt();
    usuario.password = await bcrypt.hash(password, salt);

    // Guardar en BD
    await usuario.save();

    // Generar JWT
    const token = await generarJWT(usuario.id, usuario.name);
    const RefresToken = await generarJWT(usuario.id,usuario.name)
    res.status(201).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      rol: usuario.rol,
      token
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: 'Por favor hable con el administrador'
    });
  }
};

const loginUsuario = async (req, res = response) => {

  const { email, password } = req.body

  try {

    const usuario = await Usuario.findOne({ email });
    // console.log(usuario);

    if (!usuario) {
      return res.status(400).json({
        ok: false,
        msg: 'Credenciales inválidas'
      });
    }

    // Confirmar los Passwords

    const validPassword = await bcrypt.compare(password, usuario.password);

    if (!validPassword) {
      return res.status(400).json({
        ok: false,
        msg: 'Credenciales inválidas'
      })
    }

    // Generar JWT
    const token = await generarJWT(usuario.id,usuario.name,process.env.SECRET_JWT_SEED,'15m');
    const Refreshtoken = await generarJWT(usuario.id, usuario.name, process.env.REFRESH_JWT_SEED,'7d');

    res.status(200).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      token,
      Refreshtoken
    })

  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: 'Por favor hable con el administrador'
    });
  }


}

const revalidarToken = async (req, res = response) => {

  const { uid, name } = req

  try {

    // Generar nuevo JWT y retornarlo en esta petición
    const token = await generarJWT(uid, name);

    res.json({
      ok: true,
      uid: uid,
      name: name,
      token: token
    });

  } catch (error) {
    console.log(error);
    res.status(400).json({
      ok: false,
      msg: 'No se pudo renovar el token'
    })

  }

}

const ActualizarDatos = async (req, res = response) => {
  const { uid } = req;
  const { userId, updateData } = req.body;

  try {
    // Verificar si quien hace la petición es SuperAdministrador
    const usuarioAuth = await Usuario.findById(uid);

    if (!usuarioAuth) {
      return res.status(404).json({
        ok: false,
        msg: 'Usuario autenticado no encontrado'
      });
    }

    if (usuarioAuth.rol !== 'SuperAdministrador') {
      return res.status(403).json({
        ok: false,
        msg: 'No tiene permisos para actualizar datos'
      });
    }

    const usuarioActualizado = await Usuario.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!usuarioActualizado) {
      return res.status(404).json({
        ok: false,
        msg: 'Usuario a actualizar no encontrado'
      });
    }

    res.json({
      ok: true,
      msg: 'Usuario actualizado correctamente',
      usuario: usuarioActualizado
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({
      ok: false,
      msg: 'Error al actualizar datos, hable con el administrador'
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
  const { email, codigo, nuevaPassword } = req.body;

  try {
    const usuario = await Usuario.findOne({ email });

    if (!usuario || usuario.resetCode !== codigo || usuario.resetCodeExpires < Date.now()) {
      return res.status(400).json({
        ok: false,
        msg: "Código inválido o expirado."
      });
    }

    // Encriptar nueva contraseña
    const salt = await bcrypt.genSalt();
    usuario.password = await bcrypt.hash(nuevaPassword, salt);

    // Limpiar código
    usuario.resetCode = undefined;
    usuario.resetCodeExpires = undefined;

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
  revalidarToken,
  ActualizarDatos,
  solicitarReset,
  verificarCodigo,
  resetPassword
}