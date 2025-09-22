const { response } = require('express');
const jwt = require('jsonwebtoken');

const validarJWT = (req, res = response, next) => {
  let token = req.header('Authorization');

  // Verificamos que exista el header
  if (!token || !token.startsWith("Bearer ")) {
    return res.status(401).json({
      ok: false,
      msg: 'No hay token en la petición o formato incorrecto'
    });
  }

  // Extraemos el token después de "Bearer "
  token = token.slice(7).trim();

  try {
    const { uid, name, rol } = jwt.verify(token, process.env.SECRET_JWT_SEED);

    req.uid = uid;
    req.name = name;
    req.rol = rol;
    
    // console.log("JWT válido:", token);
  } catch (error) {
    console.log("JWT inválido:", token);
    return res.status(401).json({
      ok: false,
      msg: 'Token no válido'
    });
  }

  next();
};

module.exports = {
  validarJWT
};
