const express = require('express');
const router = express.Router();
const { crearExtras, eliminarExtras, updateExtra,listarExtras,
    listarExtrasPorFechas,listarExtrasPorIdentificacion,exportarExtrasExcel } = require('../controllers/Extras');

/**
 * @swagger
 * tags:
 *   name: Extras
 *   description: API para gestionar horas extras
 */

/**
 * @swagger
 * /api/extras:
 *   post:
 *     summary: Crear un registro de horas extras
 *     tags: [Extras]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               FuncionarioAsignado:
 *                 type: string
 *                 description: ID del funcionario
 *               fecha_inicio_trabajo:
 *                 type: string
 *                 format: date
 *               hora_inicio_trabajo:
 *                 type: string
 *                 example: "08:00"
 *               fecha_fin_trabajo:
 *                 type: string
 *                 format: date
 *               hora_fin_trabajo:
 *                 type: string
 *                 example: "18:00"
 *               hora_inicio_descanso:
 *                 type: string
 *                 example: "12:00"
 *               hora_fin_descanso:
 *                 type: string
 *                 example: "13:00"
 *     responses:
 *       201:
 *         description: Registro creado correctamente
 */
router.post('/crear', crearExtras);

/**
 * @swagger
 * /api/extras/{id}:
 *   delete:
 *     summary: Eliminar un registro de horas extras
 *     tags: [Extras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del registro
 *     responses:
 *       200:
 *         description: Eliminado correctamente
 *       404:
 *         description: No encontrado
 */
router.delete('/delete/:id', eliminarExtras);

/**
 * @swagger
 * /api/extras/{id}:
 *   put:
 *     summary: Actualizar un registro de horas extras
 *     tags: [Extras]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fecha_inicio_trabajo:
 *                 type: string
 *                 format: date
 *               hora_inicio_trabajo:
 *                 type: string
 *               fecha_fin_trabajo:
 *                 type: string
 *                 format: date
 *               hora_fin_trabajo:
 *                 type: string
 *     responses:
 *       200:
 *         description: Actualizado correctamente
 *       404:
 *         description: No encontrado
 */
router.put('/update/:id', updateExtra);

router.get('/listar',listarExtras)

router.get('/funcionario', listarExtrasPorIdentificacion);
router.get('/fechas', listarExtrasPorFechas);
router.get('/exportar', exportarExtrasExcel);


module.exports = router;
