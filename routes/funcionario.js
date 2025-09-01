const express = require('express');
const router = express.Router();
const { crearFuncionario, listarFuncionarios } = require('../controllers/Funcionario');

router.post('/crearfuncionario', crearFuncionario);
router.get('/', listarFuncionarios);

module.exports = router;
