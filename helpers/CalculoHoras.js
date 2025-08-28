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
    es_festivo_Inicio,
    es_festivo_Fin
  } = data;

  // Fechas de trabajo
  const inicioTrabajo = moment(`${fecha_inicio_trabajo} ${hora_inicio_trabajo}`, 'YYYY-MM-DD HH:mm');
  const finTrabajo = moment(`${fecha_fin_trabajo} ${hora_fin_trabajo}`, 'YYYY-MM-DD HH:mm');
  if (finTrabajo.isBefore(inicioTrabajo)) finTrabajo.add(1, 'day');

  // Fechas de descanso
  const inicioDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_inicio_descanso} ${hora_inicio_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  const finDescanso = hora_inicio_descanso && hora_fin_descanso
    ? moment(`${fecha_fin_descanso} ${hora_fin_descanso}`, 'YYYY-MM-DD HH:mm')
    : null;
  if (inicioDescanso && finDescanso && finDescanso.isBefore(inicioDescanso)) finDescanso.add(1, 'day');

  // Día de la semana
  const diaSemana = inicioTrabajo.format('dddd'); // Sunday, Monday...
  const esFinDeSemana = diaSemana === 'Saturday' || diaSemana === 'Sunday';

  // Calcular minutos de descanso dentro del trabajo
  let totalDescansoMin = 0;
  if (inicioDescanso && finDescanso) {
    const inicioDescansoReal = moment.max(inicioDescanso, inicioTrabajo);
    const finDescansoReal = moment.min(finDescanso, finTrabajo);
    if (finDescansoReal.isAfter(inicioDescansoReal)) {
      totalDescansoMin = finDescansoReal.diff(inicioDescansoReal, "minutes");
    }
  }

  let totalTrabajoMin = finTrabajo.diff(inicioTrabajo, "minutes") - totalDescansoMin;

  // Inicializar contadores
  let ordinariasDiurnas = 0;
  let ordinariasNocturnas = 0;
  let extrasDiurnas = 0;
  let extrasNocturnas = 0;
  let dominicalesDiurnas = 0;
  let dominicalesNocturnas = 0;
  let recargoNocturno = 0;

  // Bucle minuto a minuto
  let cursor = inicioTrabajo.clone();
  let minutosRestantesOrdinarias = (!esFinDeSemana && !es_festivo_Inicio) ? 480 : 0; // 8 horas ordinarias

  while (cursor.isBefore(finTrabajo)) {
    const siguiente = cursor.clone().add(1, 'minute');
    const horaActual = cursor.hour();
    const esDiurna = horaActual >= 6 && horaActual < 21;

    // Saltar descanso
    if (inicioDescanso && finDescanso) {
      const inicioDescansoReal = moment.max(inicioDescanso, inicioTrabajo);
      const finDescansoReal = moment.min(finDescanso, finTrabajo);
      if (cursor.isBetween(inicioDescansoReal, finDescansoReal, null, '[)')) {
        cursor = siguiente;
        continue;
      }
    }

    // Determinar si el minuto actual es festivo usando tus booleanos
    let esFestivoActual = cursor.isSameOrBefore(inicioTrabajo.clone().endOf('day'))
      ? es_festivo_Inicio
      : es_festivo_Fin;

    if (esFinDeSemana || esFestivoActual) {
      // Dominicales/festivos
      if (esDiurna) dominicalesDiurnas++;
      else dominicalesNocturnas++;
    } else {
      // Día normal
      if (minutosRestantesOrdinarias > 0) {
        if (esDiurna) ordinariasDiurnas++;
        else {
          ordinariasNocturnas++;
          recargoNocturno++;
        }
        minutosRestantesOrdinarias--;
      } else {
        // Horas extras
        if (esDiurna) extrasDiurnas++;
        else extrasNocturnas++;
      }
    }

    cursor = siguiente;
  }

  // Evitar negativos en cualquier contador
  ordinariasDiurnas = Math.max(ordinariasDiurnas, 0);
  ordinariasNocturnas = Math.max(ordinariasNocturnas, 0);
  extrasDiurnas = Math.max(extrasDiurnas, 0);
  extrasNocturnas = Math.max(extrasNocturnas, 0);
  dominicalesDiurnas = Math.max(dominicalesDiurnas, 0);
  dominicalesNocturnas = Math.max(dominicalesNocturnas, 0);
  recargoNocturno = Math.max(recargoNocturno, 0);



  return {
    horas_trabajadas: minutosAHorasFormato(totalTrabajoMin),
    horas_descanso: minutosAHorasFormato(totalDescansoMin),
    horas_ordinarias_diurnas: minutosAHorasFormato(ordinariasDiurnas),
    horas_ordinarias_nocturnas: minutosAHorasFormato(ordinariasNocturnas),
    horas_extras_diurnas: minutosAHorasFormato(extrasDiurnas),
    horas_extras_nocturnas: minutosAHorasFormato(extrasNocturnas),
    horas_dominicales_diurnas: minutosAHorasFormato(dominicalesDiurnas),
    horas_dominicales_nocturnas: minutosAHorasFormato(dominicalesNocturnas),
    recargo_nocturno: minutosAHorasFormato(recargoNocturno),
    horas_extras: minutosAHorasFormato(extrasDiurnas + extrasNocturnas + dominicalesDiurnas + dominicalesNocturnas),
    es_fin_de_semana: esFinDeSemana,
    dia_semana: diaSemana,
    tipo_dia: esFinDeSemana || es_festivo_Inicio ? 'Fin de semana/Festivo' : 'Normal'
  };
}

module.exports = { calcularHorasExtras };

