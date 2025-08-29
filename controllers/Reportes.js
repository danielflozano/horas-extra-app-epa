const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const Reporte = require('../models/Reportes');
const ExcelJS = require("exceljs");

// ✅ Generar reporte para UN funcionario
async function generarReporteController(req, res) {
  try {
    const { idFuncionario, fechaInicio, fechaFin, periodo } = req.query;

    if (!idFuncionario || !fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: 'Campos obligatorios faltantes.' });
    }

    const funcionario = await Funcionario.findById(idFuncionario);
    if (!funcionario) return res.status(404).json({ mensaje: 'Funcionario no encontrado' });

    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);

    const registros = await HorasExtras.find({
      FuncionarioAsignado: idFuncionario,
      $or: [
        { fecha_inicio_trabajo: { $gte: fechaInicioDate, $lte: fechaFinDate } },
        { fecha_fin_trabajo: { $gte: fechaInicioDate, $lte: fechaFinDate } }
      ]
    });

    if (registros.length === 0) {
      return res.status(404).json({ mensaje: 'No hay registros en el rango' });
    }

    // 🔹 acumuladores
    let HDO = 0, HENO = 0, HEDF = 0, HENF = 0, HDF = 0, HNF = 0, RNO = 0;

    registros.forEach(r => {
      HDO += convertirAHorasAMinutos(r.horas_ordinarias_diurnas);
      HENO += convertirAHorasAMinutos(r.horas_ordinarias_nocturnas);
      HEDF += convertirAHorasAMinutos(r.horas_dominicales_diurnas);
      HENF += convertirAHorasAMinutos(r.horas_dominicales_nocturnas);
      HDF += convertirAHorasAMinutos(r.horas_extras_diurnas);
      HNF += convertirAHorasAMinutos(r.horas_extras_nocturnas);
      RNO += convertirAHorasAMinutos(r.recargo_nocturno);
    });

    const totalHorasExtra = HDO + HENO + HEDF + HENF + HDF + HNF + RNO;

    // Calcular tiempo trabajado
    const diffTime = fechaFinDate - fechaInicioDate;
    const totalMinutes = Math.floor(diffTime / (1000 * 60));
    const dias = Math.floor(totalMinutes / (60 * 24));
    const horas = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutos = totalMinutes % 60;
    const cantidad_Trabajados = `${dias + 1}d ${horas}h ${minutos}m`;

    const reporte = {
      identificacion_Funcionario: funcionario.identificacion,
      nombre_Funcionario: funcionario.nombre_completo,
      fechaInicioReporte: fechaInicio,
      fechaFinReporte: fechaFin,
      HDO_HORA: minutosAHHMMSS(HDO),
      HENO_HORA: minutosAHHMMSS(HENO),
      HEDF_HORA: minutosAHHMMSS(HEDF),
      HENF_HORA: minutosAHHMMSS(HENF),
      HDF_HORA: minutosAHHMMSS(HDF),
      HNF_HORA: minutosAHHMMSS(HNF),
      RNO_HORA: minutosAHHMMSS(RNO),
      HEDO_CONVERSION: (HDO / 60).toFixed(1),
      HENO_CONVERSION: (HENO / 60).toFixed(1),
      HEDF_CONVERSION: (HEDF / 60).toFixed(1),
      HENF_CONVERSION: (HENF / 60).toFixed(1),
      HDF_CONVERSION: (HDF / 60).toFixed(1),
      HNF_CONVERSION: (HNF / 60).toFixed(1),
      RNO_CONVERSION: (RNO / 60).toFixed(1),
      totalHorasExtra: minutosAHHMMSS(totalHorasExtra),
      totalHorasExtraDecimal: (totalHorasExtra / 60).toFixed(1),
      Periodo: periodo,
      cantidad_Trabajados
    };

    await new Reporte(reporte).save();

    // ✅ Crear Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte Funcionario");

    configurarColumnas(worksheet);
    worksheet.addRow(reporte);
    aplicarEstiloCabecera(worksheet);
    aplicarEstiloFilas(worksheet);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_${funcionario.identificacion}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error generando el reporte', error: err.message });
  }
}

