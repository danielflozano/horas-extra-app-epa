const Reporte = require('../models/Reportes');
const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios'); // Se necesita para el filtro correcto
const ExcelJS = require("exceljs");
const moment = require('moment');
require('moment/locale/es');

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

// ===================================================================================
// CONTROLADOR PARA CREAR/GUARDAR EL REPORTE (SIN CAMBIOS)
// ===================================================================================
async function crearReporte(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });
    }

    const inicio = moment(fechaInicio, "DD/MM/YYYY").startOf('day').toDate();
    const fin = moment(fechaFin, "DD/MM/YYYY").endOf('day').toDate();
    const periodo = calcularPeriodo(inicio, fin);

    const deleteQuery = { fechaInicioReporte: { $gte: inicio }, fechaFinReporte: { $lte: fin }};
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
    
    const reportesAGuardar = [];
    for (const r of reportesMap.values()) {
      const totalMinutosRegistrados = r.HEDO + r.HENO + r.HEDF + r.HENF + r.HDF + r.HNF + r.RNO;
      if (totalMinutosRegistrados > 0) {
        const totalExtrasMin = r.HEDO + r.HENO + r.HEDF + r.HENF;
        const reporteItem = {
          identificacion_Funcionario: r.identificacion_Funcionario,
          nombre_Funcionario: r.nombre_Funcionario,
          fechaInicioReporte: inicio, fechaFinReporte: fin, tipoOperario: r.tipoOperario, periodo,
          HEDO_HORA: minutosAHHMM(r.HEDO), HENO_HORA: minutosAHHMM(r.HENO),
          HEDF_HORA: minutosAHHMM(r.HEDF), HENF_HORA: minutosAHHMM(r.HENF),
          HDF_HORA: minutosAHHMM(r.HDF), HNF_HORA: minutosAHHMM(r.HNF),
          RNO_HORA: minutosAHHMM(r.RNO),
          HEDO_DEC: parseFloat((r.HEDO / 60).toFixed(2)), HENO_DEC: parseFloat((r.HENO / 60).toFixed(2)),
          HEDF_DEC: parseFloat((r.HEDF / 60).toFixed(2)), HENF_DEC: parseFloat((r.HENF / 60).toFixed(2)),
          HDF_DEC: parseFloat((r.HDF / 60).toFixed(2)), HNF_DEC: parseFloat((r.HNF / 60).toFixed(2)),
          RNO_DEC: parseFloat((r.RNO / 60).toFixed(2)),
          totalExtras_DEC: parseFloat((totalExtrasMin / 60).toFixed(2)),
        };
        reportesAGuardar.push(reporteItem);
      }
    }
    
    if (reportesAGuardar.length === 0) {
        return res.json({ success: true, data: [], mensaje: "Ningún funcionario registró horas en el período seleccionado." });
    }

    await Reporte.insertMany(reportesAGuardar);
    res.json({ success: true, data: reportesAGuardar });

  } catch (err) {
    console.error("Error en crearReporte:", err);
    res.status(500).json({ success: false, mensaje: "Error creando el reporte", error: err.message });
  }
}

