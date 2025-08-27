const { Schema, model } = require('mongoose');

const ReporteSchema = Schema({
  id_Funcionario: {
    type: String,
    require: true
  },
  totalHorasExtras:{
    type:Number,
    require: true
  },
  Periodo:{
    type:String,
    require: true
  }
});

module.exports = model( 'Reportes', ReporteSchema );