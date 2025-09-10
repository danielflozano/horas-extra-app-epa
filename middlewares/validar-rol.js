const Usuario = require('../models/Usuario')

const Admin = (req,res,next)=>{
    if (Usuario.rol !== 'Administrador') {
    return res.status(403).json({
      ok: false,
      msg: 'No tiene permisos para esta acción'
    });
  }
  next();
}

const SuperAdmin =  ( req,res, next) =>{
      if (req.rol !== 'SuperAdministrador') {
        console.log(req.rol);
        
    return res.status(403).json({
      ok: false,
      msg: 'No tiene permisos para esta acción'
    });
  }
  next();
}

const Nusuario = (req,res,next)=>{
     if (Usuario.rol !== 'Usuario') {
    return res.status(403).json({
      ok: false,
      msg: 'No tiene permisos para esta acción'
    });
  }
  next();
}

module.exports = {
  Admin,
  SuperAdmin,
  Nusuario
}