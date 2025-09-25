const moment = require('moment');
const Funcionario = require('../models/Funcionarios');

async function calcularHorasExtras(data) {
  try {
    console.log('🔍 Datos recibidos en calcularHorasExtras:', data);

    const {
      fecha_inicio_trabajo, hora_inicio_trabajo,
      fecha_fin_trabajo, hora_fin_trabajo,
      fecha_inicio_descanso, hora_inicio_descanso,
      fecha_fin_descanso, hora_fin_descanso,
      es_festivo_Inicio, es_festivo_Fin,
      FuncionarioAsignado
    } = data;

    // VALIDACIÓN 1: Verificar datos obligatorios
    if (!fecha_inicio_trabajo || !hora_inicio_trabajo || !fecha_fin_trabajo || !hora_fin_trabajo) {
      const error = `Faltan datos obligatorios: fecha_inicio=${fecha_inicio_trabajo}, hora_inicio=${hora_inicio_trabajo}, fecha_fin=${fecha_fin_trabajo}, hora_fin=${hora_fin_trabajo}`;
      console.error('❌', error);
      return { success: false, message: error };
    }

    // VALIDACIÓN 2: Verificar que FuncionarioAsignado existe
    if (!FuncionarioAsignado) {
      const error = "FuncionarioAsignado no proporcionado";
      console.error('❌', error);
      return { success: false, message: error };
    }

    const funcionario = await Funcionario.findById(FuncionarioAsignado);
    if (!funcionario) {
      const error = `Funcionario no encontrado en la BD con ID: ${FuncionarioAsignado}`;
      console.error('❌', error);
      return { success: false, message: error };
    }
    
    const tipo = (funcionario.tipoOperario || 'planta').toLowerCase();
    console.log(`👤 Funcionario encontrado: ${funcionario.nombre_completo}, tipo: ${tipo}`);

    // VALIDACIÓN 3: Verificar formato de fechas y horas antes de crear moment
    const fechaInicioValida = moment(fecha_inicio_trabajo, 'YYYY-MM-DD', true).isValid();
    const fechaFinValida = moment(fecha_fin_trabajo, 'YYYY-MM-DD', true).isValid();
    const horaInicioValida = moment(hora_inicio_trabajo, 'HH:mm', true).isValid();
    const horaFinValida = moment(hora_fin_trabajo, 'HH:mm', true).isValid();

    if (!fechaInicioValida || !fechaFinValida || !horaInicioValida || !horaFinValida) {
      const error = `Formato de fecha/hora inválido: fecha_inicio_valida=${fechaInicioValida}, fecha_fin_valida=${fechaFinValida}, hora_inicio_valida=${horaInicioValida}, hora_fin_valida=${horaFinValida}`;
      console.error('❌', error);
      return { success: false, message: error };
    }

    // CREACIÓN SEGURA DE MOMENTOS
    let inicioTotal, finTotal;
    try {
      inicioTotal = moment.utc(`${fecha_inicio_trabajo}T${hora_inicio_trabajo}`);
      finTotal = moment.utc(`${fecha_fin_trabajo}T${hora_fin_trabajo}`);
      
      if (!inicioTotal.isValid() || !finTotal.isValid()) {
        throw new Error(`Momentos inválidos: inicio=${inicioTotal.isValid()}, fin=${finTotal.isValid()}`);
      }
      
      console.log(`📅 Inicio: ${inicioTotal.format()}, Fin: ${finTotal.format()}`);
    } catch (momentError) {
      const error = `Error creando momentos: ${momentError.message}`;
      console.error('❌', error);
      return { success: false, message: error };
    }

    // VALIDACIÓN 4: Verificar que el rango de tiempo es lógico
    if (finTotal.isBefore(inicioTotal)) {
      finTotal.add(1, 'day');
      console.log('🔄 Ajustando fin de trabajo al día siguiente');
    }

    // Verificar que la diferencia no sea excesiva (más de 24 horas es sospechoso)
    const diferenciaHoras = finTotal.diff(inicioTotal, 'hours');
    if (diferenciaHoras > 24) {
      const error = `Rango de tiempo sospechoso: ${diferenciaHoras} horas`;
      console.error('❌', error);
      return { success: false, message: error };
    }

    // VALIDACIÓN Y PROCESAMIENTO DE DESCANSOS
    let descansoInicio = null;
    let descansoFin = null;
    
    if (fecha_inicio_descanso && hora_inicio_descanso) {
      try {
        if (moment(fecha_inicio_descanso, 'YYYY-MM-DD', true).isValid() && 
            moment(hora_inicio_descanso, 'HH:mm', true).isValid()) {
          descansoInicio = moment.utc(`${fecha_inicio_descanso}T${hora_inicio_descanso}`);
          if (!descansoInicio.isValid()) {
            throw new Error('Momento de inicio de descanso inválido');
          }
        }
      } catch (descansoError) {
        console.warn('⚠️ Error en descanso inicio, continuando sin descanso:', descansoError.message);
        descansoInicio = null;
      }
    }

    if (fecha_fin_descanso && hora_fin_descanso && descansoInicio) {
      try {
        if (moment(fecha_fin_descanso, 'YYYY-MM-DD', true).isValid() && 
            moment(hora_fin_descanso, 'HH:mm', true).isValid()) {
          descansoFin = moment.utc(`${fecha_fin_descanso}T${hora_fin_descanso}`);
          if (!descansoFin.isValid()) {
            throw new Error('Momento de fin de descanso inválido');
          }
          if (descansoFin.isBefore(descansoInicio)) {
            descansoFin.add(1, 'day');
          }
        }
      } catch (descansoError) {
        console.warn('⚠️ Error en descanso fin, continuando sin descanso:', descansoError.message);
        descansoInicio = null;
        descansoFin = null;
      }
    }

    console.log(`🛌 Descanso: ${descansoInicio ? descansoInicio.format() : 'Sin inicio'} - ${descansoFin ? descansoFin.format() : 'Sin fin'}`);
    
    let horas = { HDO: 0, HNO: 0, HEDO: 0, HENO: 0, HDF: 0, HNF: 0, HEDF: 0, HENF: 0, RNO: 0 };
    let totalMinutosTrabajados = 0;
    let totalMinutosDescanso = 0;
    let es_fin_de_semana = false;
    
    const limiteOrdinarias = (tipo === 'temporal') ? 440 : 480;
    console.log(`⏱️ Límite ordinarias para ${tipo}: ${limiteOrdinarias} minutos`);
    
    // VALIDACIÓN DEL BUCLE: Evitar bucles infinitos
    let cursor = inicioTotal.clone();
    let iteraciones = 0;
    const maxIteraciones = 24 * 60; // Máximo 24 horas de iteraciones
    
    while (cursor.isBefore(finTotal) && iteraciones < maxIteraciones) {
      iteraciones++;
      
      const enDescanso = descansoInicio && descansoFin && 
                        cursor.isSameOrAfter(descansoInicio) && 
                        cursor.isBefore(descansoFin);
      
      if (enDescanso) {
        totalMinutosDescanso++;
      } else {
        const diaSemana = cursor.isoWeekday();
        const hora = cursor.hour();
        
        // VALIDACIÓN SEGURA DE FESTIVOS
        let esFestivo = false;
        try {
          esFestivo = (cursor.isSame(moment.utc(fecha_inicio_trabajo), 'day') && es_festivo_Inicio) || 
                     (cursor.isSame(moment.utc(finTotal.clone().subtract(1, 'minute')), 'day') && es_festivo_Fin);
        } catch (festivoError) {
          console.warn('⚠️ Error verificando festivo:', festivoError.message);
          esFestivo = false;
        }
        
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
        
        if (esNocturno && esOrdinario && diaSemana !== 7 && !esFestivo) {
            horas.RNO++;
        }
        
        totalMinutosTrabajados++;
      }
      cursor.add(1, 'minute');
    }

    // VALIDACIÓN: Verificar que no se excedió el límite de iteraciones
    if (iteraciones >= maxIteraciones) {
      const error = `Bucle excedió límite de iteraciones (${maxIteraciones}). Posible bucle infinito.`;
      console.error('❌', error);
      return { success: false, message: error };
    }

    console.log(`📊 Iteraciones completadas: ${iteraciones}, Minutos trabajados: ${totalMinutosTrabajados}`);
    
    // AJUSTE DE HORAS FALTANTES
    let horaFinAjustada = null;
    let fechaFinAjustada = null;
    const limiteParaCompletar = (tipo === 'planta') ? 480 : 440;

    if (totalMinutosTrabajados > 0 && totalMinutosTrabajados < limiteParaCompletar) {
        const minutosFaltantes = limiteParaCompletar - totalMinutosTrabajados;
        console.log(`⚠️ Faltan ${minutosFaltantes} minutos para completar jornada`);
        
        try {
          const ultimoMinuto = finTotal.clone().subtract(1, 'minute');
          const esNocturno = ultimoMinuto.hour() >= 18 || ultimoMinuto.hour() < 6;
          const esFestivoODominical = ultimoMinuto.isoWeekday() === 7 || 
                                     (ultimoMinuto.isSame(moment.utc(finTotal.clone().subtract(1, 'minute')), 'day') && es_festivo_Fin);

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
        } catch (ajusteError) {
          console.warn('⚠️ Error en ajuste de horas, continuando sin ajuste:', ajusteError.message);
        }
    }

    // FUNCIÓN HELPER SEGURA
    const aHHMM = (min) => {
      if (typeof min !== 'number' || isNaN(min) || min < 0) {
        console.warn(`⚠️ Valor de minutos inválido: ${min}, usando 0`);
        min = 0;
      }
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    };

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

    console.log('✅ Cálculo completado exitosamente');
    return resultado;
    
  } catch (error) {
    const errorMsg = `Error en calcularHorasExtras: ${error.message}`;
    console.error("❌", errorMsg, error.stack);
    return { success: false, message: errorMsg };
  }
}


module.exports = { calcularHorasExtras };