const express = require('express');
const router = express.Router();
const { crearCargo} = require('../controllers/Cargo');

router.post('/crearCargo', crearCargo);

module.exports = router;