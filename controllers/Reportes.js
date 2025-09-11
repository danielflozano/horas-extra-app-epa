const Reporte = require('../models/Reportes');
const HorasExtras = require('../models/HorasExtras');
const ExcelJS = require("exceljs");
const moment = require('moment');
require('moment/locale/es');


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
  if (dias <= 16) {
    return 'Quincenal';
  } else if (dias <= 31) {
    return 'Mensual';
  } else {
    return 'Anual';
  }
}

// ===================================================================================
// CONTROLADOR PARA CREAR Y GUARDAR EL REPORTE EN LA BASE DE DATOS
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

    const extras = await HorasExtras.find({
      fecha_inicio_trabajo: { $gte: inicio, $lte: fin }
    }).populate({
      path: "FuncionarioAsignado",
      match: tipoOperario ? { tipoOperario } : {}
    });

    const extrasFiltrados = extras.filter(e => e.FuncionarioAsignado);
    if (!extrasFiltrados.length) {
      return res.json({ success: true, data: [], mensaje: "No hay horas extras para los criterios seleccionados" });
    }

    const reportesMap = {};
    extrasFiltrados.forEach(e => {
      const id = e.FuncionarioAsignado._id.toString();
      if (!reportesMap[id]) {
        reportesMap[id] = {
          identificacion_Funcionario: e.FuncionarioAsignado.identificacion_completa || e.FuncionarioAsignado.identificacion || "",
          nombre_Funcionario: e.FuncionarioAsignado.nombre_completo || "",
          tipoOperario: e.FuncionarioAsignado.tipoOperario || "",
          HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
        };
      }
      reportesMap[id].HEDO += convertirHorasAMinutos(e.HEDO);
      reportesMap[id].HENO += convertirHorasAMinutos(e.HENO);
      reportesMap[id].HEDF += convertirHorasAMinutos(e.HEDF);
      reportesMap[id].HENF += convertirHorasAMinutos(e.HENF);
      reportesMap[id].HDF += convertirHorasAMinutos(e.HDF);
      reportesMap[id].HNF += convertirHorasAMinutos(e.HNF);
      reportesMap[id].RNO += convertirHorasAMinutos(e.RNO);
    });

    const reportesAGuardar = [];
    for (const r of Object.values(reportesMap)) {
      const totalExtrasMin = r.HEDO + r.HENO + r.HEDF + r.HENF;
      const reporteItem = {
        identificacion_Funcionario: r.identificacion_Funcionario,
        nombre_Funcionario: r.nombre_Funcionario,
        fechaInicioReporte: inicio,
        fechaFinReporte: fin,
        tipoOperario: r.tipoOperario,
        periodo,
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
    
    await Reporte.deleteMany({ fechaInicioReporte: inicio, fechaFinReporte: fin, tipoOperario });
    await Reporte.insertMany(reportesAGuardar);
    res.json({ success: true, data: reportesAGuardar });

  } catch (err) {
    console.error("Error en crearReporte:", err);
    res.status(500).json({ success: false, mensaje: "Error creando el reporte", error: err.message });
  }
}

