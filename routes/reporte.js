const express = require('express');
const router = express.Router();
const {generarReporteController,generarTodosReporteController} = require('../controllers/Reportes');


//Genera el reporte de uno
router.post('/Generar', generarReporteController);
router.get('/GenerarTodos', generarTodosReporteController);

module.exports = router;