const express = require('express');
const router = express.Router();
const { crearCargo, listarCargos ,eliminarCargo} = require('../controllers/Cargo');

/**
 * @swagger
 * tags:
 *   name: Cargos
 *   description: API para gestionar cargos
 */

/**
 * @swagger
 * /api/cargos/crearCargo:
 *   post:
 *     summary: Crear un nuevo cargo
 *     tags: [Cargos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nombre del cargo
 *     
 *     responses:
 *       201:
 *         description: Cargo creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/crearCargo', crearCargo);

/**
 * @swagger
 * /api/cargos/listar:
 *   get:
 *     summary: Listar todos los cargos
 *     tags: [Cargos]
 *     responses:
 *       200:
 *         description: Lista de cargos obtenida correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "64d5f5a2b3c4a1e7f89c9876"
 *                   name:
 *                     type: string
 *                     example: "Operario"
 *             
 */
router.get('/listar', listarCargos);


router.delete('/delete/:id', eliminarCargo)

module.exports = router;
