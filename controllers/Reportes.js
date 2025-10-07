const Reporte = require('../models/Reportes');
const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const ExcelJS = require("exceljs");
const moment = require('moment');
require('moment/locale/es');
const fs = require('fs');
const path = require('path');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');

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

    const inicioReporte = moment.utc(fechaInicio, "YYYY-MM-DD").startOf("day");
    const finReporte = moment.utc(fechaFin, "YYYY-MM-DD").endOf("day");

    if (!inicioReporte.isValid() || !finReporte.isValid()) {
      return res.status(400).json({ mensaje: "Formato de fecha inválido. Use YYYY-MM-DD." });
    }

    const periodo = calcularPeriodo(inicioReporte.toDate(), finReporte.toDate());

    // Limpiar reportes existentes
    const deleteQuery = { fechaInicioReporte: { $gte: inicioReporte.toDate() }, fechaFinReporte: { $lte: finReporte.toDate() } };
    if (tipoOperario) deleteQuery.tipoOperario = tipoOperario;
    await Reporte.deleteMany(deleteQuery);

    // Obtener funcionarios
    const filtroFuncionarios = {};
    if (tipoOperario) filtroFuncionarios.tipoOperario = tipoOperario;

    // Excluir inactivos
    filtroFuncionarios.estado = { $ne: 'Inactivo' };

    const todosLosFuncionarios = await Funcionario.find(filtroFuncionarios);
    if (todosLosFuncionarios.length === 0) {
      return res.json({ success: true, data: [], mensaje: "No se encontraron funcionarios activos." });
    }


    // Inicializar mapa de reportes
    const reportesMap = new Map();
    todosLosFuncionarios.forEach(f => {
      reportesMap.set(f._id.toString(), {
        identificacion_Funcionario: f.identificacion_completa || f.identificacion || "",
        nombre_Funcionario: f.nombre_completo || "",
        estado: f.estado || "",
        tipoOperario: f.tipoOperario || "",
        HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
      });
    });

    const idsDeFuncionarios = todosLosFuncionarios.map(f => f._id);

    // Buscar turnos en el rango de fechas
    const filtroHorasExtras = {
      FuncionarioAsignado: { $in: idsDeFuncionarios },
      fecha_inicio_trabajo: { $gte: inicioReporte.toDate(), $lte: finReporte.toDate() }
    };

    const extrasEncontradas = await HorasExtras.find(filtroHorasExtras);

    // Sumar las horas extras directamente
    extrasEncontradas.forEach(e => {
      const funcionarioEnMapa = reportesMap.get(e.FuncionarioAsignado.toString());
      if (funcionarioEnMapa) {
        funcionarioEnMapa.HEDO += convertirHorasAMinutos(e.HEDO || '00:00');
        funcionarioEnMapa.HENO += convertirHorasAMinutos(e.HENO || '00:00');
        funcionarioEnMapa.HEDF += convertirHorasAMinutos(e.HEDF || '00:00');
        funcionarioEnMapa.HENF += convertirHorasAMinutos(e.HENF || '00:00');
        funcionarioEnMapa.HDF += convertirHorasAMinutos(e.HDF || '00:00');
        funcionarioEnMapa.HNF += convertirHorasAMinutos(e.HNF || '00:00');
        funcionarioEnMapa.RNO += convertirHorasAMinutos(e.RNO || '00:00');
      }
    });

    // Generar reportes
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

    if (reportesAGuardar.length > 0) {
      await Reporte.insertMany(reportesAGuardar);
    }

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

    // CORRECCIÓN: Usar el mismo formato de fecha que en crearReporte
    const inicioReporte = moment.utc(fechaInicio, "YYYY-MM-DD").startOf("day");
    const finReporte = moment.utc(fechaFin, "YYYY-MM-DD").endOf("day");

    if (!inicioReporte.isValid() || !finReporte.isValid()) {
      return res.status(400).json({ mensaje: "Formato de fecha inválido. Use YYYY-MM-DD." });
    }

    const filtroFuncionarios = {};
    if (tipoOperario) filtroFuncionarios.tipoOperario = tipoOperario;

    // Excluir inactivos
    filtroFuncionarios.estado = { $ne: 'Inactivo' };

    const todosLosFuncionarios = await Funcionario.find(filtroFuncionarios);
    if (todosLosFuncionarios.length === 0) {
      return res.json({ success: true, data: [], mensaje: "No se encontraron funcionarios activos." });
    }

    const reportesMap = new Map();
    todosLosFuncionarios.forEach(f => {
      reportesMap.set(f._id.toString(), {
        identificacion_Funcionario: f.identificacion_completa || f.identificacion || "",
        nombre_Funcionario: f.nombre_completo || "",
        HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
      });
    });

    // CORRECCIÓN: Usar la misma lógica de filtrado que en crearReporte
    const idsDeFuncionarios = todosLosFuncionarios.map(f => f._id);
    const filtroHorasExtras = {
      FuncionarioAsignado: { $in: idsDeFuncionarios },
      fecha_inicio_trabajo: { $gte: inicioReporte.toDate(), $lte: finReporte.toDate() }
    };

    const extrasEncontradas = await HorasExtras.find(filtroHorasExtras);

    // CORRECCIÓN: Sumar las horas extras directamente (igual que en crearReporte)
    extrasEncontradas.forEach(e => {
      const funcionarioEnMapa = reportesMap.get(e.FuncionarioAsignado.toString());
      if (funcionarioEnMapa) {
        funcionarioEnMapa.HEDO += convertirHorasAMinutos(e.HEDO || '00:00');
        funcionarioEnMapa.HENO += convertirHorasAMinutos(e.HENO || '00:00');
        funcionarioEnMapa.HEDF += convertirHorasAMinutos(e.HEDF || '00:00');
        funcionarioEnMapa.HENF += convertirHorasAMinutos(e.HENF || '00:00');
        funcionarioEnMapa.HDF += convertirHorasAMinutos(e.HDF || '00:00');
        funcionarioEnMapa.HNF += convertirHorasAMinutos(e.HNF || '00:00');
        funcionarioEnMapa.RNO += convertirHorasAMinutos(e.RNO || '00:00');
      }
    });

    const reportesFinales = Array.from(reportesMap.values());

    if (reportesFinales.length === 0) {
      return res.status(404).json({ mensaje: "Ningún funcionario registró horas en el período seleccionado." });
    }

    reportesFinales.sort((a, b) => a.nombre_Funcionario.localeCompare(b.nombre_Funcionario));
    console.log(`Turnos encontrados: ${extrasEncontradas.length}`);

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

    // --- 2. CABECERAS DE MÚLTIPLES NIVELES ---
    const headerRow4 = worksheet.getRow(4);
    headerRow4.height = 20;
    const headerRow5 = worksheet.getRow(5);
    headerRow5.height = 20;

    worksheet.getCell('A4').value = "Cédula";
    worksheet.getCell('B4').value = "Nombre del funcionario";
    worksheet.getCell('C4').value = "Tiempo Extra (HH:MM)";
    worksheet.getCell('G4').value = "Tiempo Suplementario (HH:MM)";
    worksheet.getCell('J4').value = "Conversion Decimal";
    worksheet.getCell('Q4').value = "Total Extras (DEC)";

    headerRow5.values = [
      "", "",
      "HEDO", "HENO", "HEDF", "HENF",
      "HDF", "HNF", "RNO",
      "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO",
      ""
    ];

    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
    worksheet.mergeCells('C4:F4'); worksheet.mergeCells('G4:I4');
    worksheet.mergeCells('J4:P4'); worksheet.mergeCells('Q4:Q5');

    const bordeBlanco = { style: 'thin', color: { argb: '#FFFFFF' } };
    [headerRow4, headerRow5].forEach(row => {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: bordeBlanco, left: bordeBlanco, bottom: bordeBlanco, right: bordeBlanco };
      });
    });

    // --- 3. Datos de la Tabla ---
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

    // --- 4. Anchos de Columna y Vista Congelada ---
    worksheet.columns = [
      { width: 18 }, { width: 40 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
      { width: 12 }, { width: 12 }, { width: 12 },
      { width: 18 }
    ];

    // --- 5. Envío del Archivo ---
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Reporte_${tipoOperario}_${fechaInicio}_${fechaFin}.xlsx`
    );

    await workbook.xlsx.write(res);
    console.log("Respuesta "+res);
    
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