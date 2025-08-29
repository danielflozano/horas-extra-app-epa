const moment = require('moment');

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
    es_festivo_Inicio,
    es_festivo_Fin
  } = data;

  if (fecha_inicio_trabajo == fecha_fin_trabajo && es_festivo_Inicio !== es_festivo_Fin) {
    throw new Error('Inconsistencia entre fechas y marcación de festivo.');
  }

  const inicioTrabajo = moment(`${fecha_inicio_trabajo} ${hora_inicio_trabajo}`, 'YYYY-MM-DD HH:mm');
  let finTrabajo = moment(`${fecha_fin_trabajo} ${hora_fin_trabajo}`, 'YYYY-MM-DD HH:mm');
  if (finTrabajo.isBefore(inicioTrabajo)) finTrabajo.add(1, 'day');

  // descanso (puede estar en otro día)
  const inicioDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_inicio_descanso} ${hora_inicio_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  const finDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_fin_descanso} ${hora_fin_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  if (inicioDescanso && finDescanso && finDescanso.isBefore(inicioDescanso)) finDescanso.add(1, 'day');

  // Helper: devolver si el cursor corresponde a día festivo (según inicio/fin)
  function esFestivoParaCursor(cursor) {
    if (cursor.isSame(inicioTrabajo, 'day')) return !!es_festivo_Inicio;
    if (cursor.isSame(finTrabajo, 'day'))   return !!es_festivo_Fin;
    return false; // días intermedios (si los hubiera) se asumen no festivos
  }

  // Calcular minutos de descanso (intersección descanso vs trabajo)
  let totalDescansoMin = 0;
  if (inicioDescanso && finDescanso) {
    const inicioDescansoReal = moment.max(inicioDescanso, inicioTrabajo);
    const finDescansoReal = moment.min(finDescanso, finTrabajo);
    if (finDescansoReal.isAfter(inicioDescansoReal)) {
      totalDescansoMin = finDescansoReal.diff(inicioDescansoReal, "minutes");
    }
  }

  // tiempo total efectivo trabajado en minutos
  const totalTrabajoMin = finTrabajo.diff(inicioTrabajo, "minutes") - totalDescansoMin;

  // contadores (minutos)
  let ordinariasDiurnas = 0;
  let ordinariasNocturnas = 0;
  let extrasDiurnas = 0;
  let extrasNocturnas = 0;
  let dominicalesDiurnas = 0;
  let dominicalesNocturnas = 0;

  // para detectar cambio de día y resetear 8h ordinarias por día
  let currentDay = inicioTrabajo.format('YYYY-MM-DD');
  // inicializamos minutos restantes de ordinarias para el primer día
  const initFestivoPrimerDia = esFestivoParaCursor(inicioTrabajo);
  let minutosRestantesOrdinarias = (inicioTrabajo.day() !== 0 && !initFestivoPrimerDia) ? 480 : 0;

  let cursor = inicioTrabajo.clone();
  let foundDominical = false;

  while (cursor.isBefore(finTrabajo)) {
    // si cambió el día, recalcular minutosRestantesOrdinarias para el nuevo día
    const cursorDayStr = cursor.format('YYYY-MM-DD');
    if (cursorDayStr !== currentDay) {
      currentDay = cursorDayStr;
      const fest = esFestivoParaCursor(cursor);
      minutosRestantesOrdinarias = (cursor.day() !== 0 && !fest) ? 480 : 0;
    }

    const siguiente = cursor.clone().add(1, 'minute');

    // comprobar si está dentro del periodo de descanso (si aplica)
    if (inicioDescanso && finDescanso) {
      const inicioDescansoReal = moment.max(inicioDescanso, inicioTrabajo);
      const finDescansoReal = moment.min(finDescanso, finTrabajo);
      if (cursor.isBetween(inicioDescansoReal, finDescansoReal, null, '[)')) {
        cursor = siguiente;
        continue;
      }
    }

    const horaActual = cursor.hour();
    const esDiurna = horaActual >= 6 && horaActual < 21;

    // festivo para el día actual (según cursor)
    const esFestivoActual = esFestivoParaCursor(cursor);
    const esDominical = (cursor.day() === 0) || esFestivoActual; // domingo o festivo
    if (esDominical) foundDominical = true;

    if (esDominical) {
      if (esDiurna) dominicalesDiurnas++;
      else dominicalesNocturnas++;
    } else {
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

  // recargo nocturno: total minutos nocturnos (ordinarios+extras+dominicales)
  const recargoNocturnoMin = ordinariasNocturnas + extrasNocturnas ;

  // armar retorno en formato HH:mm
  const retorno = {
    horas_trabajadas: minutosAHorasFormato(totalTrabajoMin),
    horas_descanso: minutosAHorasFormato(totalDescansoMin),
    horas_ordinarias_diurnas: minutosAHorasFormato(ordinariasDiurnas),
    horas_ordinarias_nocturnas: minutosAHorasFormato(ordinariasNocturnas),
    horas_extras_diurnas: minutosAHorasFormato(extrasDiurnas),
    horas_extras_nocturnas: minutosAHorasFormato(extrasNocturnas),
    horas_dominicales_diurnas: minutosAHorasFormato(dominicalesDiurnas),
    horas_dominicales_nocturnas: minutosAHorasFormato(dominicalesNocturnas),
    recargo_nocturno: minutosAHorasFormato(recargoNocturnoMin),
    horas_extras: minutosAHorasFormato(extrasDiurnas + extrasNocturnas + dominicalesDiurnas + dominicalesNocturnas),
    es_domingo_inicio: inicioTrabajo.day() === 0,
    es_domingo_fin: finTrabajo.day() === 0,
    es_festivo_inicio: !!es_festivo_Inicio,
    es_festivo_fin: !!es_festivo_Fin,
    tipo_dia: foundDominical ? 'Domingo/Festivo' : 'Normal',
    dia_semana_inicio: inicioTrabajo.format('dddd'),
    dia_semana_fin: finTrabajo.format('dddd')
  };

  return retorno;
}

module.exports = { calcularHorasExtras };
