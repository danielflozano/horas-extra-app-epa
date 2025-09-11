const { Schema, model } = require('mongoose');
const mongoose = require('mongoose');

const ReporteSchema = Schema({
  identificacion_Funcionario: {
    type: String,
    required: true
  },
  nombre_Funcionario: {
    type: String,
    required: true
  },
  fechaInicioReporte: {
    type: Date,
    required: true
  },
  fechaFinReporte: {
    type: Date,
    required: true
  },
  tipoOperario: {
    type: String,
    enum: ['Planta', 'Temporal'],
    required: true
  },
  // Extras HH:mm
  HEDO_HORA: { type: String, required: true },
  HENO_HORA: { type: String, required: true },
  HEDF_HORA: { type: String, required: true },
  HENF_HORA: { type: String, required: true },
  // Suplementarias HH:mm
  HDF_HORA: { type: String, required: true },
  HNF_HORA: { type: String, required: true },
  RNO_HORA: { type: String, required: true },
  // Extras decimal
  HEDO_DEC: { type: Number, required: true },
  HENO_DEC: { type: Number, required: true },
  HEDF_DEC: { type: Number, required: true },
  HENF_DEC: { type: Number, required: true },
  // Suplementarias decimal
  HDF_DEC: { type: Number, required: true },
  HNF_DEC: { type: Number, required: true },
  RNO_DEC: { type: Number, required: true },
  // Sumatorias finales en decimal
  totalExtras_DEC: { type: Number, required: true },
  periodo: {
    type: String,
    enum: ['Quincenal', 'Mensual', 'Anual'], 
    required: true
  }
});

module.exports = model('Reportes', ReporteSchema);