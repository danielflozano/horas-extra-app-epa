const express = require('express');
const router = express.Router();
const {generarReporteController} = require('../controllers/Reportes');

router.post('/Generar', generarReporteController);

module.exports = router;