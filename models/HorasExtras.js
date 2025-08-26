const { Schema, model } = require('mongoose');

const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

const ExtraSchema = new Schema({
  nombre_completo: {
    type: String,
    required: true
  },
  identificacion: {
    type: String,
    required: true
  },
  tipoOperario: {
    type: String,
    enum: ['Operario1', 'Operario2'],
    default: 'Operario1'
  },
  cargo: {
    type: String,
    enum: ['cargo1', 'cargo2'],
    default: 'cargo1'
  },
  fecha_inicio: {
    type: Date,
    required: true
  },
  fecha_fin: {
    type: Date,
    required: true,
    validate: {
      validator: function (v) {
        return !this.fecha_inicio || v >= this.fecha_inicio;
      },
      message: 'La fecha de fin no puede ser anterior a la fecha de inicio.'
    }
  },
  hora_inicio: {
    type: String,
    required: true,
    match: horaRegex
  },
  hora_fin: {
    type: String,
    required: true,
    match: horaRegex
  },
  hora_inicio_descanso: {
    type: String,
    validate: {
      validator: v => !v || horaRegex.test(v),
      message: props => `${props.value} no es una hora válida`
    }
  },
  hora_fin_descanso: {
    type: String,
    validate: {
      validator: v => !v || horaRegex.test(v),
      message: props => `${props.value} no es una hora válida`
    }
  },
  horas_Total: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});


ExtraSchema.pre('save', function (next) {
  if (!this.hora_inicio || !this.hora_fin) {
    return next();
  }

  // Parsear horas
  const [startHour, startMinute] = this.hora_inicio.split(':').map(Number);
  const [endHour, endMinute] = this.hora_fin.split(':').map(Number);

  // Crear fechas base (usamos fecha_inicio para consistencia)
  const startDateTime = new Date(this.fecha_inicio || Date.now());
  startDateTime.setHours(startHour, startMinute, 0, 0);

  const endDateTime = new Date(this.fecha_inicio || Date.now());
  endDateTime.setHours(endHour, endMinute, 0, 0);

  // Si hora_fin es menor que hora_inicio → cruzó medianoche → sumamos 1 día
  if (endDateTime <= startDateTime) {
    endDateTime.setDate(endDateTime.getDate() + 1);
  }

  let totalHours = (endDateTime - startDateTime) / (1000 * 60 * 60);

  // Si hay descanso, lo restamos
  if (this.hora_inicio_descanso && this.hora_fin_descanso) {
    const [restStartHour, restStartMinute] = this.hora_inicio_descanso.split(':').map(Number);
    const [restEndHour, restEndMinute] = this.hora_fin_descanso.split(':').map(Number);

    const restStart = new Date(this.fecha_inicio || Date.now());
    restStart.setHours(restStartHour, restStartMinute, 0, 0);

    const restEnd = new Date(this.fecha_inicio || Date.now());
    restEnd.setHours(restEndHour, restEndMinute, 0, 0);

    if (restEnd <= restStart) {
      restEnd.setDate(restEnd.getDate() + 1);
    }

    const restHours = (restEnd - restStart) / (1000 * 60 * 60);
    totalHours -= restHours;
  }

  this.horas_Total = totalHours > 0 ? Math.round(totalHours) : 0;

  next();
});


module.exports = model('HorasExtras', ExtraSchema, 'HorasExtras');