// ===================================================================================
// CONTROLADOR PARA EXPORTAR A EXCEL (VERSIÓN INDEPENDIENTE Y ROBUSTA)
// ===================================================================================
async function exportarReporteExcel(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });
    }

    const inicio = moment(fechaInicio, "DD/MM/YYYY").startOf('day').toDate();
    const fin = moment(fechaFin, "DD/MM/YYYY").endOf('day').toDate();
    
    // --- LÓGICA DE CÁLCULO DIRECTA (YA NO DEPENDE DE 'crearReporte') ---
    
    // 1. OBTENER LA LISTA COMPLETA DE FUNCIONARIOS PRIMERO
    const filtroFuncionarios = {};
    if (tipoOperario) {
      filtroFuncionarios.tipoOperario = tipoOperario;
    }
    const todosLosFuncionarios = await Funcionario.find(filtroFuncionarios);

    if (todosLosFuncionarios.length === 0) {
      return res.status(404).json({ mensaje: "No se encontraron funcionarios para los criterios seleccionados." });
    }

    // 2. CREAR UN MAPA INICIAL CON TODOS LOS FUNCIONARIOS Y SUS HORAS EN CERO
    const reportesMap = new Map();
    todosLosFuncionarios.forEach(f => {
      reportesMap.set(f._id.toString(), {
        identificacion_Funcionario: f.identificacion_completa || f.identificacion || "",
        nombre_Funcionario: f.nombre_completo || "",
        HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
      });
    });

    // 3. BUSCAR LAS HORAS EXTRAS Y SUMARLAS AL MAPA
    const idsDeFuncionarios = todosLosFuncionarios.map(f => f._id);
    const filtroHorasExtras = {
      fecha_inicio_trabajo: { $lte: fin },
      fecha_fin_trabajo: { $gte: inicio },
      FuncionarioAsignado: { $in: idsDeFuncionarios }
    };
    const extrasEncontradas = await HorasExtras.find(filtroHorasExtras);

    extrasEncontradas.forEach(e => {
      const id = e.FuncionarioAsignado.toString();
      const funcionarioEnMapa = reportesMap.get(id);
      if (funcionarioEnMapa) {
        funcionarioEnMapa.HEDO += convertirHorasAMinutos(e.HEDO);
        funcionarioEnMapa.HENO += convertirHorasAMinutos(e.HENO);
        // ... (y así para todas las demás horas)
        funcionarioEnMapa.HEDF += convertirHorasAMinutos(e.HEDF);
        funcionarioEnMapa.HENF += convertirHorasAMinutos(e.HENF);
        funcionarioEnMapa.HDF += convertirHorasAMinutos(e.HDF);
        funcionarioEnMapa.HNF += convertirHorasAMinutos(e.HNF);
        funcionarioEnMapa.RNO += convertirHorasAMinutos(e.RNO);
      }
    });

    // 4. FILTRAR LOS FUNCIONARIOS QUE TIENEN TODO EN CERO
    const reportesFinales = [];
    for (const r of reportesMap.values()) {
        const totalMinutos = r.HEDO + r.HENO + r.HEDF + r.HENF + r.HDF + r.HNF + r.RNO;
        if (totalMinutos > 0) {
            reportesFinales.push(r);
        }
    }
    
    if (reportesFinales.length === 0) {
      return res.status(404).json({ mensaje: "Ningún funcionario registró horas en el período seleccionado." });
    }
    
    reportesFinales.sort((a, b) => a.nombre_Funcionario.localeCompare(b.nombre_Funcionario));

    // --- CONSTRUCCIÓN DEL EXCEL ---
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Horas Extras");

    const mes = moment(inicio).locale('es').format('MMMM').toUpperCase();
    const anio = moment(inicio).format('YYYY');
    const titulo = `REPORTE DE TIEMPO EXTRA Y SUPLEMENTARIO - ${mes} ${anio}`;
    const subtitulo = `Período consultado: del ${moment(inicio).format("DD/MM/YYYY")} al ${moment(fin).format("DD/MM/YYYY")}`;

    const titleRow = worksheet.addRow([titulo]);
    worksheet.mergeCells('A1:Q1');
    titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
    const subtitleRow = worksheet.addRow([subtitulo]);
    worksheet.mergeCells('A2:Q2');
    subtitleRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true };
    subtitleRow.getCell(1).alignment = { horizontal: 'center' };
    worksheet.addRow([]);
    worksheet.getCell('A4').value = "Cedula de Ciudadania No.";
    worksheet.getCell('B4').value = "Nombre del funcionario";
    worksheet.getCell('C4').value = "Tiempo Extra (HH:MM)";
    worksheet.getCell('G4').value = "Tiempo Suplementario (HH:MM)";
    worksheet.getCell('J4').value = "Conversion Decimal";
    worksheet.getCell('Q4').value = "TOTAL EXTRAS";
    const subheaders = ["HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO", "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO"];
    worksheet.getRow(5).values = ["", "", ...subheaders];
    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
    worksheet.mergeCells('C4:F4'); worksheet.mergeCells('G4:I4');
    worksheet.mergeCells('J4:P4');
    worksheet.mergeCells('Q4:Q5');

    const thickRightBorder = { style: 'medium' };
    for (let i = 4; i <= 5; i++) {
        const row = worksheet.getRow(i);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { name: 'Calibri', bold: true, size: 10 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }};
            if ([2, 6, 9, 16].includes(colNumber)) { cell.border.right = thickRightBorder; }
        });
    }

    reportesFinales.forEach(r => {
      const totalExtrasMin = r.HEDO + r.HENO + r.HEDF + r.HENF;
      worksheet.addRow([
        r.identificacion_Funcionario, r.nombre_Funcionario,
        minutosAHHMM(r.HEDO), minutosAHHMM(r.HENO), minutosAHHMM(r.HEDF), minutosAHHMM(r.HENF),
        minutosAHHMM(r.HDF), minutosAHHMM(r.HNF), minutosAHHMM(r.RNO),
        parseFloat((r.HEDO / 60).toFixed(2)), parseFloat((r.HENO / 60).toFixed(2)),
        parseFloat((r.HEDF / 60).toFixed(2)), parseFloat((r.HENF / 60).toFixed(2)),
        parseFloat((r.HDF / 60).toFixed(2)), parseFloat((r.HNF / 60).toFixed(2)),
        parseFloat((r.RNO / 60).toFixed(2)),
        parseFloat((totalExtrasMin / 60).toFixed(2)),
      ]).eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }};
        if ([2, 6, 9, 16].includes(colNumber)) { cell.border.right = thickRightBorder; }
      });
    });

    worksheet.columns = [
      { width: 18 }, { width: 40 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 18 }
    ];

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_Horas_Extras_${moment().format('YYYYMMDD_HHmmss')}.xlsx`);
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