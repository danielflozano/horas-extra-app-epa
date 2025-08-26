const express = require('express');
const router = express.Router();
const { crearExtras,eliminarExtras,updateExtra } = require('../controllers/Extras');

// Rutas
/**
 * @swagger
 * /extras/crear:
 *   post:
 *     summary: Crear hora extra
 *     tags: [Extras]
 *     description: Crea un nuevo registro de horas extra.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_completo:
 *                 type: string
 *               identificacion:
 *                 type: string
 *               tipoOperario:
 *                 type: string
 *                 enum: [operario1, operario2]
 *               cargo:
 *                 type: string
 *                 enum: [cargo1, cargo2]
 *               hora_inicio:
 *                 type: string
 *               hora_fin:
 *                 type: string
 *               hora_inicio_descanso:
 *                 type: string
 *               hora_fin_descanso:
 *                 type: string
 *     responses:
 *       201:
 *         description: Creado
 *       400:
 *         description: Error en datos
 */

router.post('/crear', crearExtras);

/**
 * @swagger
 * /extras/eliminar/{id}:
 *   delete:
 *     summary: Eliminar hora extra
 *     tags: [Extras]
 *     description: Elimina un registro de horas extra por su ID.
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

router.delete('/eliminar/:id',eliminarExtras)

/**
 * @swagger
 * /extras/actualizar/{id}:
 *   put:
 *     summary: Actualizar hora extra
 *     tags: [Extras]
 *     description: Actualiza un registro de horas extra por su ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del registro a actualizar
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre_completo: { type: string }
 *               identificacion: { type: string }
 *               tipoOperario: { type: string, enum: [operario1, operario2] }
 *               cargo: { type: string, enum: [cargo1, cargo2] }
 *               hora_inicio: { type: string }
 *               hora_fin: { type: string }
 *               hora_inicio_descanso: { type: string }
 *               hora_fin_descanso: { type: string }
 *     responses:
 *       200: { description: Actualizado correctamente }
 *       400: { description: Error en datos }
 *       404: { description: Registro no encontrado }
 */

router.put('/actualizar/:id',updateExtra)

// Exportar router
module.exports = router;
