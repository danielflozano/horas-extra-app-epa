
const { Schema, model } = require('mongoose');

const UsuarioSchema = Schema({
  name: {
    type: String,
    require: true
  },
  email: {
    type: String,
    require: true,
    unique: true
  },
  password: {
    type: String,
    require: true
  },
  rol:{
    type: String, enum: ['Administrador', 'SuperAdministrador','Usuario'],default: 'Usuario', required: true
  },
  resetCode: { type: String },
  resetCodeExpires: { type: Date },
  resetVerified: { type: Boolean, default: false }
});

module.exports = model( 'Usuario', UsuarioSchema );