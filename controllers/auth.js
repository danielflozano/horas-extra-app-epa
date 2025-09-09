const { response } = require('express');
const bcrypt = require('bcryptjs');
const Usuario = require('../models/Usuario');
const { generarJWT } = require('../helpers/jwt');

const crearUsuario = async( req, res = response ) => {
  const { email, password } = req.body;

  try {

    let usuario = await Usuario.findOne({ email });
    console.log(usuario);

    if (usuario) {
      return res.status(400).json({
        ok: false,
        msg: 'El correo ya esta registrado'
      });
    }
    
    usuario = new Usuario( req.body );

    // Encriptar contraseña
    const salt = await bcrypt.genSalt();
    usuario.password = await bcrypt.hash( password, salt );
  
    await usuario.save();

    // Generar JWT
    const token = await generarJWT( usuario.id, usuario.name );
  
    res.status(201).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      token
    })
    
  } catch (error) {
    console.log(error);    
    res.status(500).json ({
      ok: false,
      msg: 'Por favor hable con el administrador'
    });
  }

}

const loginUsuario = async( req, res = response ) => {

  const { email, password } = req.body

  try {

    const usuario = await Usuario.findOne({ email });
    // console.log(usuario);

    if ( !usuario ) {
      return res.status(400).json({
        ok: false,
        msg: 'Credenciales inválidas'
      });
    }
    
    // Confirmar los Passwords
    
    const validPassword = await bcrypt.compare( password, usuario.password );

    if( !validPassword ) {
      return res.status(400).json({
        ok: false,
        msg: 'Credenciales inválidas'
      })
    }

    // Generar JWT
    const token = await generarJWT( usuario.id, usuario.name );

    res.status(200).json({
      ok: true,
      uid: usuario.id,
      name: usuario.name,
      token
    })

  } catch (error) {
    console.log(error);    
    res.status(500).json ({
      ok: false,
      msg: 'Por favor hable con el administrador'
    });
  }


}

const revalidarToken = async( req, res = response ) => {

  const { uid, name } = req

  try {
    
    // Generar nuevo JWT y retornarlo en esta petición
    const token = await generarJWT( uid, name );
  
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

module.exports = {
  crearUsuario,
  loginUsuario,
  revalidarToken
}
