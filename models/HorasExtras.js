const mongoose = require('mongoose');

const horasExtrasSchema = new mongoose.Schema({
  FuncionarioAsignado: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Funcionario',
    required: true
  },
  fecha_inicio_trabajo: { type: Date, required: true },
  fecha_fin_trabajo: { type: Date, required: true },
  hora_inicio_trabajo: { type: String, required: true }, // formato HH:mm
  hora_fin_trabajo: { type: String, required: true }, // formato HH:mm

  fecha_inicio_descanso: { type: Date },
  fecha_fin_descanso: { type: Date },
  hora_inicio_descanso: { type: String },
  hora_fin_descanso: { type: String },

  horas_trabajadas: { type: String, default: '00:00' },
  horas_descanso: { type: String, default: '00:00' },

  horas_ordinarias_diurnas: { type: String, default: '00:00' },
  horas_ordinarias_nocturnas: { type: String, default: '00:00' },
  horas_extras_diurnas: { type: String, default: '00:00' },
  horas_extras_nocturnas: { type: String, default: '00:00' },
  horas_dominicales_diurnas: { type: String, default: '00:00' },
  horas_dominicales_nocturnas: { type: String, default: '00:00' },
  horas_extras: { type: String, default: '00:00' },
  recargo_nocturno: { type: String, default: "00:00" },
  es_fin_de_semana: { type: Boolean, default: false },
  es_festivo_Inicio: { type: Boolean, default: false },
  es_festivo_Fin: { type: Boolean, default: false },

  dia_semana: { type: String },
  tipo_dia: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('HorasExtras', horasExtrasSchema);
