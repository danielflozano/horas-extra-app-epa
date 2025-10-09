const Extras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');
const moment = require('moment');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');


async function validarTurnoYHoras(data, idParaExcluir = null) {
  const camposObligatorios = ['FuncionarioAsignado', 'fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo'];
  for (const campo of camposObligatorios) {
    if (!data[campo]) return { success: false, status: 400, message: `El campo obligatorio '${campo}' es requerido.` };
    if (!mongoose.Types.ObjectId.isValid(data.FuncionarioAsignado)) {
      return { success: false, status: 400, message: 'El ID del funcionario asignado no es válido.' };
    }

    // Validar estado directamente desde BD
    const funcionario = await Funcionario.findById(data.FuncionarioAsignado).select("estado");
    if (!funcionario) {
      return { success: false, status: 404, message: 'El funcionario asignado no existe.' };
    }
    if (funcionario.estado === "Inactivo") {
      return { success: false, status: 400, message: 'No se pueden registrar horas extras para un funcionario inactivo.' };
    }


    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const camposDeHora = ['hora_inicio_trabajo', 'hora_fin_trabajo', 'hora_inicio_descanso', 'hora_fin_descanso'];
    for (const campo of camposDeHora) {
      if (data[campo] && !horaRegex.test(data[campo])) {
        return { success: false, status: 400, message: `El formato de hora para '${campo}' debe ser HH:MM (ejemplo: 08:30).` };
      }
    }
  }

  let inicioNuevo = moment(`${data.fecha_inicio_trabajo}T${data.hora_inicio_trabajo}`);
  let finNuevo = moment(`${data.fecha_fin_trabajo}T${data.hora_fin_trabajo}`);

  let avisoCambio = null;

  // --- Ajustar automáticamente si cruza medianoche ---
  if (finNuevo.isBefore(inicioNuevo)) {
    finNuevo.add(1, 'day');
    data.fecha_fin_trabajo = finNuevo.format('YYYY-MM-DD');
    data.hora_fin_trabajo = finNuevo.format('HH:mm');
    avisoCambio = `El turno cruzaba medianoche y se ajustó automáticamente: ahora termina el ${data.fecha_fin_trabajo} a las ${data.hora_fin_trabajo}.`;
  }

  if (!finNuevo.isAfter(inicioNuevo)) {
    return { success: false, status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' };
  }

  // Validaciones del descanso
  if (data.hora_inicio_descanso && data.hora_fin_descanso) {
    let inicioDesc = moment(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}`);
    let finDesc = moment(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}`);
    if (finDesc.isBefore(inicioDesc)) finDesc.add(1, 'day');

    if (!inicioDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]') || !finDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]')) {
      return { success: false, status: 400, message: 'El período de descanso debe estar completamente dentro del turno de trabajo.' };
    }
    if (finDesc.diff(inicioDesc, 'minutes') >= finNuevo.diff(inicioNuevo, 'minutes')) {
      return { success: false, status: 400, message: 'El descanso no puede durar más que el turno de trabajo.' };
    }
  }

  // Solapamiento con otros registros
  const filtro = {
    FuncionarioAsignado: data.FuncionarioAsignado,
    fecha_inicio_trabajo: { $lte: finNuevo.format('YYYY-MM-DD') },
    fecha_fin_trabajo: { $gte: inicioNuevo.format('YYYY-MM-DD') }
  };
  if (idParaExcluir) filtro._id = { $ne: idParaExcluir };

  const registrosExistentes = await Extras.find(filtro).lean();
  for (const existente of registrosExistentes) {
    let inicioExistente = moment(`${existente.fecha_inicio_trabajo.toISOString().split('T')[0]}T${existente.hora_inicio_trabajo}`);
    let finExistente = moment(`${existente.fecha_fin_trabajo.toISOString().split('T')[0]}T${existente.hora_fin_trabajo}`);
    if (finExistente.isBefore(inicioExistente)) finExistente.add(1, 'day');

    if (inicioNuevo.isBefore(finExistente) && finNuevo.isAfter(inicioExistente)) {
      return {
        success: false,
        status: 409,
        message: `Ya existe un registro de horas que se cruza con este turno. 
                  Turno existente: del ${inicioExistente.format('DD/MM/YYYY HH:mm')} al ${finExistente.format('DD/MM/YYYY HH:mm')}. 
                  Verifique y ajuste los horarios antes de guardar.`
      };
    }
  }

  return { success: true, avisoCambio, dataAjustada: data };

}