// ===================================================================================
// CONTROLADOR PARA EXPORTAR EL REPORTE A EXCEL
// ===================================================================================
async function exportarReporteExcel(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });
    }

    const inicio = moment(fechaInicio, "DD/MM/YYYY").startOf('day').toDate();
    const fin = moment(fechaFin, "DD/MM/YYYY").endOf('day').toDate();
    
    const query = { fechaInicioReporte: inicio, fechaFinReporte: fin };
    if (tipoOperario) query.tipoOperario = tipoOperario;
    
    const reportes = await Reporte.find(query).sort({ nombre_Funcionario: 1 });

    if (!reportes.length) {
      return res.status(404).json({ mensaje: "No hay reportes generados para esos criterios" });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Horas Extras");

    // --- TÍTULO Y SUBTÍTULO ---
    const mes = moment(inicio).locale('es').format('MMMM').toUpperCase();
    const anio = moment(inicio).format('YYYY');
    const titulo = `REPORTE DE TIEMPO EXTRA Y SUPLEMENTARIO - ${mes} ${anio}`;
    const subtitulo = `Período consultado: del ${moment(inicio).format("DD/MM/YYYY")} al ${moment(fin).format("DD/MM/YYYY")}`;

    const titleRow = worksheet.addRow([titulo]);
    worksheet.mergeCells('A1:Q1'); // Reducido a 17 columnas
    titleRow.getCell(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };

    const subtitleRow = worksheet.addRow([subtitulo]);
    worksheet.mergeCells('A2:Q2'); // Reducido a 17 columnas
    subtitleRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true };
    subtitleRow.getCell(1).alignment = { horizontal: 'center' };
    
    worksheet.addRow([]);

    // --- CABECERAS ---
    worksheet.getCell('A4').value = "Cedula de Ciudadania No.";
    worksheet.getCell('B4').value = "Nombre del funcionario";
    worksheet.getCell('C4').value = "Tiempo Extra (HH:MM)";
    worksheet.getCell('G4').value = "Tiempo Suplementario (HH:MM)";
    worksheet.getCell('J4').value = "Conversion Decimal";
    worksheet.getCell('Q4').value = "TOTAL EXTRAS"; // Un solo título para la única columna de total
    
    const subheaders = ["HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO", "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO"];
    worksheet.getRow(5).values = ["", "", ...subheaders];

    worksheet.mergeCells('A4:A5'); worksheet.mergeCells('B4:B5');
    worksheet.mergeCells('C4:F4'); worksheet.mergeCells('G4:I4');
    worksheet.mergeCells('J4:P4');
    worksheet.mergeCells('Q4:Q5'); // Fusión vertical para el único total

    const thickRightBorder = { style: 'medium' };
    for (let i = 4; i <= 5; i++) {
        const row = worksheet.getRow(i);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.font = { name: 'Calibri', bold: true, size: 10 };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }};
            if ([2, 6, 9, 16].includes(colNumber)) {
                cell.border.right = thickRightBorder;
            }
        });
    }

    // --- DATOS ---
    reportes.forEach(r => {
      const totalExtrasDEC = r.totalExtras_DEC;

      const dataRow = worksheet.addRow([
        r.identificacion_Funcionario, r.nombre_Funcionario,
        r.HEDO_HORA, r.HENO_HORA, r.HEDF_HORA, r.HENF_HORA,
        r.HDF_HORA, r.HNF_HORA, r.RNO_HORA,
        r.HEDO_DEC, r.HENO_DEC, r.HEDF_DEC, r.HENF_DEC, r.HDF_DEC, r.HNF_DEC, r.RNO_DEC,
        parseFloat(totalExtrasDEC.toFixed(2)), // Solo se añade la columna de total extras
      ]);
      dataRow.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10 };
        cell.alignment = { horizontal: 'center' };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }};
        if ([2, 6, 9, 16].includes(colNumber)) {
          cell.border.right = thickRightBorder;
        }
      });
    });

    // --- ANCHOS DE COLUMNA ---
    worksheet.columns = [
      { width: 18 }, { width: 40 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 }, { width: 9 },
      { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 }, { width: 9 },
      { width: 18 } // Solo una columna de total
    ];

    // --- ENVÍO DEL ARCHIVO ---
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_Horas_Extras_${moment().format('YYYYMMDD_HHmmss')}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err)
 {
    console.error("Error en exportarReporteExcel:", err);
    res.status(500).json({ mensaje: "Error exportando el reporte a Excel", error: err.message });
  }
}

// ===================================================================================
// EXPORTACIÓN DE LOS MÓDULOS
// ===================================================================================
module.exports = {
  crearReporte,
  exportarReporteExcel
};