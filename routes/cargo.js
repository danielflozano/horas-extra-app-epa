const express = require('express');
const router = express.Router();
const { crearCargo, listarCargos } = require('../controllers/Cargo');

router.post('/crearCargo', crearCargo);
router.get('/listar', listarCargos);

module.exports = router;
