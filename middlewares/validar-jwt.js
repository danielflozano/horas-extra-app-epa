
const { response } = require('express');
const jwt = require('jsonwebtoken');

const validarJWT = ( req, res = response, next ) => {

  // x-token (Headers)
  const token = req.header('x-token');

  if( !token ) {
    return res.status(401).json({
      ok: false,
      msg: 'No hay token en la petición'
    });
  }

  try {

    const { uid, name , rol } = jwt.verify(
      token,
      
      process.env.SECRET_JWT_SEED
    );

    req.uid = uid;
    req.name = name;
    req.rol = rol
    
     console.log(token);
  } catch (error) {
    console.log(token);
    return res.status(401).json({
      ok: false,
      msg: 'Token no valido'
    }
    
  );
    
  }

  next();
  

}

module.exports = {
  validarJWT
}