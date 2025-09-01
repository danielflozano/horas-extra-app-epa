
const { Schema, model } = require('mongoose');
const mongoose = require('mongoose');

const CargoSchema = Schema({
  name: {
    type: String,
    required: true
  },
 
});

module.exports = model( 'Cargo', CargoSchema );