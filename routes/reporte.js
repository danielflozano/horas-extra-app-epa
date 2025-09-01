const express = require('express');
const router = express.Router();
const { crearReporte, exportarReporteExcel } = require('../controllers/Reportes');

// ✅ Crear y guardar reporte en la base de datos
router.post('/crear', crearReporte);

// ✅ Exportar reporte filtrado a Excel (sin modificar DB)
router.post('/exportar', exportarReporteExcel);

router.get('/listar', async (req, res) => {
  try {
    const reportes = await require('../models/Reportes').find();
    res.json({ success: true, data: reportes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

