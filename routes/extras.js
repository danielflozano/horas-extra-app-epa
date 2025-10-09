const express = require('express');
const router = express.Router();
const { crearExtras, eliminarExtras, updateExtra,listarExtras,
    listarExtrasPorFechas,listarExtrasPorIdentificacion,exportarExtrasExcel } = require('../controllers/Extras');
const { validarJWT } = require('../middlewares/validar-jwt');
const {importarExcel,obtenerNombresDeHojas} = require('../controllers/exportar');
const multer = require("multer");

/**
 * @swagger
 * tags:
 *   name: Extras
 *   description: API para gestionar horas extras
 */

/**
 * @swagger
 * /api/extras/crear:
 *   post:
 *     summary: Crear un registro de horas extras
 *     tags: [Extras]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - FuncionarioAsignado
 *               - fecha_inicio_trabajo
 *               - fecha_fin_trabajo
 *               - hora_inicio_trabajo
 *               - hora_fin_trabajo
 *             properties:
 *               FuncionarioAsignado:
 *                 type: string
 *                 description: ID del funcionario (ObjectId)
 *                 example: "64d5f5a2b3c4a1e7f89c1234"
 *               fecha_inicio_trabajo:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               fecha_fin_trabajo:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               hora_inicio_trabajo:
 *                 type: string
 *                 example: "08:00"
 *               hora_fin_trabajo:
 *                 type: string
 *                 example: "18:00"
 *               fecha_inicio_descanso:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               fecha_fin_descanso:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               hora_inicio_descanso:
 *                 type: string
 *                 example: "12:00"
 *               hora_fin_descanso:
 *                 type: string
 *                 example: "13:00"
 *               horas_trabajadas:
 *                 type: string
 *                 example: "08:00"
 *               horas_descanso:
 *                 type: string
 *                 example: "01:00"
 *               es_festivo_Inicio:
 *                 type: boolean
 *                 example: false
 *               es_festivo_Fin:
 *                 type: boolean
 *                 example: false
 *     responses:
 *       201:
 *         description: Registro creado correctamente
 *       400:
 *         description: Datos inválidos
 */

router.post('/crear', crearExtras);

/**
 * @swagger
 * /api/extras/delete/{id}:
 *   delete:
 *     summary: Eliminar un registro de horas extras
 *     tags: [Extras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del registro a eliminar
 *     responses:
 *       200:
 *         description: Eliminado correctamente
 *       404:
 *         description: Registro no encontrado
 */

router.delete('/delete/:id',validarJWT, eliminarExtras);

/**
 * @swagger
 * /api/extras/update/{id}:
 *   put:
 *     summary: Actualizar un registro de horas extras
 *     tags: [Extras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del registro a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha_inicio_trabajo:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               hora_inicio_trabajo:
 *                 type: string
 *                 example: "08:00"
 *               fecha_fin_trabajo:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-01"
 *               hora_fin_trabajo:
 *                 type: string
 *                 example: "18:00"
 *     responses:
 *       200:
 *         description: Actualizado correctamente
 *       404:
 *         description: Registro no encontrado
 */

router.put('/update/:id', updateExtra);

/**
 * @swagger
 * /api/extras/listar:
 *   get:
 *     summary: Listar todos los registros de horas extras
 *     tags: [Extras]
 *     responses:
 *       200:
 *         description: Lista de registros obtenida correctamente
 */

router.get('/listar',listarExtras)

/**
 * @swagger
 * /api/extras/funcionario:
 *   get:
 *     summary: Listar horas extras por identificación del funcionario
 *     tags: [Extras]
 *     parameters:
 *       - in: query
 *         name: identificacion
 *         required: true
 *         schema:
 *           type: string
 *         description: Identificación del funcionario
 *         example: "12345678"
 *     responses:
 *       200:
 *         description: Lista filtrada por identificación
 *       404:
 *         description: No se encontraron registros
 */

router.get('/funcionario/:identificacion', listarExtrasPorIdentificacion); 
/**
 * @swagger
 * /api/extras/fechas:
 *   get:
 *     summary: Listar horas extras por rango de fechas
 *     tags: [Extras]
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-08-01"
 *       - in: query
 *         name: fecha_fin
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-08-31"
 *     responses:
 *       200:
 *         description: Lista filtrada por rango de fechas
 *       404:
 *         description: No se encontraron registros
 */

router.get('/fechas', listarExtrasPorFechas);

/**
 * @swagger
 * /api/extras/exportar:
 *   get:
 *     summary: Exportar registros de horas extras a Excel
 *     tags: [Extras]
 *     parameters:
 *       - in: query
 *         name: fecha_inicio
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-08-01"
 *       - in: query
 *         name: fecha_fin
 *         required: false
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-08-31"
 *     responses:
 *       200:
 *         description: Archivo Excel generado
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */

router.get('/exportar', exportarExtrasExcel);


/**
 * @swagger
 * /api/extras/sheets:
 *   post:
 *     summary: Obtiene los nombres de las hojas de un archivo Excel subido
 *     tags:
 *       - Importar Extras
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo Excel a procesar
 *     responses:
 *       200:
 *         description: Lista de nombres de hojas en el Excel
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 sheetNames:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Error por archivo faltante o inválido
 *       500:
 *         description: Error interno al procesar el Excel
 */
const upload = multer({ storage: multer.memoryStorage() });
router.post(
    "/sheets", 
    upload.single("file"), 
    obtenerNombresDeHojas
);

/**
 * @swagger
 * /api/extras/importar:
 *   post:
 *     summary: Importa un archivo Excel con los datos de funcionarios y horas extras
 *     tags:
 *       - Importar Extras
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Archivo Excel a procesar
 *               nombreHoja:
 *                 type: string
 *                 description: Nombre de la hoja específica a procesar (opcional)
 *     responses:
 *       200:
 *         description: Importación finalizada correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 resumen:
 *                   type: object
 *                   properties:
 *                     registrosGuardados:
 *                       type: integer
 *                     registrosFallidos:
 *                       type: integer
 *                     funcionariosCreados:
 *                       type: integer
 *                     cargosCreados:
 *                       type: integer
 *                     errores:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         description: Error por archivo faltante o datos inválidos
 *       500:
 *         description: Error interno al procesar el archivo
 */
router.post(
    "/importar", 
    upload.single("file"), 
    importarExcel
);

module.exports = router;
