const Reporte = require('../models/Reportes');
const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const ExcelJS = require("exceljs");
const moment = require('moment');
require('moment/locale/es');
const fs = require('fs');
const path = require('path');
const {calcularHorasExtras} = require('../helpers/CalculoHoras');

// --- Funciones de utilidad (sin cambios) ---
function convertirHorasAMinutos(hora) {
  if (!hora || typeof hora !== "string") return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function minutosAHHMM(minutos) {
  if (isNaN(minutos)) return "00:00";
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}
function calcularPeriodo(fechaInicio, fechaFin) {
  const dias = moment(fechaFin).diff(moment(fechaInicio), 'days') + 1;
  if (dias <= 16) return 'Quincenal';
  if (dias <= 31) return 'Mensual';
  return 'Anual';
}

async function crearReporte(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });
    }

    const inicioReporte = moment.utc(fechaInicio, "YYYY/MM/DD").startOf("day"); // Cambie el formato de la fecha porque lo pedia DD/MM/YYYY
    const finReporte = moment.utc(fechaFin, "YYYY/MM/DD").endOf("day");

    if (!inicioReporte.isValid() || !finReporte.isValid()) {
      return res.status(400).json({ mensaje: "Formato de fecha inválido. Use YYYY/MM/DD" });
    }

    const periodo = calcularPeriodo(inicioReporte.toDate(), finReporte.toDate());

    const deleteQuery = { fechaInicioReporte: { $gte: inicioReporte.toDate() }, fechaFinReporte: { $lte: finReporte.toDate() } };
    if (tipoOperario) deleteQuery.tipoOperario = tipoOperario;
    await Reporte.deleteMany(deleteQuery);

    const filtroFuncionarios = {};
    if (tipoOperario) filtroFuncionarios.tipoOperario = tipoOperario;
    const todosLosFuncionarios = await Funcionario.find(filtroFuncionarios);

    if (todosLosFuncionarios.length === 0) {
      return res.json({ success: true, data: [], mensaje: "No se encontraron funcionarios." });
    }

    const reportesMap = new Map();
    todosLosFuncionarios.forEach(f => {
      reportesMap.set(f._id.toString(), {
        identificacion_Funcionario: f.identificacion_completa || f.identificacion || "",
        nombre_Funcionario: f.nombre_completo || "",
        tipoOperario: f.tipoOperario || "",
        HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
      });
    });

    const idsDeFuncionarios = todosLosFuncionarios.map(f => f._id);
    const filtroHorasExtras = {
      fecha_inicio_trabajo: { $lte: finReporte.toDate() },
      fecha_fin_trabajo: { $gte: inicioReporte.toDate() },
      FuncionarioAsignado: { $in: idsDeFuncionarios }
    };

    const extrasEncontradas = await HorasExtras.find(filtroHorasExtras);

    // ==============================================================================
    // --- CAMBIO CLAVE: Procesar y "recortar" las horas de cada turno ---
    // ==============================================================================
    extrasEncontradas.forEach(e => {
      const id = e.FuncionarioAsignado.toString();
      const funcionarioEnMapa = reportesMap.get(id);

      if (funcionarioEnMapa) {
        // Convertir las fechas del turno a objetos moment
        let inicioTurno = moment.utc(`${e.fecha_inicio_trabajo.toISOString().split('T')[0]}T${e.hora_inicio_trabajo}`);
        let finTurno = moment.utc(`${e.fecha_fin_trabajo.toISOString().split('T')[0]}T${e.hora_fin_trabajo}`);
        if(finTurno.isBefore(inicioTurno)) finTurno.add(1, 'day');

        // "Recortar" el inicio y fin del turno para que quepa dentro del rango del reporte
        const inicioEfectivo = moment.max(inicioTurno, inicioReporte);
        const finEfectivo = moment.min(finTurno, finReporte);

        // Crear un objeto de datos "simulado" solo con el rango de fechas efectivo
        // NOTA: Esta lógica asume que tu helper `calcularHorasExtras` puede manejar esto.
        const datosTurnoRecortado = {
            fecha_inicio_trabajo: inicioEfectivo.format('YYYY-MM-DD'),
            hora_inicio_trabajo: inicioEfectivo.format('HH:mm'),
            fecha_fin_trabajo: finEfectivo.format('YYYY-MM-DD'),
            hora_fin_trabajo: finEfectivo.format('HH:mm'),
            es_festivo_Inicio: e.es_festivo_Inicio, // Se asumen los mismos festivos
            es_festivo_Fin: e.es_festivo_Fin
            // Importante: El recorte de descansos es complejo y no se incluye aquí.
            // Los descansos que caen fuera del rango efectivo se ignorarán por `calcularHorasExtras`.
        };
        
        // Se vuelven a calcular las horas DESPUÉS de haber recortado el turno
        const calculos = calcularHorasExtras(datosTurnoRecortado);

        // Se suman las horas ya calculadas y recortadas al mapa
        funcionarioEnMapa.HEDO += convertirHorasAMinutos(calculos.HEDO || "00:00");
        funcionarioEnMapa.HENO += convertirHorasAMinutos(calculos.HENO || "00:00");
        funcionarioEnMapa.HEDF += convertirHorasAMinutos(calculos.HEDF || "00:00");
        funcionarioEnMapa.HENF += convertirHorasAMinutos(calculos.HENF || "00:00");
        funcionarioEnMapa.HDF += convertirHorasAMinutos(calculos.HDF || "00:00");
        funcionarioEnMapa.HNF += convertirHorasAMinutos(calculos.HNF || "00:00");
        funcionarioEnMapa.RNO += convertirHorasAMinutos(calculos.RNO || "00:00");
      }
    });

    // El resto de la función para construir y guardar el reporte no cambia...
    const reportesAGuardar = [];
    for (const r of reportesMap.values()) {
        
            const totalExtrasMin = r.HEDO + r.HENO + r.HEDF + r.HENF;
            reportesAGuardar.push({
                identificacion_Funcionario: r.identificacion_Funcionario,
                nombre_Funcionario: r.nombre_Funcionario,
                fechaInicioReporte: inicioReporte.toDate(),
                fechaFinReporte: finReporte.toDate(),
                tipoOperario: r.tipoOperario,
                periodo,
                HEDO_HORA: minutosAHHMM(r.HEDO), HENO_HORA: minutosAHHMM(r.HENO),
                HEDF_HORA: minutosAHHMM(r.HEDF), HENF_HORA: minutosAHHMM(r.HENF),
                HDF_HORA: minutosAHHMM(r.HDF), HNF_HORA: minutosAHHMM(r.HNF),
                RNO_HORA: minutosAHHMM(r.RNO),
                HEDO_DEC: parseFloat((r.HEDO / 60).toFixed(2)),
                HENO_DEC: parseFloat((r.HENO / 60).toFixed(2)),
                HEDF_DEC: parseFloat((r.HEDF / 60).toFixed(2)),
                HENF_DEC: parseFloat((r.HENF / 60).toFixed(2)),
                HDF_DEC: parseFloat((r.HDF / 60).toFixed(2)),
                HNF_DEC: parseFloat((r.HNF / 60).toFixed(2)),
                RNO_DEC: parseFloat((r.RNO / 60).toFixed(2)),
                totalExtras_DEC: parseFloat((totalExtrasMin / 60).toFixed(2)),
            });
        }

      await Reporte.insertMany(reportesAGuardar);
  

    res.json({ success: true, data: reportesAGuardar });

  } catch (err) {
    console.error("Error en crearReporte:", err);
    res.status(500).json({ success: false, mensaje: "Error creando el reporte", error: err.message });
  }
}



