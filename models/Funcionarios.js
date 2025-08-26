const { Schema, model } = require('mongoose');

const FuncionarioSchema = Schema({
    nombre_completo: { type: String, required: true },
    identificacion: { type: String, required: true },
    tipoOperario: { type: String, enum: ['Planta', 'Cat'], required: true },
    cargo: { type: String, enum: ['cargo1', 'cargo2'], required: true },
});

module.exports = model( 'Funcionario', FuncionarioSchema );