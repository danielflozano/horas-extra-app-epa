const { Schema, model } = require('mongoose');
const mongoose = require('mongoose');
const Holidays = require('date-holidays');
const hd = new Holidays('CO'); // Colombia

const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

function parseDateSetter(value) {
  if (!value) return value;
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return value;

  const s = value.trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(s);
  return isNaN(parsed) ? value : parsed;
}

function combineDateAndTimeLocal(fechaDate, horaStr) {
  if (!fechaDate || !horaStr) return null;
  const [hh, mm] = horaStr.split(':').map(Number);
  return new Date(fechaDate.getFullYear(), fechaDate.getMonth(), fechaDate.getDate(), hh, mm, 0, 0);
}

const HorasExtrasSchema = new Schema({
  FuncionarioAsignado: { type: mongoose.Schema.Types.ObjectId, ref: 'Funcionario', required: true },

  fecha_inicio_trabajo: { type: Date, required: true, set: parseDateSetter },
  fecha_fin_trabajo: { type: Date, required: true, set: parseDateSetter },
  hora_inicio_trabajo: { type: String, required: true, match: horaRegex },
  hora_fin_trabajo: { type: String, required: true, match: horaRegex },

  fecha_inicio_descanso: { type: Date, set: parseDateSetter },
  fecha_fin_descanso: { type: Date, set: parseDateSetter },
  hora_inicio_descanso: {
    type: String,
    validate: { validator: v => !v || horaRegex.test(v), message: props => `${props.value} no es una hora válida` }
  },
  hora_fin_descanso: {
    type: String,
    validate: { validator: v => !v || horaRegex.test(v), message: props => `${props.value} no es una hora válida` }
  },

  horas_trabajadas: { type: String, default: '00:00' },
  horas_descanso: { type: String, default: '00:00' },
  horas_extras: { type: String, default: '00:00' },
  horas_diurnas: { type: String, default: '00:00' },
  horas_nocturnas: { type: String, default: '00:00' },
  horas_dominicales_diurnas: { type: String, default: '00:00' },
  horas_dominicales_nocturnas: { type: String, default: '00:00' },
  dia_semana: { type: String },
  tipo_dia: { type: String },
  es_fin_de_semana: { type: Boolean, default: false },
  es_festivo: { type: Boolean, default: false }
}, { timestamps: true });

HorasExtrasSchema.pre('save', function (next) {
  if (!this.fecha_inicio_trabajo || !this.fecha_fin_trabajo || !this.hora_inicio_trabajo || !this.hora_fin_trabajo) {
    return next();
  }

  let inicioTrabajo = combineDateAndTimeLocal(this.fecha_inicio_trabajo, this.hora_inicio_trabajo);
  let finTrabajo = combineDateAndTimeLocal(this.fecha_fin_trabajo, this.hora_fin_trabajo);

  // Ajustar si pasa de medianoche
  if (finTrabajo <= inicioTrabajo) {
  finTrabajo.setDate(finTrabajo.getDate() + 1);
  // Actualizar la fecha_fin_trabajo del documento
  this.fecha_fin_trabajo = new Date(
    this.fecha_inicio_trabajo.getFullYear(),
    this.fecha_inicio_trabajo.getMonth(),
    this.fecha_inicio_trabajo.getDate() + 1
  );
}

  // Descanso
  let inicioDesc, finDesc;
  if (this.fecha_inicio_descanso && this.fecha_fin_descanso && this.hora_inicio_descanso && this.hora_fin_descanso) {
    inicioDesc = combineDateAndTimeLocal(this.fecha_inicio_descanso, this.hora_inicio_descanso);
    finDesc = combineDateAndTimeLocal(this.fecha_fin_descanso, this.hora_fin_descanso);
    if (finDesc <= inicioDesc) finDesc.setDate(finDesc.getDate() + 1);
  }

  const msToHHMM = ms => {
    const h = Math.floor(ms / (1000*60*60));
    const m = Math.floor((ms % (1000*60*60)) / (1000*60));
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  // Calcular horas trabajadas y descanso
  let totalMs = finTrabajo - inicioTrabajo;
  let descansoMs = 0;
  if (inicioDesc && finDesc) {
    descansoMs = finDesc - inicioDesc;
    totalMs -= descansoMs;
  }
  if (totalMs < 0) totalMs = 0;
  this.horas_trabajadas = msToHHMM(totalMs);
  this.horas_descanso = msToHHMM(descansoMs);

  // Día y tipo
  const diasSemana = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const diaIndex = this.fecha_inicio_trabajo.getDay();
  this.dia_semana = diasSemana[diaIndex];
  this.es_festivo = !!hd.isHoliday(this.fecha_inicio_trabajo);
  this.tipo_dia = (diaIndex === 0 || diaIndex === 6) ? 'Fin de semana' : 'Semana';
  this.es_fin_de_semana = diaIndex === 0 || diaIndex === 6;

  // Calcular horas extras minuto a minuto, solo sobre horas efectivas
  let cursor = new Date(inicioTrabajo);
  let msTrabajadosEfectivos = 0;

  let horasExtrasDiurnas = 0, horasExtrasNocturnas = 0;
  let dominicalesDiurnas = 0, dominicalesNocturnas = 0;

  let jornadaMaxMs = 8*60*60*1000; // lunes a sábado = 8 horas
  if (this.es_festivo || diaIndex === 0) jornadaMaxMs = 0; // domingo/festivo → todas extras

  while (cursor < finTrabajo) {
    const hora = cursor.getHours();
    const esDiurna = hora >= 6 && hora < 21;
    const esDominical = this.es_festivo || diaIndex === 0;

    // Ver si está en descanso
    let enDescanso = false;
    if (inicioDesc && finDesc) {
      if (cursor >= inicioDesc && cursor < finDesc) enDescanso = true;
    }

    if (!enDescanso) msTrabajadosEfectivos += 60*1000;

    let esExtra = false;
    if (esDominical) esExtra = true;
    else if (msTrabajadosEfectivos > jornadaMaxMs) esExtra = true;

    if (esExtra) {
      if (esDiurna) {
        horasExtrasDiurnas += 60*1000;
        if (esDominical) dominicalesDiurnas += 60*1000;
      } else {
        horasExtrasNocturnas += 60*1000;
        if (esDominical) dominicalesNocturnas += 60*1000;
      }
    }

    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  this.horas_diurnas = msToHHMM(horasExtrasDiurnas);
  this.horas_nocturnas = msToHHMM(horasExtrasNocturnas);
  this.horas_dominicales_diurnas = msToHHMM(dominicalesDiurnas);
  this.horas_dominicales_nocturnas = msToHHMM(dominicalesNocturnas);

  const totalExtrasMs = horasExtrasDiurnas + horasExtrasNocturnas + dominicalesDiurnas + dominicalesNocturnas;
  this.horas_extras = msToHHMM(totalExtrasMs);

  next();
});

module.exports = model('HorasExtras', HorasExtrasSchema, 'HorasExtras');
