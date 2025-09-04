const Reporte = require('../models/Reportes');
const HorasExtras = require('../models/HorasExtras');
const ExcelJS = require("exceljs");
const moment = require('moment');

// Convierte HH:MM a minutos
function convertirHorasAMinutos(hora) {
  if (!hora || typeof hora !== "string") return 0;
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convierte minutos a HH:mm
function minutosAHHMM(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Crear reporte JSON y guardar en DB
async function crearReporte(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body; // 👈 ahora recibimos tipoOperario también
    if (!fechaInicio || !fechaFin)
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });

    const inicio = moment(fechaInicio, "DD/MM/YYYY").startOf('day').toDate();
    const fin = moment(fechaFin, "DD/MM/YYYY").endOf('day').toDate();

    // Consulta con filtro por fechas y tipoOperario
    const extras = await HorasExtras.find({
      fecha_inicio_trabajo: { $gte: inicio },
      fecha_fin_trabajo: { $lte: fin }
    })
      .populate({
        path: "FuncionarioAsignado",
        match: tipoOperario ? { tipoOperario } : {} // 👈 si envían tipoOperario lo filtra
      });

    // Filtrar los que no tengan funcionario asignado (por el match anterior puede quedar null)
    const extrasFiltrados = extras.filter(e => e.FuncionarioAsignado);

    if (!extrasFiltrados.length)
      return res.json({ success: true, data: [], mensaje: "No hay horas extras en ese rango y tipoOperario", diasConsultados: 0 });

    const diasConsultados = Math.floor((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;

    const reportesMap = {};

    extrasFiltrados.forEach(e => {
      const id = e.FuncionarioAsignado._id.toString();

      if (!reportesMap[id]) {
        reportesMap[id] = {
          identificacion_Funcionario: e.FuncionarioAsignado.identificacion_completa || e.FuncionarioAsignado.identificacion || "",
          nombre_Funcionario: e.FuncionarioAsignado.nombre_completo || "",
          tipoOperario: e.FuncionarioAsignado.tipoOperario || "",  
          HEDO: 0, HENO: 0, HEDF: 0, HENF: 0,
          HDF: 0, HNF: 0, RNO: 0
        };
      }


      reportesMap[id].HEDO += convertirHorasAMinutos(e.horas_ordinarias_diurnas);
      reportesMap[id].HENO += convertirHorasAMinutos(e.horas_ordinarias_nocturnas);
      reportesMap[id].HEDF += convertirHorasAMinutos(e.horas_extras_diurnas);
      reportesMap[id].HENF += convertirHorasAMinutos(e.horas_extras_nocturnas);
      reportesMap[id].HDF += convertirHorasAMinutos(e.horas_dominicales_diurnas);
      reportesMap[id].HNF += convertirHorasAMinutos(e.horas_dominicales_nocturnas);
      reportesMap[id].RNO += convertirHorasAMinutos(e.recargo_nocturno);
    });

    const reportes = [];

    for (const r of Object.values(reportesMap)) {
      const totalExtras = r.HEDO + r.HENO + r.HEDF + r.HENF;
      const totalSuplementarias = r.HDF + r.HNF + r.RNO;
      const totalGeneral = totalExtras + totalSuplementarias;

      const reporteItem = {
        identificacion_Funcionario: r.identificacion_Funcionario,
        nombre_Funcionario: r.nombre_Funcionario,
        fechaInicioReporte: inicio,
        fechaFinReporte: fin,
        diasConsultados,
        tipoOperario: r.tipoOperario,
        periodo: `${moment(inicio).format("DD/MM/YYYY")} - ${moment(fin).format("DD/MM/YYYY")}`,

        // Horas en HH:MM
        HEDO_HORA: minutosAHHMM(r.HEDO),
        HENO_HORA: minutosAHHMM(r.HENO),
        HEDF_HORA: minutosAHHMM(r.HEDF),
        HENF_HORA: minutosAHHMM(r.HENF),
        HDF_HORA: minutosAHHMM(r.HDF),
        HNF_HORA: minutosAHHMM(r.HNF),
        RNO_HORA: minutosAHHMM(r.RNO),
        totalExtras_HHMM: minutosAHHMM(totalExtras),
        totalSuplementarias_HHMM: minutosAHHMM(totalSuplementarias),
        totalHoras_HHMM: minutosAHHMM(totalGeneral),

        // Horas en decimales
        HEDO_DEC: (r.HEDO / 60).toFixed(2),
        HENO_DEC: (r.HENO / 60).toFixed(2),
        HEDF_DEC: (r.HEDF / 60).toFixed(2),
        HENF_DEC: (r.HENF / 60).toFixed(2),
        HDF_DEC: (r.HDF / 60).toFixed(2),
        HNF_DEC: (r.HNF / 60).toFixed(2),
        RNO_DEC: (r.RNO / 60).toFixed(2),
        totalExtras_DEC: (totalExtras / 60).toFixed(2),
        totalSuplementarias_DEC: (totalSuplementarias / 60).toFixed(2),
        totalHoras_DEC: (totalGeneral / 60).toFixed(2)
      };

      await Reporte.create(reporteItem);
      reportes.push(reporteItem);
    }

    res.json({ success: true, data: reportes, diasConsultados });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, mensaje: "Error creando reporte", error: err.message });
  }
}