const crearExtras = async (req, res) => {
  try {
    let data = req.body;

    console.log("Datos recibidos para crearExtras:", data);

    const validacion = await validarTurnoYHoras(data);
    if (!validacion.success) {
      return res.status(validacion.status || 400).json({ success: false, message: validacion.message });
    }
    if (validacion.dataAjustada) {
      data = validacion.dataAjustada;
    }

    // 2. Calcular el desglose de horas
    const calculos = await calcularHorasExtras(data);
    if (!calculos.success) {
      return res.status(400).json({ success: false, message: calculos.message });
    }

    if (calculos.hora_fin_trabajo_ajustada) {
      data.hora_fin_trabajo = calculos.hora_fin_trabajo_ajustada;
      data.fecha_fin_trabajo = calculos.fecha_fin_trabajo_ajustada;
    }

    const nuevaExtra = new Extras({
      ...data,
      ...calculos,
      observaciones: data.observaciones || ""
    });

    await nuevaExtra.save();

    // Poblar los datos del funcionario para la respuesta
    await nuevaExtra.populate("FuncionarioAsignado", "nombre_completo tipoOperario estado");

    // 5. Preparar y enviar la respuesta final
    const respuesta = {
      success: true,
      message: 'Registro de horas extras creado exitosamente.',
      data: nuevaExtra,
    };
    if (validacion.avisoCambio) {
      respuesta.aviso = validacion.avisoCambio;
    }

    res.status(201).json(respuesta);

  } catch (error) {
    console.error("Error en crearExtras:", error);
    res.status(500).json({ success: false, message: error.message || "Ocurrió un error inesperado." });
  }
};

const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;

    const extraOriginal = await Extras.findById(id);
    if (!extraOriginal) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }

    // 1. Crear un objeto con los datos finales (originales + nuevos)
    // Se asegura de que todos los campos necesarios para la validación y el cálculo estén presentes.
    const datosFinales = {
      ...extraOriginal.toObject(),
      ...nuevosDatos
    };

    const validacion = await validarTurnoYHoras(datosFinales, id);
    if (!validacion.success) {
      return res.status(validacion.status || 400).json({ success: false, message: validacion.message });
    }

    // 3. Recalcular las horas con los datos ya validados
    const calculos = await calcularHorasExtras (datosFinales);
  
   if (!calculos.success) {
  console.error("❌ Error en calcularHorasExtras:", calculos);
  return res.status(400).json({
    success: false,
    message: calculos.message || "Error desconocido al calcular horas extras",
    detalle: calculos // incluir el objeto completo en la respuesta (opcional)
  });
}

    // 4. Actualizar el documento original con los nuevos datos y los nuevos cálculos
    Object.assign(extraOriginal, nuevosDatos, calculos);

    // 5. Guardar el documento actualizado en la base de datos
    await extraOriginal.save();

    // Opcional: Volver a popular los datos del funcionario para la respuesta
    const extraActualizado = await Extras.findById(extraOriginal._id).populate("FuncionarioAsignado", "nombre_completo");

    const respuesta = {
      success: true,
      message: 'Registro actualizado correctamente.',
      data: extraActualizado,
    };
    if (validacion.avisoCambio) {
      respuesta.aviso = validacion.avisoCambio;
    }

    res.status(200).json(respuesta);

  } catch (error) {
    console.error("Error en updateExtra:", error);
    res.status(500).json({ success: false, message: error.message || "Ocurrió un error inesperado." });
  }
};

