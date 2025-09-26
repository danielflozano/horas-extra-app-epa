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
  '/newUser', // TODO: Debo dejar esto !!!
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

/**q
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Cerrar la sesión de un usuario
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []   # <-- Se requiere access token en headers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshtoken
 *             properties:
 *               refreshtoken:
 *                 type: string
 *                 description: Token de refresco a invalidar.
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: Sesión cerrada exitosamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 msg:
 *                   type: string
 *                   example: "Sesión cerrada exitosamente."
 *       400:
 *         description: No se proporcionó el token de refresco.
 *       401:
 *         description: No autorizado (token de acceso inválido en headers).
 *       404:
 *         description: Token de refresco no encontrado o ya eliminado.
 *       500:
 *         description: Error en el servidor.
 */
router.post('/logout', logoutUsuario); // Eliminé el Middleware validarJWT


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
router.put('/update/:id', [validarJWT, SuperAdmin], ActualizarDatos);

/**
 * @swagger
 * /api/auth/solicitarReset:
 *   post:
 *     summary: Solicita un código de recuperación de contraseña
 *     description: Envía un código temporal al correo del usuario para permitir el reseteo de contraseña.
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@example.com
 *     responses:
 *       200:
 *         description: Código de recuperación enviado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 msg:
 *                   type: string
 *                   example: "Código enviado al correo."
 *       400:
 *         description: El correo no está registrado o no se pudo enviar el código
 *       500:
 *         description: Error en el servidor
 */
router.post('/solicitarReset' , check('email', 'El correo es obligatorio').isEmail(),solicitarReset);

/**
 * @swagger
 * /api/auth/verificarCodigo:
 *   post:
 *     summary: Verificar código de recuperación
 *     description: Valida el código de recuperación enviado al correo del usuario.
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - codigo
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@example.com
 *               codigo:
 *                 type: string
 *                 example: "367226"
 *     responses:
 *       200:
 *         description: Código válido, el usuario puede cambiar la contraseña.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 msg:
 *                   type: string
 *                   example: "Código válido, puede cambiar la contraseña."
 *       400:
 *         description: Código inválido o expirado.
 *       500:
 *         description: Error en el servidor.
 */
router.post('/verificarCodigo', verificarCodigo);


/**
 * @swagger
 * /api/auth/resetPassword:
 *   post:
 *     summary: Restablecer contraseña
 *     description: Permite al usuario establecer una nueva contraseña después de validar el código de recuperación.
 *     tags:
 *       - Autenticación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - confirmarPassword
 *               - nuevaPassword
 *             properties:
 *               confirmarPassword:
 *                 type: string
 *                 format: password
 *                 example: "NuevaClave123"
 *               nuevaPassword:
 *                 type: string
 *                 format: password
 *                 example: "NuevaClave123"
 *     responses:
 *       200:
 *         description: Contraseña restablecida correctamente.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 msg:
 *                   type: string
 *                   example: "Contraseña restablecida correctamente."
 *       400:
 *         description: El código no fue validado previamente o los datos son incorrectos.
 *       500:
 *         description: Error en el servidor.
 */
router.post(
  '/resetPassword',
  [
    check('nuevaPassword', 'La contraseña debe tener mínimo 6 caracteres').isLength({ min: 6 }),
    check('confirmarPassword', 'La confirmación debe tener mínimo 6 caracteres').isLength({ min: 6 }),
    validarCampos
  ],
  resetPassword
);




module.exports = router;
