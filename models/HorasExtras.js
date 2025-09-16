const mongoose = require('mongoose');

const horasExtrasSchema = new mongoose.Schema({
  FuncionarioAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Funcionario',
    required: true
  },
  fecha_inicio_trabajo: { type: Date, required: true },
  fecha_fin_trabajo: { type: Date, required: true },
  hora_inicio_trabajo: { type: String, required: true }, 
  hora_fin_trabajo: { type: String, required: true }, 

  fecha_inicio_descanso: { type: Date },
  fecha_fin_descanso: { type: Date },
  hora_inicio_descanso: { type: String },
  hora_fin_descanso: { type: String },

  horas_trabajadas: { type: String, default: '00:00' },
  horas_descanso: { type: String, default: '00:00' },

  HDO: { type: String, default: '00:00' },
  HNO: { type: String, default: '00:00' },
  HEDO: { type: String, default: '00:00' },
  HENO: { type: String, default: '00:00' },
  RNO: { type: String, default: "00:00" },
  HEDF:{type: String, default: '00:00'},
  HENF :{type: String, default: '00:00'},
  HDF :{type: String, default: '00:00'},
  HNF :{type: String, default: '00:00'},
  horas_extras: { type: String, default: '00:00' },
  es_fin_de_semana: { type: Boolean, default: false },
  es_festivo_Inicio: { type: Boolean, default: false },
  es_festivo_Fin: { type: Boolean, default: false },
  dia_semana: { type: String },
  tipo_dia: { type: String },
  observaciones: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('HorasExtras', horasExtrasSchema);