const exportarExtrasExcel = async (req, res) => {
  try {
    const { identificacion, fechaInicio, fechaFin } = req.query;
    let query = {};
    let funcionarioFiltrado = null;

    console.log("Valor de fechaInicio recibido:", req.query);


    if (identificacion) {
      const func = await Funcionario.findOne({ identificacion });
      if (!func) {
        return res.status(404).json({ success: false, message: 'No se encontró un funcionario con esa identificación.' });
      }
      query.FuncionarioAsignado = func._id;
      funcionarioFiltrado = func;
    }

    if (fechaInicio && fechaFin) {
      const inicio = moment(fechaInicio, "YYYY-MM-DD").startOf('day').toDate();
      const fin = moment(fechaFin, "YsYYY-MM-DD").endOf('day').toDate();

      query.fecha_inicio_trabajo = { $lte: fin };
      query.fecha_fin_trabajo = { $gte: inicio };

      console.log("Las fechas se procesaron correctamente:", inicio, fin);
    }



    const extras = await Extras.find(query)
      .populate({ path: 'FuncionarioAsignado', select: 'nombre_completo identificacion Cargo', populate: { path: 'Cargo', select: 'name' } })
      .sort({ 'FuncionarioAsignado.nombre_completo': 1, fecha_inicio_trabajo: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Horas', {
      pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // 🔹 Función para limpiar valores nulos
    const safeValue = (val) => (val === null || val === undefined ? '' : val);

    worksheet.getRow(1).height = 45;
    const logoPath = path.join(__dirname, '../public/LOGOEPA.png');
    if (fs.existsSync(logoPath)) {
      const logoId = workbook.addImage({ buffer: fs.readFileSync(logoPath), extension: 'png' });
      worksheet.addImage(logoId, {
        tl: { col: 0.5, row: 0.2 },
        ext: { width: 250, height: 100 }
      });
    }

    worksheet.mergeCells('Q1:T1');
    const generatedCell = worksheet.getCell('Q1');
    generatedCell.value = `Generado:\n${moment().format('DD/MM/YYYY HH:mm')}`;
    generatedCell.font = { name: 'Calibri', size: 10, bold: true, italic: true };
    generatedCell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };

    // Fila 2: Título Principal
    worksheet.getRow(2).height = 25;
    worksheet.mergeCells('A2:S2');
    const titleCell = worksheet.getCell('A2');
    titleCell.value = 'REGISTRO DE HORAS EXTRAS Y SUPLEMENTARIAS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Fila 3: Subtítulo
    let subtitulo = 'Reporte General';
    if (funcionarioFiltrado) subtitulo = `Reporte para: ${funcionarioFiltrado.nombre_completo}`;
    if (fechaInicio && fechaFin) subtitulo += ` (Período: ${fechaInicio} al ${fechaFin})`;
    worksheet.mergeCells('A3:S3');
    const subtitleCell = worksheet.getCell('A3');
    subtitleCell.value = subtitulo;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    worksheet.getRow(4).height = 15; // fila vacía

    // --- 2. CABECERAS DE LA TABLA ---
    const headers = [
      'Cédula', 'Nombre Funcionario', 'Cargo',
      'Fecha Inicio', 'Hora Inicio', 'Fecha Fin', 'Hora Fin',
      'Fecha Inicio Descanso', 'Hora Inicio Descanso', 'Fecha Fin Descanso', 'Hora Fin Descanso',
      'HEDO', 'HENO', 'HEDF', 'HENF', 'HDF', 'HNF', 'RNO', 'Total Extras', 'Observaciones'
    ];
    const headerRow = worksheet.getRow(5);
    headerRow.values = headers;
    headerRow.height = 25;
    const bordeNegro = { style: 'thin', color: { argb: 'FF000000' } };

    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: bordeNegro, left: bordeNegro, bottom: bordeNegro, right: bordeNegro };
    });

    // --- 3. DATOS ---
    if (extras.length === 0) {
      const noDataRow = worksheet.addRow(['No se encontraron registros para los filtros seleccionados.']);
      worksheet.mergeCells(`A${noDataRow.number}:S${noDataRow.number}`);
      const noDataCell = noDataRow.getCell(1);
      noDataCell.alignment = { horizontal: 'center' };
      noDataCell.border = { top: bordeNegro, left: bordeNegro, bottom: bordeNegro, right: bordeNegro };
    } else {
      extras.forEach((e, index) => {
        if (!e.FuncionarioAsignado) return;

        const dataRow = worksheet.addRow([
          safeValue(e.FuncionarioAsignado.identificacion),
          safeValue(e.FuncionarioAsignado.nombre_completo),
          safeValue(e.FuncionarioAsignado.Cargo?.name) || 'N/A',
          moment(e.fecha_inicio_trabajo).format('DD/MM/YYYY'), safeValue(e.hora_inicio_trabajo),
          moment(e.fecha_fin_trabajo).format('DD/MM/YYYY'), safeValue(e.hora_fin_trabajo),
          e.fecha_inicio_descanso ? moment(e.fecha_inicio_descanso).format('DD/MM/YYYY') : '', safeValue(e.hora_inicio_descanso),
          e.fecha_fin_descanso ? moment(e.fecha_fin_descanso).format('DD/MM/YYYY') : '', safeValue(e.hora_fin_descanso),
          safeValue(e.HEDO) || '00:00', safeValue(e.HENO) || '00:00', safeValue(e.HEDF) || '00:00', safeValue(e.HENF) || '00:00',
          safeValue(e.HDF) || '00:00', safeValue(e.HNF) || '00:00', safeValue(e.RNO) || '00:00', safeValue(e.horas_extras) || '00:00',
          safeValue(e.observaciones)
        ]);

        dataRow.eachCell((cell, colNumber) => {
          cell.border = {
            top: bordeNegro, left: bordeNegro, bottom: bordeNegro, right: bordeNegro
          };
          if (colNumber <= 3) {
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
          if (index % 2 !== 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          }
        });
      });
    }

    // --- 4. ANCHOS DE COLUMNA Y VISTA ---
    worksheet.columns = [
      { width: 18 }, { width: 35 }, { width: 25 },
      { width: 15 }, { width: 12 }, { width: 15 }, { width: 12 },
      { width: 20 }, { width: 20 }, { width: 20 }, { width: 20 },
      { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
      { width: 15 }, { width: 40 }
    ];
    worksheet.views = [{ state: 'frozen', ySplit: 5 }];

    // --- 5. ENVÍO DEL ARCHIVO ---
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Horas_Extras.xlsx');

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);


  } catch (error) {
    console.error("Error al generar Excel:", error);
    res.status(500).json({ success: false, message: 'Error interno al generar el archivo Excel.' });
  }
};


