/*
  Rutas de Usuarios / Auth
  host + /api/auth
*/

const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos')
const { crearUsuario, loginUsuario, revalidarToken } = require('../controllers/auth');
const { validarJWT } = require('../middlewares/validar-jwt');

const router = Router();


router.post (
  '/register',
  [ // middlewares
    check( 'name', 'El nombre es obligatorio' ).not().isEmpty()
      .matches(/^[a-zA-Z\s]+$/).withMessage('El nombre solo puede contener letras y espacios'),
    check( 'email', 'El correo es obligatorio' ).isEmail(),
    check( 'password', 'La contraseña debe tener al menos 8 caracteres' ).isLength({ min: 8 })
      .matches(/[A-Z]/).withMessage('La contraseña debe tener al menos una letra mayúscula')
      .matches(/[a-z]/).withMessage('La contraseña debe tener al menos una letra minúscula')
      .matches(/[0-9]/).withMessage('La contraseña debe tener al menos un número'),
    validarCampos
  ],
  crearUsuario
);

router.post (
  '/login',
  [ // middlewares
    check( 'email', 'El correo es obligatorio' ).isEmail(),
    check( 'password', 'El password es obligatorio' ).isLength({ min: 6 }),
    validarCampos
  ],
  loginUsuario
);

router.get (
  '/renew',
  [
    validarJWT
  ],
  revalidarToken
);

module.exports = router;