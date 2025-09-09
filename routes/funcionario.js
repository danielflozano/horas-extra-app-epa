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
 * /api/funcionarios/crearfuncionario:
 *   post:
 *     summary: Crear un nuevo funcionario
 *     tags: [Funcionarios]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nombre
 *               - identificacion
 *             properties:
 *               nombre:
 *                 type: string
 *                 description: Nombre completo del funcionario
 *                 example: "Juan Pérez"
 *               identificacion:
 *                 type: string
 *                 description: Documento de identificación
 *                 example: "12345678"
 *               cargo:
 *                 type: ObjectId
 *                 description: Cargo del funcionario
 *                 example: "Operario"
 *               Tipoe_Operario:
 *                 type: string
 *                 description: Departamento al que pertenece
 *                 example: "Planta o Temporal"
 *     responses:
 *       201:
 *         description: Funcionario creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/crearfuncionario', crearFuncionario);

/**
 * @swagger
 * /api/funcionarios:
 *   get:
 *     summary: Listar todos los funcionarios
 *     tags: [Funcionarios]
 *     responses:
 *       200:
 *         description: Lista de funcionarios obtenida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   nombre:
 *                     type: string
 *                   identificacion:
 *                     type: string
 *                   Cargo:
 *                     type: ObjectId
 *                   tipo_operario:
 *                     type: string
 */
router.get('/', listarFuncionarios);

router.put('/actualizar/:id', actualizarFuncionario);


router.get('/obtener/:id', obtenerFuncionarioPorId);


router.get('/Activos', listarFuncionariosActivos)


module.exports = router;
