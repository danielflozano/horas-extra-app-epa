
const { Schema, model } = require('mongoose');

const UsuarioSchema = Schema({
  name: {
    type: String,
    require: true
  },
  email: {
    type: String,
    require: true,
    unique: true,
    lowerCase: true,
  },
  password: {
    type: String,
    require: true
  }
});

module.exports = model( 'Usuario', UsuarioSchema );