const eliminarExtras = async (req, res) => {
  try {
    const { id } = req.params;
    const extra = await Extras.findByIdAndDelete(id);
    if (!extra) return res.status(404).json({ success: false, message: 'Registro no encontrado' }); // TODO: Debo dejar esto !!!
    res.status(200).json({ success: true, message: 'Registro eliminado', data: extra });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listarExtras = async (req, res) => {
  try {
    const extras = await Extras.find()
      .populate({ path: "FuncionarioAsignado", select: "nombre_completo identificacion", populate: { path: "Cargo", select: "name" } })
      .sort({ fecha_inicio_trabajo: -1 });
    res.status(200).json({ success: true, data: extras });
    console.log(extras);

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listarExtrasPorIdentificacion = async (req, res) => {
  try {
    const { identificacion } = req.params;
    if (!identificacion) return res.status(404).json({ success: false, message: "Falta identificación" }); // Cambie esto porque me retornaba success: true, data:[]

    const func = await Funcionario.findOne({ identificacion });
    if (!func) return res.status(404).json({ success: false, message: 'Usuario no encontrado' });

    const extras = await Extras.find({ FuncionarioAsignado: func._id })
      .populate({ path: "FuncionarioAsignado", select: "nombre_completo identificacion", populate: { path: "Cargo", select: "name" } })
      .sort({ fecha_inicio_trabajo: -1 });

    res.status(200).json({ success: true, data: extras });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const listarExtrasPorFechas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({ success: false, message: "Faltan fechas" });
    }

    const inicio = moment(fechaInicio, "YYYY/MM/DD").startOf('day').toDate();
    const fin = moment(fechaFin, "YYYY/MM/DD").endOf('day').toDate();

    const extras = await Extras.find({

      fecha_inicio_trabajo: { $lte: fin },
      fecha_fin_trabajo: { $gte: inicio },
    })
      .populate({
        path: "FuncionarioAsignado", select: "nombre_completo identificacion",
        populate: { path: "Cargo", select: "name" }
      })
      .sort({ fecha_inicio_trabajo: -1 });

    console.log(`Buscando entre ${inicio.toISOString()} y ${fin.toISOString()}`);
    console.log(`Se encontraron ${extras.length} registros.`);

    res.status(200).json({ success: true, data: extras });
    console.log(`Registros enviados al cliente: ${extras.length}`);


  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
module.exports = {
  crearExtras,
  updateExtra,
  eliminarExtras,
  listarExtras,
  listarExtrasPorIdentificacion,
  listarExtrasPorFechas,
  exportarExtrasExcel,
  validarTurnoYHoras
};