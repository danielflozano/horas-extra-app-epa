const moment = require('moment');
const Funcionario = require('../models/Funcionarios');

async function calcularHorasExtras(data) {
  try {
    const {
      fecha_inicio_trabajo, hora_inicio_trabajo,
      fecha_fin_trabajo, hora_fin_trabajo,
      fecha_inicio_descanso, hora_inicio_descanso,
      fecha_fin_descanso, hora_fin_descanso,
      es_festivo_Inicio, es_festivo_Fin,
      FuncionarioAsignado
    } = data;

    const funcionario = await Funcionario.findById(FuncionarioAsignado);
    if (!funcionario) {
      throw new Error("Funcionario no encontrado en la BD.");
    }
    
    const tipo = (funcionario.tipoOperario || 'planta').toLowerCase();
    
    let inicioTotal = moment.utc(`${fecha_inicio_trabajo}T${hora_inicio_trabajo}`);
    let finTotal = moment.utc(`${fecha_fin_trabajo}T${hora_fin_trabajo}`);
    if (finTotal.isBefore(inicioTotal)) finTotal.add(1, 'day');

    const descansoInicio = fecha_inicio_descanso && hora_inicio_descanso ? moment.utc(`${fecha_inicio_descanso}T${hora_inicio_descanso}`) : null;
    let descansoFin = fecha_fin_descanso && hora_fin_descanso ? moment.utc(`${fecha_fin_descanso}T${hora_fin_descanso}`) : null;
    if (descansoFin && descansoFin.isBefore(descansoInicio)) descansoFin.add(1, 'day');
    
    let horas = { HDO: 0, HNO: 0, HEDO: 0, HENO: 0, HDF: 0, HNF: 0, HEDF: 0, HENF: 0, RNO: 0 };
    let totalMinutosTrabajados = 0;
    let totalMinutosDescanso = 0;
    let es_fin_de_semana = false;
    
    const limiteOrdinarias = (tipo === 'temporal') ? 440 : 480;
    
    let cursor = inicioTotal.clone();
    while (cursor.isBefore(finTotal)) {
      const enDescanso = descansoInicio && cursor.isSameOrAfter(descansoInicio) && cursor.isBefore(descansoFin);
      
      if (enDescanso) {
        totalMinutosDescanso++;
      } else {
        const diaSemana = cursor.isoWeekday();
        const hora = cursor.hour();
        const esFestivo = (cursor.isSame(moment.utc(fecha_inicio_trabajo), 'day') && es_festivo_Inicio) || 
                        (cursor.isSame(moment.utc(finTotal.clone().subtract(1, 'minute')), 'day') && es_festivo_Fin);
        
        if (diaSemana === 7) es_fin_de_semana = true;

        const esNocturno = hora >= 18 || hora < 6;
        const esOrdinario = totalMinutosTrabajados < limiteOrdinarias;

        if (diaSemana === 7 || esFestivo) {
          if (esOrdinario) (esNocturno ? horas.HNF++ : horas.HDF++);
          else (esNocturno ? horas.HENF++ : horas.HEDF++);
        } else {
          if (esOrdinario) (esNocturno ? horas.HNO++ : horas.HDO++);
          else (esNocturno ? horas.HENO++ : horas.HEDO++);
        }
        
        if (esNocturno && esOrdinario && diaSemana !== 7 && !esFestivo ) {
            horas.RNO++;
        }
        
        totalMinutosTrabajados++;
      }
      cursor.add(1, 'minute');
    }
    
    let horaFinAjustada = null;
    let fechaFinAjustada = null;
    const limiteParaCompletar = (tipo === 'planta') ? 480 : 440;

    if (totalMinutosTrabajados > 0 && totalMinutosTrabajados < limiteParaCompletar) {
        const minutosFaltantes = limiteParaCompletar - totalMinutosTrabajados;
        
        const ultimoMinuto = finTotal.clone().subtract(1, 'minute');
        const esNocturno = ultimoMinuto.hour() >= 18 || ultimoMinuto.hour() < 6;
        const esFestivoODominical = ultimoMinuto.isoWeekday() === 7 || (ultimoMinuto.isSame(moment.utc(finTotal.clone().subtract(1, 'minute')), 'day') && es_festivo_Fin);

        if (esFestivoODominical) {
            esNocturno ? (horas.HNF += minutosFaltantes) : (horas.HDF += minutosFaltantes);
        } else {
            esNocturno ? (horas.HNO += minutosFaltantes) : (horas.HDO += minutosFaltantes);
        }
        if (esNocturno && !esFestivoODominical) {
            horas.RNO += minutosFaltantes;
        }
        
        let finTotalAjustado = finTotal.clone().add(minutosFaltantes, 'minutes');
        horaFinAjustada = finTotalAjustado.format('HH:mm');
        fechaFinAjustada = finTotalAjustado.format('YYYY-MM-DD');
        totalMinutosTrabajados = limiteParaCompletar;
    }

    const aHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

    const resultado = {
        success: true,
        horas_trabajadas: aHHMM(totalMinutosTrabajados),
        horas_descanso: aHHMM(totalMinutosDescanso),
        HDO: aHHMM(horas.HDO), HNO: aHHMM(horas.HNO),
        HDF: aHHMM(horas.HDF), HNF: aHHMM(horas.HNF),
        HEDO: aHHMM(horas.HEDO), HENO: aHHMM(horas.HENO),
        HEDF: aHHMM(horas.HEDF), HENF: aHHMM(horas.HENF),
        RNO: aHHMM(horas.RNO),
        horas_extras: aHHMM(horas.HEDO + horas.HENO + horas.HEDF + horas.HENF),
        es_fin_de_semana
    };

    if (horaFinAjustada) {
        resultado.hora_fin_trabajo_ajustada = horaFinAjustada;
        resultado.fecha_fin_trabajo_ajustada = fechaFinAjustada;
    }

    return resultado;
  } catch (error) {
    console.error("Error en calcularHorasExtras:", error);
    return { success: false, message: error.message };
  }
}

module.exports = { calcularHorasExtras };