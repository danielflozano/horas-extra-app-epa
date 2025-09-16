const express = require('express');
const router = express.Router();
const { crearReporte, exportarReporteExcel } = require('../controllers/Reportes');

/**
 * @swagger
 * tags:
 *   name: Reportes
 *   description: API para la creación, listado y exportación de reportes
 */

/**
 * @swagger
 * /api/reporte/crear:
 *   post:
 *     summary: Crear un nuevo reporte con datos detallados de horas
 *     tags: [Reportes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fechaInicio
 *               - fechaFin
 *               - tipoOperario
 *             properties:
 *               identificacion_Funcionario:
 *                 type: string
 *                 example: "1234567890"
 *               nombre_Funcionario:
 *                 type: string
 *                 example: "Juan Pérez"
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *                 example: "01/08/2025"
 *               fechaFin:
 *                 type: string
 *                 format: date
 *                 example: "31/08/2025"
 *               tipoOperario:
 *                 type: string
 *                 example: "Obrero"
 *               HEDO_HORA:
 *                 type: string
 *                 example: "02:00"
 *               HENO_HORA:
 *                 type: string
 *                 example: "01:30"
 *               HEDF_HORA:
 *                 type: string
 *                 example: "00:45"
 *               HENF_HORA:
 *                 type: string
 *                 example: "00:30"
 *               HDF_HORA:
 *                 type: string
 *                 example: "01:15"
 *               HNF_HORA:
 *                 type: string
 *                 example: "01:00"
 *               RNO_HORA:
 *                 type: string
 *                 example: "00:20"
 *               HEDO_DEC:
 *                 type: number
 *                 example: 2
 *               HENO_DEC:
 *                 type: number
 *                 example: 1.5
 *               HEDF_DEC:
 *                 type: number
 *                 example: 0.75
 *               HENF_DEC:
 *                 type: number
 *                 example: 0.5
 *               HDF_DEC:
 *                 type: number
 *                 example: 1.25
 *               HNF_DEC:
 *                 type: number
 *                 example: 1
 *               RNO_DEC:
 *                 type: number
 *                 example: 0.33
 *               totalExtras_DEC:
 *                 type: number
 *                 example: 4.75
 *     responses:
 *       201:
 *         description: Reporte creado exitosamente
 *       400:
 *         description: Datos inválidos
 */
router.post('/crear', crearReporte);


/**
 * @swagger
 * /api/reporte/exportar:
 *   post:
 *     summary: Exportar reportes filtrados a Excel
 *     description: Filtra los reportes por un rango de fechas (`fechaInicio` y `fechaFin`) y los exporta en un archivo Excel.
 *     tags: [Reportes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fechaInicio:
 *                 type: string
 *                 format: date
 *                 description: Fecha inicial del rango
 *                 example: "2025-08-01"
 *               fechaFin:
 *                 type: string
 *                 format: date
 *                 description: Fecha final del rango
 *                 example: "2025-08-31"
 *     responses:
 *       200:
 *         description: Archivo Excel exportado correctamente
 *       404:
 *         description: No se encontraron datos para exportar
 */
router.post('/exportar', exportarReporteExcel);

/**
 * @swagger
 * /api/reporte/listar:
 *   get:
 *     summary: Listar todos los reportes registrados
 *     tags: [Reportes]
 *     responses:
 *       200:
 *         description: Lista de reportes obtenida correctamente
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
 *                       identificacion_Funcionario:
 *                         type: string
 *                         example: "1234567890"
 *                       nombre_Funcionario:
 *                         type: string
 *                         example: "Juan Pérez"
 *                       fechaInicioReporte:
 *                         type: string
 *                         format: date
 *                         example: "2025-08-01"
 *                       fechaFinReporte:
 *                         type: string
 *                         format: date
 *                         example: "2025-08-31"
 *                       totalHoras_DEC:
 *                         type: number
 *                         example: 7.33
 */
router.get('/listar', async (req, res) => {
  try {
    const reportes = await require('../models/Reportes').find();
    res.json({ success: true, data: reportes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
