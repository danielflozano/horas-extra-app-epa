/*
  Rutas de Usuarios / Auth
  host + /api/auth
*/

const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos')
const { crearUsuario, loginUsuario, revalidarToken,resetPassword, solicitarReset,verificarCodigo,ActualizarDatos} = require('../controllers/auth');
const { validarJWT } = require('../middlewares/validar-jwt');
const {refreshToken}= require('../helpers/jwt')

const router = Router();


router.post (
  '/new',
  [ // middlewares
    check( 'name', 'El nombre es obligatorio' ).not().isEmpty(),
    check( 'email', 'El correo es obligatorio' ).isEmail(),
    check( 'password', 'El password debe de ser de 6 caracteres' ).isLength({ min: 6 }),
    validarCampos
  ],
  crearUsuario
);

router.post (
  '/',
  [ // middlewares
    check( 'email', 'El correo es obligatorio' ).isEmail(),
    check( 'password', 'El password debe de ser de 6 caracteres' ).isLength({ min: 6 }),
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

router.post('/reset', resetPassword);

router.post('/solicitud',solicitarReset);

router.post('/verificar', verificarCodigo);

router.post('/refresh', refreshToken)

router.put('/update', ActualizarDatos)

module.exports = router;