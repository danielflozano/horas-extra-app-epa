const express = require('express');
const router = express.Router();
const { crearFuncionario, listarFuncionarios, actualizarFuncionario,obtenerFuncionarioPorId, listarFuncionariosActivos} = require('../controllers/Funcionario');

/**
 * @swagger
 * tags:
 *   name: Funcionarios
 *   description: API para gestionar funcionarios
 */

/**
 * @swagger
 * /api/funcionario/crearfuncionario:
 *   post:
 *     summary: Crear un nuevo Funcionario
 *     tags: [Funcionarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre_completo
 *               - identificacion
 *               - tipoOperario
 *               - Cargo
 *             properties:
 *               nombre_completo:
 *                 type: string
 *                 example: "Juan Pérez"
 *               identificacion:
 *                 type: string
 *                 example: "12345678"
 *               tipoOperario:
 *                 type: string
 *                 enum: [Planta, Temporal]
 *                 example: "Planta"
 *               Cargo:
 *                 type: string
 *                 description: ID del Cargo
 *                 example: "68ae1d9d64efaf7672e3df1a"
 *               estado:
 *                 type: string
 *                 enum: [Activo, Inactivo]
 *                 example: "Activo"
 *     responses:
 *       201:
 *         description: Funcionario creado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68b36c9011aa5f09789b64b0"
 *                     nombre_completo:
 *                       type: string
 *                       example: "Juan Pérez"
 *                     identificacion:
 *                       type: string
 *                       example: "12345678"
 *                     tipoOperario:
 *                       type: string
 *                       enum: [Planta, Temporal]
 *                       example: "Planta"
 *                     Cargo:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "68ae1d9d64efaf7672e3df1a"
 *                         name:
 *                           type: string
 *                           example: "Conductor"
 *                         __v:
 *                           type: number
 *                           example: 0
 *                     estado:
 *                       type: string
 *                       enum: [Activo, Inactivo]
 *                       example: "Activo"
 *                     __v:
 *                       type: number
 *                       example: 0
 *       400:
 *         description: Datos inválidos o identificación duplicada
*/
router.post('/crearfuncionario', crearFuncionario);

/**
 * @swagger
 * /api/funcionario/:
 *   get:
 *     summary: Listar todos los Funcionarios
 *     tags: [Funcionarios]
 *     responses:
 *       200:
 *         description: Lista de Funcionarios con detalles de Cargo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "68ae229c83b8483d7dfb2a84"
 *                       nombre_completo:
 *                         type: string
 *                         example: "JARAMILLO CARDONA JHON JAIRO"
 *                       identificacion:
 *                         type: string
 *                         example: "7552562"
 *                       tipoOperario:
 *                         type: string
 *                         enum: [Planta, Temporal]
 *                         example: "Planta"
 *                       Cargo:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "68ae1d9d64efaf7672e3df1a"
 *                           name:
 *                             type: string
 *                             example: "Conductor"
 *                       estado:
 *                         type: string
 *                         enum: [Activo, Inactivo]
 *                         example: "Activo"
 *                       __v:
 *                         type: number
 *                         example: 0

*/
router.get('/', listarFuncionarios);

/**
 * @swagger
 * /api/funcionario/actualizar/{id}:
 *   put:
 *     summary: Actualizar un Funcionario por ID
 *     tags: [Funcionarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del Funcionario a actualizar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_completo:
 *                 type: string
 *                 example: "JARAMILLO CARDONA JHON JAIRO"
 *               identificacion:
 *                 type: string
 *                 example: "7552562"
 *               tipoOperario:
 *                 type: string
 *                 enum: [Planta, Temporal]
 *                 example: "Planta"
 *               Cargo:
 *                 type: string
 *                 description: ID del Cargo
 *                 example: "68ae1d9d64efaf7672e3df1a"
 *               estado:
 *                 type: string
 *                 enum: [Activo, Inactivo]
 *                 example: "Activo"
 *     responses:
 *       200:
 *         description: Funcionario actualizado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68ae229c83b8483d7dfb2a84"
 *                     nombre_completo:
 *                       type: string
 *                       example: "JARAMILLO CARDONA JHON JAIRO"
 *                     identificacion:
 *                       type: string
 *                       example: "7552562"
 *                     tipoOperario:
 *                       type: string
 *                       enum: [Planta, Temporal]
 *                       example: "Planta"
 *                     Cargo:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "68ae1d9d64efaf7672e3df1a"
 *                         name:
 *                           type: string
 *                           example: "Conductor"
 *                         __v:
 *                           type: number
 *                           example: 0
 *                     estado:
 *                       type: string
 *                       enum: [Activo, Inactivo]
 *                       example: "Activo"
 *                     __v:
 *                       type: number
 *                       example: 0
 *       404:
 *         description: Funcionario no encontrado
 */
router.put('/actualizar/:id' ,actualizarFuncionario);

/**
 * @swagger
 * /api/funcionario/obtener/{id}:
 *   get:
 *     summary: Obtener un Funcionario por ID
 *     tags: [Funcionarios]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del Funcionario
 *     responses:
 *       200:
 *         description: Funcionario encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       example: "68ae229c83b8483d7dfb2a84"
 *                     nombre_completo:
 *                       type: string
 *                       example: "JARAMILLO CARDONA JHON JAIRO"
 *                     identificacion:
 *                       type: string
 *                       example: "7552562"
 *                     tipoOperario:
 *                       type: string
 *                       enum: [Planta, Temporal]
 *                       example: "Planta"
 *                     Cargo:
 *                       type: object
 *                       properties:
 *                         _id:
 *                           type: string
 *                           example: "68ae1d9d64efaf7672e3df1a"
 *                         name:
 *                           type: string
 *                           example: "Conductor"
 *                         __v:
 *                           type: number
 *                           example: 0
 *                     estado:
 *                       type: string
 *                       enum: [Activo, Inactivo]
 *                       example: "Activo"
 *                     __v:
 *                       type: number
 *                       example: 0
 *       404:
 *         description: Funcionario no encontrado
*/
router.get('/obtener/:identificacion', obtenerFuncionarioPorId);

/**
 * @swagger
 * /api/funcionario/activos:
 *   get:
 *     summary: Listar todos los Funcionarios activos
 *     tags: [Funcionarios]
 *     responses:
 *       200:
 *         description: Lista de Funcionarios activos con detalles de Cargo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: "68ae229c83b8483d7dfb2a84"
 *                       nombre_completo:
 *                         type: string
 *                         example: "JARAMILLO CARDONA JHON JAIRO"
 *                       identificacion:
 *                         type: string
 *                         example: "7552562"
 *                       tipoOperario:
 *                         type: string
 *                         enum: [Planta, Temporal]
 *                         example: "Planta"
 *                       Cargo:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                             example: "68ae1d9d64efaf7672e3df1a"
 *                           name:
 *                             type: string
 *                             example: "Conductor"
 *                       estado:
 *                         type: string
 *                         enum: [Activo, Inactivo]
 *                         example: "Activo"
 */

router.get('/activos', listarFuncionariosActivos)


module.exports = router;