async function exportarReporteExcel(req, res) {
  try {
    const { fechaInicio, fechaFin, tipoOperario } = req.body;
    if (!fechaInicio || !fechaFin)
      return res.status(400).json({ mensaje: "Debe enviar fechaInicio y fechaFin" });

    const inicio = moment(fechaInicio, "DD/MM/YYYY").startOf('day').toDate();
    const fin = moment(fechaFin, "DD/MM/YYYY").endOf('day').toDate();

    // Traemos desde HorasExtras filtrando por tipoOperario
    const extras = await HorasExtras.find({
      fecha_inicio_trabajo: { $gte: inicio },
      fecha_fin_trabajo: { $lte: fin }
    }).populate({
      path: "FuncionarioAsignado",
      match: tipoOperario ? { tipoOperario } : {}
    });

    // Filtramos los funcionarios null (por el match de arriba)
    const extrasFiltrados = extras.filter(e => e.FuncionarioAsignado);
    if (!extrasFiltrados.length)
      return res.status(404).json({ mensaje: "No hay registros en ese rango y tipoOperario" });

    // AGRUPAR POR FUNCIONARIO
    const reportesMap = {};
    extrasFiltrados.forEach(e => {
      const id = e.FuncionarioAsignado._id.toString();

      if (!reportesMap[id]) {
        reportesMap[id] = {
          identificacion: e.FuncionarioAsignado.identificacion_completa || e.FuncionarioAsignado.identificacion || "",
          nombre: e.FuncionarioAsignado.nombre_completo || "",
          tipoOperario: e.FuncionarioAsignado.tipoOperario || "",
          HEDO: 0, HENO: 0, HEDF: 0, HENF: 0, HDF: 0, HNF: 0, RNO: 0
        };
      }

      reportesMap[id].HEDO += convertirHorasAMinutos(e.horas_ordinarias_diurnas);
      reportesMap[id].HENO += convertirHorasAMinutos(e.horas_ordinarias_nocturnas);
      reportesMap[id].HEDF += convertirHorasAMinutos(e.horas_extras_diurnas);
      reportesMap[id].HENF += convertirHorasAMinutos(e.horas_extras_nocturnas);
      reportesMap[id].HDF += convertirHorasAMinutos(e.horas_dominicales_diurnas);
      reportesMap[id].HNF += convertirHorasAMinutos(e.horas_dominicales_nocturnas);
      reportesMap[id].RNO += convertirHorasAMinutos(e.recargo_nocturno);
    });

    const reportes = Object.values(reportesMap);

    // CREAR EXCEL
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Horas Extras");

    // ======= TÍTULO =======
    const titleRow = worksheet.addRow([`REPORTE HORAS EXTRAS DEL ${fechaInicio} AL ${fechaFin}${tipoOperario ? " - " + tipoOperario : ""}`]);
    worksheet.mergeCells(`A1:S1`);
    titleRow.getCell(1).font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.getCell(1).alignment = { horizontal: 'center' };
    titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    worksheet.addRow([]);

    // ======= CABECERAS =======
    const header1 = worksheet.addRow([
      "Identificación", "Nombre",
      "Horas HH:MM", "", "", "", "", "", "",
      "Horas Decimales", "", "", "", "", "", "",
      "Totales", "", ""
    ]);
    const header2 = worksheet.addRow([
      "", "",
      "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO",
      "HEDO", "HENO", "HEDF", "HENF", "HDF", "HNF", "RNO",
      "Extras", "Suplementarias", "General"
    ]);

    worksheet.mergeCells("A3:A4");
    worksheet.mergeCells("B3:B4");
    worksheet.mergeCells("C3:I3");
    worksheet.mergeCells("J3:P3");
    worksheet.mergeCells("Q3:S3");

    // Estilo cabeceras (solo en las celdas con texto)
    [header1, header2].forEach(row => {
      row.eachCell(cell => {
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
    });

    // ======= DATOS =======
    reportes.forEach(r => {
      const totalExtras = r.HEDO + r.HENO + r.HEDF + r.HENF;
      const totalSuplementarias = r.HDF + r.HNF + r.RNO;
      const totalGeneral = totalExtras + totalSuplementarias;

      const dataRow = worksheet.addRow([
        r.identificacion,
        r.nombre,
        // HH:MM
        minutosAHHMM(r.HEDO), minutosAHHMM(r.HENO), minutosAHHMM(r.HEDF), minutosAHHMM(r.HENF),
        minutosAHHMM(r.HDF), minutosAHHMM(r.HNF), minutosAHHMM(r.RNO),
        // DEC
        (r.HEDO / 60).toFixed(2), (r.HENO / 60).toFixed(2), (r.HEDF / 60).toFixed(2), (r.HENF / 60).toFixed(2),
        (r.HDF / 60).toFixed(2), (r.HNF / 60).toFixed(2), (r.RNO / 60).toFixed(2),
        // Totales
        (totalExtras / 60).toFixed(2), (totalSuplementarias / 60).toFixed(2), (totalGeneral / 60).toFixed(2)
      ]);

      // Bordes y alineación para cada celda de datos
      dataRow.eachCell(cell => {
        cell.alignment = { horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } },
        };
      });
    });

    // ======= ANCHOS =======
    worksheet.columns = [
      { width: 18 }, { width: 30 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 12 }, { width: 15 }, { width: 12 }
    ];

    // ======= EXPORTAR =======
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_HorasExtras_${fechaInicio}_a_${fechaFin}${tipoOperario ? "_" + tipoOperario : ""}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: "Error exportando Excel", error: err.message });
  }
}



module.exports = { crearReporte, exportarReporteExcel };