// ✅ Generar reporte para TODOS los funcionarios
async function generarTodosReporteController(req, res) {
  try {
    const { fechaInicio, fechaFin, periodo } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ mensaje: 'Campos obligatorios faltantes.' });
    }

    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaFin);

    const funcionarios = await Funcionario.find();
    if (funcionarios.length === 0) return res.status(404).json({ mensaje: 'No hay funcionarios registrados' });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Reporte General");
    configurarColumnas(worksheet);

    for (const funcionario of funcionarios) {
      const registros = await HorasExtras.find({
        FuncionarioAsignado: funcionario._id,
        $or: [
          { fecha_inicio_trabajo: { $gte: fechaInicioDate, $lte: fechaFinDate } },
          { fecha_fin_trabajo: { $gte: fechaInicioDate, $lte: fechaFinDate } }
        ]
      });

      if (registros.length === 0) continue;

      let HDO = 0, HENO = 0, HEDF = 0, HENF = 0, HDF = 0, HNF = 0, RNO = 0;
      registros.forEach(r => {
        HDO += convertirAHorasAMinutos(r.horas_ordinarias_diurnas);
        HENO += convertirAHorasAMinutos(r.horas_ordinarias_nocturnas);
        HEDF += convertirAHorasAMinutos(r.horas_dominicales_diurnas);
        HENF += convertirAHorasAMinutos(r.horas_dominicales_nocturnas);
        HDF += convertirAHorasAMinutos(r.horas_extras_diurnas);
        HNF += convertirAHorasAMinutos(r.horas_extras_nocturnas);
        RNO += convertirAHorasAMinutos(r.recargo_nocturno);
      });

      const totalHorasExtra = HDO + HENO + HEDF + HENF + HDF + HNF + RNO;
      const diffTime = fechaFinDate - fechaInicioDate;
      const totalMinutes = Math.floor(diffTime / (1000 * 60));
      const dias = Math.floor(totalMinutes / (60 * 24));
      const horas = Math.floor((totalMinutes % (60 * 24)) / 60);
      const minutos = totalMinutes % 60;
      const cantidad_Trabajados = `${dias + 1}d ${horas}h ${minutos}m`;

      const reporte = {
        identificacion_Funcionario: funcionario.identificacion,
        nombre_Funcionario: funcionario.nombre_completo,
        fechaInicioReporte: fechaInicio,
        fechaFinReporte: fechaFin,
        HDO_HORA: minutosAHHMMSS(HDO),
        HENO_HORA: minutosAHHMMSS(HENO),
        HEDF_HORA: minutosAHHMMSS(HEDF),
        HENF_HORA: minutosAHHMMSS(HENF),
        HDF_HORA: minutosAHHMMSS(HDF),
        HNF_HORA: minutosAHHMMSS(HNF),
        RNO_HORA: minutosAHHMMSS(RNO),
        totalHorasExtra: minutosAHHMMSS(totalHorasExtra),
        totalHorasExtraDecimal: (totalHorasExtra / 60).toFixed(1),
        Periodo: periodo,
        cantidad_Trabajados
      };

      worksheet.addRow(reporte);
    }

    aplicarEstiloCabecera(worksheet);
    aplicarEstiloFilas(worksheet);

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=Reporte_General.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error generando el reporte general', error: err.message });
  }
}

// ✅ Helpers
function convertirAHorasAMinutos(horaStr) {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

function minutosAHHMMSS(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function configurarColumnas(worksheet) {
  worksheet.columns = [
    { header: "Identificación", key: "identificacion_Funcionario", width: 20 },
    { header: "Nombre", key: "nombre_Funcionario", width: 25 },
    { header: "Fecha Inicio", key: "fechaInicioReporte", width: 15 },
    { header: "Fecha Fin", key: "fechaFinReporte", width: 15 },
    { header: "HDO", key: "HDO_HORA", width: 12 },
    { header: "HENO", key: "HENO_HORA", width: 12 },
    { header: "HEDF", key: "HEDF_HORA", width: 12 },
    { header: "HENF", key: "HENF_HORA", width: 12 },
    { header: "HDF", key: "HDF_HORA", width: 12 },
    { header: "HNF", key: "HNF_HORA", width: 12 },
    { header: "RNO", key: "RNO_HORA", width: 12 },
    { header: "Total Extras", key: "totalHorasExtra", width: 18 },
    { header: "Extras Decimal", key: "totalHorasExtraDecimal", width: 18 },
    { header: "Periodo", key: "Periodo", width: 12 },
    { header: "Tiempo Trabajado", key: "cantidad_Trabajados", width: 20 },
  ];
}

function aplicarEstiloCabecera(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '1F4E78' } // Azul profesional
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });
}

function aplicarEstiloFilas(worksheet) {
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber !== 1) {
      row.eachCell((cell) => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
    }
  });
}

module.exports = { generarReporteController, generarTodosReporteController };
