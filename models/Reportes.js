const { Schema, model } = require('mongoose');

const ReporteSchema = Schema({

  identificacion_Funcionario:{
    type: String,
    require: true
  },
  nombre_Funcionario:{
    type: String,
    require: true
  },
  fechaInicioReporte:{
     type: Date,
     requiere: true
  },
  fechaFinReporte :{
     type: Date,
     requiere: true
  },
  HDO_HORA:{
    type: Number,
    require: true
  },
  HENO_HORA:{
    type: Number,
    require: true
  },
  HEDF_HORA:{
    type: Number,
    require: true
  },
  HENF_HORA:{
    type: Number,
    require: true
  },
  HDF_HORA:{
    type: Number,
    require: true
  },
  HNF_HORA:{
    type: Number,
    require: true
  },
  RNO_HORA:{
    type: Number,
    require: true
  },
  HEDO_CONVERSION:{
    type: Number,
    require: true
  },HENO_CONERSION:{
    type: Number,
    require: true
  },
  HEDF_CONVERSION:{
    type: Number,
    require: true
  },
  HENF_CONVERSION:{
    type: Number,
    require: true
  },
  HDF_CONVERSION:{
    type: Number,
    require: true
  },
  HNF_CONVERSION:{
    type: Number,
    require: true
  },
  RNO_CONVERSION:{
    type: Number,
    require: true
  },
  Periodo:{
    type:String,
    require: true
  },
  totalHorasExtra: {
    type:Number,
    require:true
  },
  cantidad_Trabajados:{
    type: String,
    requiere: true
  }
});

module.exports = model( 'Reportes', ReporteSchema );