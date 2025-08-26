const express = require('express');
const router = express.Router();
const { crearFuncionario} = require('../controllers/Funcionario');

router.post('/crearFuncionario', crearFuncionario);

module.exports = router;