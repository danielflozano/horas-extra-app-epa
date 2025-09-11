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
  if (finTotal.isBefore(inicioTotal)) finTotal.add(1, 'day'); // Cruce medianoche

  const descansoInicio = fecha_inicio_descanso && hora_inicio_descanso 
    ? moment(`${fecha_inicio_descanso} ${hora_inicio_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  const descansoFin = fecha_fin_descanso && hora_fin_descanso 
    ? moment(`${fecha_fin_descanso} ${hora_fin_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;

  // Acumuladores de minutos
  let HDO = 0, HNO = 0, HEDO = 0, HENO = 0;
  let HDF = 0, HNF = 0, HEDF = 0, HENF = 0;
  let RNO = 0;
  let totalMinutosTrabajados = 0, totalMinutosDescanso = 0;
  let es_fin_de_semana = false;

  let minutosOrdinariosGlobales = 0;

  let diaActual = "";

  let cursor = moment(inicioTotal);

  while (cursor.isBefore(finTotal)) {
    const siguiente = moment(cursor).add(1, 'minute');
    const fechaCursor = cursor.format('YYYY-MM-DD');

    // Resetear contador al cambiar de día
    if (fechaCursor !== diaActual) {
      diaActual = fechaCursor;
      minutosOrdinariosDia = 0;
    }

    // Saltar descanso
    if (descansoInicio && descansoFin && cursor.isBetween(descansoInicio, descansoFin, null, '[)')) {
      totalMinutosDescanso++;
      cursor = siguiente;
      continue;
    }

    totalMinutosTrabajados++;

    const hora = cursor.hour();
    const esNocturno = hora >= 18 || hora < 6;

    // Tipo de día
    const diaSemana = cursor.isoWeekday();
    let esFestivo = false;
    if (cursor.isSame(moment(fecha_inicio_trabajo), 'day')) esFestivo = es_festivo_Inicio;
    if (cursor.isSame(moment(fecha_fin_trabajo), 'day')) esFestivo = es_festivo_Fin;

    if (diaSemana === 7) es_fin_de_semana = true;

    // Solo las primeras 8 horas del turno (480 min) se cuentan como ordinarias
let esOrdinario = false;
  if (minutosOrdinariosGlobales < 480) {
    esOrdinario = true;
    minutosOrdinariosGlobales++; // Solo aumenta si realmente es ordinario
  }

  // Clasificación según tipo de día y horario
  if (esFestivo || diaSemana === 7) {
    if (esNocturno) {
      if (esOrdinario) {
        HNF++;
      } else {
        HENF++;
      }
    } else {
      if (esOrdinario) {
        HDF++;
      } else {
        HEDF++;
      }
    }
  } else {
    if (esNocturno) {
      if (esOrdinario) {
        HNO++;
      } else {
        HENO++;
      }
    } else {
      if (esOrdinario) {
        HDO++;
      } else {
        HEDO++;
      }
    }
  }

  // Recargo nocturno: SOLO cuenta en ordinarias nocturnas
  if (esNocturno && esOrdinario && diaSemana != 7 && !esFestivo ) {
    RNO++;
  }

  cursor = siguiente;
}
  // Función formato HH:MM
  function formato(minutos) {
    const h = Math.floor(minutos / 60);
    const m = minutos % 60;
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  }

  return {
    success: true,
    horas_trabajadas: formato(totalMinutosTrabajados),
    horas_descanso: formato(totalMinutosDescanso),
    HDO: formato(HDO),
    HNO: formato(HNO),
    HEDO: formato(HEDO),
    HENO: formato(HENO),
    HDF: formato(HDF),
    HNF: formato(HNF),
    HEDF: formato(HEDF),
    HENF: formato(HENF),
    horas_extras: formato(HEDO + HENO + HEDF + HENF),
    RNO: formato(RNO),
    es_fin_de_semana
  };
}

module.exports = { calcularHorasExtras };
