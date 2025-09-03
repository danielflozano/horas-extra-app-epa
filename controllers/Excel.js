const ExcelJS = require("exceljs");
const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const Reporte = require('../models/Reportes');

async function generarTReporteController(req, res) {
  try {
    const { fecha_inicio_trabajo, fecha_fin_trabajo, periodo, exportar } = req.body;

    if (!fecha_inicio_trabajo || !fecha_fin_trabajo) {
      return res.status(400).json({ mensaje: 'Fechas de inicio y fin son obligatorias.' });
    }

    const fechaInicioDate = new Date(fecha_inicio_trabajo);
    const fechaFinDate = new Date(fecha_fin_trabajo);

    const funcionarios = await Funcionario.find();
    if (funcionarios.length === 0) {
      return res.status(404).json({ mensaje: 'No hay funcionarios registrados.' });
    }

    let reportes = [];

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
        fechaInicioReporte: fecha_inicio_trabajo,
        fechaFinReporte: fecha_fin_trabajo,

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

      const nuevoReporte = new Reporte(reporte);
      await nuevoReporte.save();

      reportes.push(reporte);
    }

    // 🔹 Si exportar a Excel
    if (exportar === "excel") {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Reportes");

      worksheet.columns = [
        { header: "Identificación", key: "identificacion_Funcionario", width: 15 },
        { header: "Nombre", key: "nombre_Funcionario", width: 25 },
        { header: "Fecha Inicio", key: "fechaInicioReporte", width: 15 },
        { header: "Fecha Fin", key: "fechaFinReporte", width: 15 },
        { header: "HDO", key: "HDO_HORA", width: 10 },
        { header: "HENO", key: "HENO_HORA", width: 10 },
        { header: "HEDF", key: "HEDF_HORA", width: 10 },
        { header: "HENF", key: "HENF_HORA", width: 10 },
        { header: "HDF", key: "HDF_HORA", width: 10 },
        { header: "HNF", key: "HNF_HORA", width: 10 },
        { header: "RNO", key: "RNO_HORA", width: 10 },
        { header: "Total Horas Extra", key: "totalHorasExtra", width: 20 },
        { header: "Total Decimal", key: "totalHorasExtraDecimal", width: 15 },
        { header: "Periodo", key: "Periodo", width: 10 },
        { header: "Tiempo Trabajado", key: "cantidad_Trabajados", width: 20 }
      ];

      reportes.forEach(r => worksheet.addRow(r));

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", "attachment; filename=reportes.xlsx");

      await workbook.xlsx.write(res);
      res.end();
    } else {
      res.json({
        mensaje: "Reportes generados",
        totalReportes: reportes.length,
        reportes
      });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error generando los reportes', error: err.message });
  }
}

// funciones auxiliares
function convertirAHorasAMinutos(horaStr) {
  if (!horaStr) return 0;
  if (typeof horaStr === "number") return horaStr;
  const partes = horaStr.split(':').map(Number);
  const h = partes[0] || 0;
  const m = partes[1] || 0;
  const s = partes[2] || 0;
  return h * 60 + m + s / 60;
}

function minutosAHHMMSS(minutos) {
  const h = Math.floor(minutos / 60);
  const m = Math.floor(minutos % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

module.exports = { generarTReporteController };
