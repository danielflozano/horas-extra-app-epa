const express = require('express');
const router = express.Router();
const {generarTReporteController}= require('../controllers/Excel')

router.post('/Excel', generarTReporteController);

module.exports = router;