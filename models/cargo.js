
const { Schema, model } = require('mongoose');

const CargoSchema = Schema({
  name: {
    type: String,
    require: true
  },
 
});

module.exports = model( 'Cargo', CargoSchema );