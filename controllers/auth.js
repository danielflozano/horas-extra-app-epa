const { response } = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); 
const Usuario = require('../models/Usuario');
const RefreshToken = require('../models/refreshToken'); 
const nodemailer = require('nodemailer');
const config = require('../config/config');

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


// --- FUNCIONES SIN CAMBIOS ---
const ActualizarDatos = async (req, res = response) => { /* ... tu código ... */ };
const solicitarReset = async (req, res) => { /* ... tu código ... */ };
const verificarCodigo = async (req, res) => { /* ... tu código ... */ };
const resetPassword = async (req, res) => { /* ... tu código ... */ };


module.exports = {
  crearUsuario,
  loginUsuario,
  logoutUsuario, // <-- NUEVO
  revalidarToken, // Lógica corregida
  ActualizarDatos,
  solicitarReset,
  verificarCodigo,
  resetPassword
};