const HorasExtras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const Reporte = require('../models/Reportes');

async function generarReporteController(req, res) {
  try {
    const { idFuncionario, fecha_inicio_trabajo, fecha_fin_trabajo, periodo } = req.body;

    if (!idFuncionario || !fecha_inicio_trabajo || !fecha_fin_trabajo) {
      return res.status(400).json({ mensaje: 'Campos obligatorios faltantes.' });
    }

    const funcionario = await Funcionario.findById(idFuncionario);
    if (!funcionario) return res.status(404).json({ mensaje: 'Funcionario no encontrado' });

    const fechaInicioDate = new Date(fecha_inicio_trabajo);
    const fechaFinDate = new Date(fecha_fin_trabajo);

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

    // Totales
    let HDO = 0, HENO = 0, HEDF = 0, HENF = 0, HDF = 0, HNF = 0, RNO = 0;

    registros.forEach(r => {
      HDO += convertirAHoras(r.horas_ordinarias_diurnas);
      HENO += convertirAHoras(r.horas_ordinarias_nocturnas);
      HEDF += convertirAHoras(r.horas_dominicales_diurnas);
      HENF += convertirAHoras(r.horas_dominicales_nocturnas);
      HDF += convertirAHoras(r.horas_extras_diurnas);
      HNF += convertirAHoras(r.horas_extras_nocturnas);
      RNO += convertirAHoras(r.recargo_nocturno);
    });

    const totalHorasExtra = HDO + HENO + HEDF + HENF + HDF + HNF + RNO;

    // Calcular tiempo trabajado
    const diffTime = fechaFinDate - fechaInicioDate;
    const totalMinutes = Math.floor(diffTime / (1000 * 60));
    const dias = Math.floor(totalMinutes / (60 * 24));
    const horas = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutos = totalMinutes % 60;

    const cantidad_Trabajados = `${dias + 1}d ${horas}h ${minutos}m`;

    // 📌 FACTORES DE CONVERSIÓN (ajústalos según tu normativa)
    const FACTORES = {
      HEDO: 1.25,
      HENO: 1.75,
      HEDF: 2.00,
      HENF: 2.50,
      HDF: 1.75,
      HNF: 2.10,
      RNO: 0.35
    };

    // Reporte con conversiones decimales
    const reporte = {
      identificacion_Funcionario: funcionario.identificacion,
      nombre_Funcionario: funcionario.nombre_completo,
      fechaInicioReporte: fecha_inicio_trabajo,
      fechaFinReporte: fecha_fin_trabajo,
      HDO_HORA: HDO,
      HENO_HORA: HENO,
      HEDF_HORA: HEDF,
      HENF_HORA: HENF,
      HDF_HORA: HDF,
      HNF_HORA: HNF,
      RNO_HORA: RNO,
      HEDO_CONVERSION: HDO * FACTORES.HEDO,
      HENO_CONVERSION: HENO * FACTORES.HENO,
      HEDF_CONVERSION: HEDF * FACTORES.HEDF,
      HENF_CONVERSION: HENF * FACTORES.HENF,
      HDF_CONVERSION: HDF * FACTORES.HDF,
      HNF_CONVERSION: HNF * FACTORES.HNF,
      RNO_CONVERSION: RNO * FACTORES.RNO,
      totalHorasExtra,
      Periodo: periodo,
      cantidad_Trabajados
    };

    const nuevoReporte = new Reporte(reporte);
    await nuevoReporte.save();

    res.json(reporte);

  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error generando el reporte', error: err.message });
  }
}

function convertirAHoras(horaStr) {
  if (!horaStr) return 0;
  const [h, m] = horaStr.split(':').map(Number);
  return h + m / 60;
}

module.exports = { generarReporteController };
