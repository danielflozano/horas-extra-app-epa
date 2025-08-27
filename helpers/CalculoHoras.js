const moment = require('moment');

function convertirHorasAMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function minutosAHorasFormato(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function calcularHorasExtras(data) {
  const {
    fecha_inicio_trabajo,
    fecha_fin_trabajo,
    hora_inicio_trabajo,
    hora_fin_trabajo,
    fecha_inicio_descanso,
    fecha_fin_descanso,
    hora_inicio_descanso,
    hora_fin_descanso,
    es_festivo
  } = data;

  const inicioTrabajo = moment(`${fecha_inicio_trabajo} ${hora_inicio_trabajo}`, 'YYYY-MM-DD HH:mm');
  const finTrabajo = moment(`${fecha_fin_trabajo} ${hora_fin_trabajo}`, 'YYYY-MM-DD HH:mm');
  const inicioDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_inicio_descanso} ${hora_inicio_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  const finDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_fin_descanso} ${hora_fin_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;

  if (finTrabajo.isBefore(inicioTrabajo)) {
    finTrabajo.add(1, 'day');
  }
  if (inicioDescanso && finDescanso && finDescanso.isBefore(inicioDescanso)) {
    finDescanso.add(1, 'day');
  }

  const diaSemana = inicioTrabajo.format('dddd'); // Ej: Sunday
  const esFinDeSemana = diaSemana === 'Saturday' || diaSemana === 'Sunday';

  let totalTrabajoMin = finTrabajo.diff(inicioTrabajo, 'minutes');
  let totalDescansoMin = 0;

  if (inicioDescanso && finDescanso) {
    totalDescansoMin = finDescanso.diff(inicioDescanso, 'minutes');
    totalTrabajoMin -= totalDescansoMin;
  }

  let ordinariasDiurnas = 0;
  let ordinariasNocturnas = 0;
  let extrasDiurnas = 0;
  let extrasNocturnas = 0;
  let dominicalesDiurnas = 0;
  let dominicalesNocturnas = 0;

  let cursor = inicioTrabajo.clone();
  let minutosRestantesOrdinarias = (!esFinDeSemana && !es_festivo) ? 480 : 0; // 8 horas en min

  while (cursor.isBefore(finTrabajo)) {
    const siguiente = cursor.clone().add(1, 'minute');
    const horaActual = cursor.hour();

    let esDiurna = horaActual >= 6 && horaActual < 21;

    // Saltar si está en descanso
    if (inicioDescanso && finDescanso && cursor.isBetween(inicioDescanso, finDescanso, null, '[)')) {
      cursor = siguiente;
      continue;
    }

    if (esFinDeSemana || es_festivo) {
      // Dominicales
      if (esDiurna) dominicalesDiurnas++;
      else dominicalesNocturnas++;
    } else {
      // Día normal
      if (minutosRestantesOrdinarias > 0) {
        if (esDiurna) ordinariasDiurnas++;
        else ordinariasNocturnas++;
        minutosRestantesOrdinarias--;
      } else {
        if (esDiurna) extrasDiurnas++;
        else extrasNocturnas++;
      }
    }

    cursor = siguiente;
  }

  const horas_trabajadas = minutosAHorasFormato(totalTrabajoMin);
  const horas_descanso = minutosAHorasFormato(totalDescansoMin);

  const resultado = {
    horas_trabajadas,
    horas_descanso,
    horas_ordinarias_diurnas: minutosAHorasFormato(ordinariasDiurnas),
    horas_ordinarias_nocturnas: minutosAHorasFormato(ordinariasNocturnas),
    horas_extras_diurnas: minutosAHorasFormato(extrasDiurnas),
    horas_extras_nocturnas: minutosAHorasFormato(extrasNocturnas),
    horas_dominicales_diurnas: minutosAHorasFormato(dominicalesDiurnas),
    horas_dominicales_nocturnas: minutosAHorasFormato(dominicalesNocturnas),
    horas_extras: minutosAHorasFormato(extrasDiurnas + extrasNocturnas),
    es_fin_de_semana: esFinDeSemana,
    dia_semana: diaSemana,
    tipo_dia: esFinDeSemana || es_festivo ? 'Fin de semana/Festivo' : 'Normal'
  };

  return resultado;
}

module.exports = { calcularHorasExtras };