async function exportarReporteExcel(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });
    }

    const inicio = moment(fechaInicio, "YYYY/MM/DD").startOf('day').toDate();
    const fin = moment(fechaFin, "YYYY/MM/DD").endOf('day').toDate();
    
    
    // --- LÓGICA DE CÁLCULO (SIN CAMBIOS) ---
    const filtroFuncionarios = {};
    if (tipoOperario) filtroFuncionarios.tipoOperario = tipoOperario;
    const todosLosFuncionarios = await Funcionario.find(filtroFuncionarios);

    if (todosLosFuncionarios.length === 0) {
      return res.status(404).json({ mensaje: "No se encontraron funcionarios." });
    }

    const reportesMap = new Map();
    todosLosFuncionarios.forEach(f => {
      reportesMap.set(f._id.toString(), {
        identificacion_Funcionario: f.identificacion_completa || f.identificacion || "",
        nombre_Funcionario: f.nombre_completo || "",
        HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
      });
    });

    const idsDeFuncionarios = todosLosFuncionarios.map(f => f._id);
    const filtroHorasExtras = {
      fecha_inicio_trabajo: { $lte: fin }, fecha_fin_trabajo: { $gte: inicio },
      FuncionarioAsignado: { $in: idsDeFuncionarios }
    };
    const extrasEncontradas = await HorasExtras.find(filtroHorasExtras);

    extrasEncontradas.forEach(e => {
      const id = e.FuncionarioAsignado.toString();
      const funcionarioEnMapa = reportesMap.get(id);
      if (funcionarioEnMapa) {
        funcionarioEnMapa.HEDO += convertirHorasAMinutos(e.HEDO);
        funcionarioEnMapa.HENO += convertirHorasAMinutos(e.HENO);
        funcionarioEnMapa.HEDF += convertirHorasAMinutos(e.HEDF);
        funcionarioEnMapa.HENF += convertirHorasAMinutos(e.HENF);
        funcionarioEnMapa.HDF += convertirHorasAMinutos(e.HDF);
        funcionarioEnMapa.HNF += convertirHorasAMinutos(e.HNF);
        funcionarioEnMapa.RNO += convertirHorasAMinutos(e.RNO);
      }
    });

    const reportesFinales = [];
    for (const r of reportesMap.values()) {
            reportesFinales.push(r);
      
    }
    
    if (reportesFinales.length === 0) {
      return res.status(404).json({ mensaje: "Ningún funcionario registró horas en el período seleccionado." });
    }
    
    reportesFinales.sort((a, b) => a.nombre_Funcionario.localeCompare(b.nombre_Funcionario));

    // --- CONSTRUCCIÓN DEL EXCEL ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Horas Extras");

    // 1. Encabezado del Reporte (Logo, Títulos, Fecha)
    worksheet.getRow(1).height = 45;
    const logoPath = path.join(__dirname, '../public/LOGOEPA.png');
    if (fs.existsSync(logoPath)) {
        const logoId = workbook.addImage({ buffer: fs.readFileSync(logoPath), extension: 'png' });
        worksheet.addImage(logoId, { tl: { col: 0.5, row: 0.2 }, ext: { width: 140, height: 60 } });
    }
    
    worksheet.mergeCells('D1:N1');
    const titleCell = worksheet.getCell('D1');
    titleCell.value = 'Reporte Horas Extras';
    titleCell.font = { name: 'Calibri', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.mergeCells('O1:Q1');
    const generatedCell = worksheet.getCell('O1');
    generatedCell.value = `Generado:\n${moment().format('DD/MM/YYYY HH:mm')}`;
    generatedCell.font = { name: 'Calibri', size: 10, bold: true, italic: true };
    generatedCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

    worksheet.getRow(2).height = 25;
    const subtitulo = `Período consultado: del ${fechaInicio} al ${fechaFin}`;
    worksheet.mergeCells('A2:S2');
    const subtitleCell = worksheet.getCell('A2');
    subtitleCell.value = subtitulo;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getRow(3).height = 15;

    // --- 2. CABECERAS DE MÚLTIPLES NIVELES (RESTAURADO) ---
    const headerRow4 = worksheet.getRow(4);
    headerRow4.height = 20;
    const headerRow5 = worksheet.getRow(5);
    headerRow5.height = 20;

    // Asignar valores a las celdas principales de la fila 4
    worksheet.getCell('A4').value = "Cédula";
    worksheet.getCell('B4').value = "Nombre del funcionario";
    worksheet.getCell('C4').value = "Tiempo Extra (HH:MM)";
    worksheet.getCell('G4').value = "Tiempo Suplementario (HH:MM)";
    worksheet.getCell('J4').value = "Conversion Decimal";
    worksheet.getCell('Q4').value = "Total Extras (DEC)";
    
    // Asignar valores a la fila 5 (sub-cabeceras)
    headerRow5.values = [
        "", "", // A5, B5 vacías para el merge
        "HEDO", "HENO", "HEDF", "HENF", // C5 a F5
        "HDF", "HNF", "RNO",           // G5 a I5
        "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO", 
        "" 
    ];

    // Realizar fusiones de celdas
    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
    worksheet.mergeCells('C4:F4'); worksheet.mergeCells('G4:I4');
    worksheet.mergeCells('J4:P4'); worksheet.mergeCells('Q4:Q5');

    // Aplicar estilos a todas las celdas de las dos filas de cabecera
    const bordeBlanco = { style: 'thin', color: { argb: '#FFFFFF' } };
    [headerRow4, headerRow5].forEach(row => {
        row.eachCell({ includeEmpty: true }, cell => {
            cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = { top: bordeBlanco, left: bordeBlanco, bottom: bordeBlanco, right: bordeBlanco };
        });
    });

    // 3. Datos de la Tabla (empiezan en la fila 6)
    reportesFinales.forEach((r, index) => {
      const totalExtrasMin = r.HEDO + r.HENO + r.HEDF + r.HENF;
      const dataRow = worksheet.addRow([
        r.identificacion_Funcionario, r.nombre_Funcionario,
        minutosAHHMM(r.HEDO), minutosAHHMM(r.HENO), minutosAHHMM(r.HEDF), minutosAHHMM(r.HENF),
        minutosAHHMM(r.HDF), minutosAHHMM(r.HNF), minutosAHHMM(r.RNO),
        parseFloat((r.HEDO / 60).toFixed(2)), parseFloat((r.HENO / 60).toFixed(2)),
        parseFloat((r.HEDF / 60).toFixed(2)), parseFloat((r.HENF / 60).toFixed(2)),
        parseFloat((r.HDF / 60).toFixed(2)), parseFloat((r.HNF / 60).toFixed(2)),
        parseFloat((r.RNO / 60).toFixed(2)),
        parseFloat((totalExtrasMin / 60).toFixed(2)),
      ]);

      const bordeNegro = { style: 'thin', color: { argb: 'FF000000' } };
      dataRow.eachCell((cell, colNumber) => {
        cell.border = { top: bordeNegro, left: bordeNegro, bottom: bordeNegro, right: bordeNegro };
        if (colNumber <= 2) {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
        } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        }
        if (index % 2 !== 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
        }
      });
    });

    // 4. Anchos de Columna y Vista Congelada
    worksheet.columns = [
      { width: 18 }, { width: 40 }, 
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, 
      { width: 12 }, { width: 12 }, { width: 12 }, 
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, 
      { width: 12 }, { width: 12 }, { width: 12 }, 
      { width: 18 }
    ];


    // 5. Envío del Archivo
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_Consolidado_Horas_${moment().format('YYYYMMDD_HHmmss')}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("Error en exportarReporteExcel:", err);
    res.status(500).json({ mensaje: "Error exportando el reporte a Excel", error: err.message });
  }
}

module.exports = {
  crearReporte,
  exportarReporteExcel
};