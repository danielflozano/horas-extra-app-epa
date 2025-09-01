const moment = require('moment');

function calcularHorasExtras({
  fecha_inicio_trabajo,
  hora_inicio_trabajo,
  fecha_fin_trabajo,
  hora_fin_trabajo,
  fecha_inicio_descanso,
  hora_inicio_descanso,
  fecha_fin_descanso,
  hora_fin_descanso,
  es_festivo_Inicio,
  es_festivo_Fin
}) {
  const inicioTotal = moment(`${fecha_inicio_trabajo} ${hora_inicio_trabajo}`, 'YYYY-MM-DD HH:mm');
  let finTotal = moment(`${fecha_fin_trabajo} ${hora_fin_trabajo}`, 'YYYY-MM-DD HH:mm');
  if (finTotal.isBefore(inicioTotal)) finTotal.add(1, 'day'); // Cruce de medianoche

  const descansoInicio = fecha_inicio_descanso && hora_inicio_descanso
    ? moment(`${fecha_inicio_descanso} ${hora_inicio_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  const descansoFin = fecha_fin_descanso && hora_fin_descanso
    ? moment(`${fecha_fin_descanso} ${hora_fin_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;

  let HDO = 0, HENO = 0, HDF = 0, HNF = 0, HEDF = 0, HENF = 0, RNO = 0;
  let totalMinutosTrabajados = 0, totalMinutosDescanso = 0;
  let es_fin_de_semana = false;

  let cursor = moment(inicioTotal);
  let diaActual = cursor.format('YYYY-MM-DD');
  let minutosOrdinariosDia = 0;

  while (cursor.isBefore(finTotal)) {
    const siguiente = moment(cursor).add(1, 'minute');

    // Reinicia contador de ordinarias al cambiar de día
    if (cursor.format('YYYY-MM-DD') !== diaActual) {
      diaActual = cursor.format('YYYY-MM-DD');
      minutosOrdinariosDia = 0;
    }

    // Descanso
    if (descansoInicio && descansoFin && cursor.isBetween(descansoInicio, descansoFin, null, '[)')) {
      totalMinutosDescanso++;
      cursor = siguiente;
      continue;
    }

    totalMinutosTrabajados++;

    // Recargo nocturno
    const hora = cursor.hour();
    const esNocturno = hora >= 21 || hora < 6;
    if (esNocturno) RNO++;

    // Determinar tipo de día
    const diaSemana = cursor.isoWeekday(); // 1=Lunes ... 7=Domingo
    let esFestivo = false;
    if (cursor.isSame(moment(fecha_inicio_trabajo), 'day')) esFestivo = es_festivo_Inicio;
    if (cursor.isSame(moment(fecha_fin_trabajo), 'day')) esFestivo = es_festivo_Fin;

    const esDominical = esFestivo || diaSemana === 7;
    if (diaSemana === 7) es_fin_de_semana = true;

    // Asignar minutos
    if (esDominical) {
      if (esNocturno) HENF++;
      else HEDF++;
    } else {
      // Ordinarias primeras 8h por día (480 min)
      if (minutosOrdinariosDia < 480) {
        if (esNocturno) HENO++;
        else HDO++;
        minutosOrdinariosDia++;
      } else {
        if (esNocturno) HNF++;
        else HDF++;
      }
    }

    cursor = siguiente;
  }

  function formato(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  return {
    success: true,
    horas_trabajadas: formato(totalMinutosTrabajados),
    horas_descanso: formato(totalMinutosDescanso),
    horas_ordinarias_diurnas: formato(HDO),
    horas_ordinarias_nocturnas: formato(HENO),
    horas_extras_diurnas: formato(HDF),
    horas_extras_nocturnas: formato(HNF),
    horas_dominicales_diurnas: formato(HEDF),
    horas_dominicales_nocturnas: formato(HENF),
    horas_extras: formato(HDF + HNF + HEDF + HENF),
    recargo_nocturno: formato(RNO),
    es_fin_de_semana
  };
}

module.exports = { calcularHorasExtras };
