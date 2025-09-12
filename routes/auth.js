const { Router } = require('express');
const { check } = require('express-validator');
const { validarCampos } = require('../middlewares/validar-campos');
const { SuperAdmin } = require('../middlewares/validar-rol');
const { validarJWT } = require('../middlewares/validar-jwt');
const {
  crearUsuario,
  loginUsuario,
  revalidarToken,
  logoutUsuario,
  resetPassword,
  solicitarReset,
  verificarCodigo,
  ActualizarDatos
} = require('../controllers/auth');

const router = Router();

/**
 * @swagger
 * /api/auth/new:
 *   post:
 *     summary: Crear un nuevo usuario (solo SuperAdmin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               rol:
 *                 type: string
 *                 description: "Rol del usuario (opcional, por defecto 'Usuario')"
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente.
 *       400:
 *         description: Datos inválidos o el correo ya existe.
 *       401:
 *         description: No autorizado (token inválido o no proporcionado).
 *       403:
 *         description: Acceso denegado (no es SuperAdmin).
 */
router.post(
  '/new',
  [
    validarJWT,
    SuperAdmin,
    check('name', 'El nombre es obligatorio').not().isEmpty(),
    check('email', 'El correo es obligatorio').isEmail(),
    check('password', 'El password debe de ser de 6 caracteres').isLength({ min: 6 }),
    validarCampos
  ],
  crearUsuario
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesión de un usuario
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login exitoso, devuelve información del usuario y tokens.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 uid:
 *                   type: string
 *                 name:
 *                   type: string
 *                 rol:
 *                   type: string
 *                 token:
 *                   type: string
 *                 refreshtoken:
 *                   type: string
 *       400:
 *         description: Credenciales inválidas.
 */
router.post(
  '/login',
  [
    check('email', 'El correo es obligatorio').isEmail(),
    check('password', 'El password debe de ser de 6 caracteres').isLength({ min: 6 }),
    validarCampos
  ],
  loginUsuario
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar la sesión de un usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshtoken]
 *             properties:
 *               refreshtoken:
 *                 type: string
 *                 description: "El token de refresco del usuario para invalidarlo."
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente.
 *       401:
 *         description: No autorizado (token de acceso inválido).
 */
router.post('/logout', validarJWT, logoutUsuario);

/**
 * @swagger
 * /api/auth/renew:
 *   post:
 *     summary: Renovar un token de acceso
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshtoken]
 *             properties:
 *               refreshtoken:
 *                 type: string
 *                 description: "El token de refresco válido para generar un nuevo token de acceso."
 *     responses:
 *       200:
 *         description: Devuelve un nuevo token de acceso.
 *       401:
 *         description: Token de refresco inválido o expirado.
 */
router.post('/renew', revalidarToken);

/**
 * @swagger
 * /api/auth/update:
 *   put:
 *     summary: Actualizar datos de un usuario (solo SuperAdmin)
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Datos necesarios para actualizar un usuario.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: "El ID del usuario que se va a actualizar."
 *                 example: "68c41f68d6687103fc19c226"
 *               updateData:
 *                 type: object
 *                 description: "Objeto con los campos a actualizar."
 *                 example:
 *                   name: "Nuevo Nombre"
 *     responses:
 *       200:
 *         description: Usuario actualizado correctamente.
 *       401:
 *         description: No autorizado (token inválido).
 */
router.put('/update', [validarJWT, SuperAdmin], ActualizarDatos);

module.exports = router;
