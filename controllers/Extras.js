const Extras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');
const moment = require('moment');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');


async function validarTurnoYHoras(data, idParaExcluir = null) {
  // 1. Validaciones de formato y campos obligatorios
  const camposObligatorios = ['FuncionarioAsignado', 'fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo'];
  for (const campo of camposObligatorios) {
    if (!data[campo]) return { success: false, status: 400, message: `El campo obligatorio '${campo}' es requerido.` };
  }
  if (!mongoose.Types.ObjectId.isValid(data.FuncionarioAsignado)) {
    return { success: false, status: 400, message: 'El ID del FuncionarioAsignado no es válido.' };
  }
  const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  const camposDeHora = ['hora_inicio_trabajo', 'hora_fin_trabajo', 'hora_inicio_descanso', 'hora_fin_descanso'];
  for (const campo of camposDeHora) {
    if (data[campo] && !horaRegex.test(data[campo])) {
      return { success: false, status: 400, message: `El formato de hora para '${campo}' debe ser HH:MM.` };
    }
  }

  // 2. Validaciones de coherencia lógica de fechas y horas
  const fechaInicio = moment(data.fecha_inicio_trabajo);
  const fechaFin = moment(data.fecha_fin_trabajo);

  if (fechaFin.isBefore(fechaInicio)) {
    return { success: false, status: 400, message: 'La fecha de fin no puede ser anterior a la fecha de inicio.' };
  }

  let inicioNuevo = moment(`${data.fecha_inicio_trabajo}T${data.hora_inicio_trabajo}`);
  let finNuevo = moment(`${data.fecha_fin_trabajo}T${data.hora_fin_trabajo}`);

  if (finNuevo.isBefore(inicioNuevo)) {
    finNuevo.add(1, 'day');
  }

  if (!finNuevo.isAfter(inicioNuevo)) {
    return { success: false, status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' };
  }
  if (finNuevo.diff(inicioNuevo, 'hours') > 24) {
    return { success: false, status: 400, message: 'La duración del turno no puede exceder las 24 horas.' };
  }
  if (inicioNuevo.isAfter(moment())) {
    return { success: false, status: 400, message: 'No se pueden registrar horas para una fecha futura.' };
  }

  // 3. Validaciones de coherencia del descanso
  if (data.hora_inicio_descanso && data.hora_fin_descanso) {
    let inicioDesc = moment(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}`);
    let finDesc = moment(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}`);
    if (finDesc.isBefore(inicioDesc)) finDesc.add(1, 'day');

    if (!inicioDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]') || !finDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]')) {
      return { success: false, status: 400, message: 'El período de descanso debe estar completamente dentro del horario de trabajo.' };
    }
    if (finDesc.diff(inicioDesc, 'minutes') >= finNuevo.diff(inicioNuevo, 'minutes')) {
      return { success: false, status: 400, message: 'El descanso no puede durar más que el turno de trabajo.' };
    }
  }

  // 4. Validación de solapamiento con registros existentes
  const filtro = {
    FuncionarioAsignado: data.FuncionarioAsignado,
    fecha_inicio_trabajo: { $lte: finNuevo.format('YYYY-MM-DD') },
    fecha_fin_trabajo: { $gte: inicioNuevo.format('YYYY-MM-DD') }
  };
  if (idParaExcluir) {
    filtro._id = { $ne: idParaExcluir };
  }
  
  const registrosExistentes = await Extras.find(filtro).lean();
  for (const existente of registrosExistentes) {
    let inicioExistente = moment(`${existente.fecha_inicio_trabajo.toISOString().split('T')[0]}T${existente.hora_inicio_trabajo}`);
    let finExistente = moment(`${existente.fecha_fin_trabajo.toISOString().split('T')[0]}T${existente.hora_fin_trabajo}`);
    if (finExistente.isBefore(inicioExistente)) finExistente.add(1, 'day');

    if (inicioNuevo.isBefore(finExistente) && finNuevo.isAfter(inicioExistente)) {
      return { 
        success: false, 
        status: 409, // Conflict
        message: `El registro se solapa con un turno existente que va del ${inicioExistente.format('DD/MM/YYYY HH:mm')} al ${finExistente.format('DD/MM/YYYY HH:mm')}.` 
      };
    }
  }
  
  return { success: true };
}


// ===================================================================================
// CONTROLADOR PARA CREAR REGISTRO (AHORA USA LA FUNCIÓN DE VALIDACIÓN)
// ===================================================================================
const crearExtras = async (req, res) => {
  try {
    const data = req.body;

    // Se llama a la función de validación centralizada
    const validacion = await validarTurnoYHoras(data);
    if (!validacion.success) {
      return res.status(validacion.status).json({ success: false, message: validacion.message });
    }

    const calculos = calcularHorasExtras(data);
    if (!calculos.success) {
      return res.status(400).json(calculos);
    }

    const nuevaExtra = new Extras({ ...data, ...calculos });
    await nuevaExtra.save();
    await nuevaExtra.populate("FuncionarioAsignado", "nombre_completo");

    res.status(201).json({ success: true, message: 'Registro de horas extras creado exitosamente.', data: nuevaExtra });

  } catch (error) {
    console.error("Error en crearExtras:", error);
    res.status(500).json({ success: false, message: error.message || "Ocurrió un error inesperado." });
  }
};

// ===================================================================================
// CONTROLADOR PARA ACTUALIZAR REGISTRO (AHORA USA LA FUNCIÓN DE VALIDACIÓN)
// ===================================================================================
const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;
    
    const extra = await Extras.findById(id);
    if (!extra) return res.status(404).json({ success: false, message: 'Registro no encontrado.' });

    const datosParaValidar = { ...extra.toObject(), ...nuevosDatos };
    
    // Se llama a la función de validación centralizada, excluyendo el propio ID
    const validacion = await validarTurnoYHoras(datosParaValidar, id);
    if (!validacion.success) {
        return res.status(validacion.status).json({ success: false, message: validacion.message });
    }

    // Aplicar cambios y recalcular si es necesario
    Object.assign(extra, nuevosDatos);

    const camposDeCalculo = ['fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo', 'fecha_inicio_descanso', 'hora_inicio_descanso', 'fecha_fin_descanso', 'hora_fin_descanso'];
    const necesitaRecalcular = camposDeCalculo.some(campo => nuevosDatos[campo] !== undefined);

    if (necesitaRecalcular) {
      const calculos = calcularHorasExtras(extra.toObject());
      Object.assign(extra, calculos);
    }

    await extra.save();
    await extra.populate("FuncionarioAsignado", "nombre_completo");
    res.status(200).json({ success: true, message: 'Registro actualizado correctamente.', data: extra });

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
      const fin = moment(fechaFin, "YYYY-MM-DD").endOf('day').toDate();
      query.fecha_inicio_trabajo = { $lte: fin };
      query.fecha_fin_trabajo = { $gte: inicio };
    }

    const extras = await Extras.find(query)
      .populate({ path: 'FuncionarioAsignado', select: 'nombre_completo identificacion Cargo', populate: { path: 'Cargo', select: 'name' } })
      .sort({ 'FuncionarioAsignado.nombre_completo': 1, fecha_inicio_trabajo: 1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de Horas', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
    });

    // --- 1. AÑADIR LOGO ---
    const logoPath = path.join(__dirname, '../public/Epa.png');
    if (fs.existsSync(logoPath)) {
        const logoId = workbook.addImage({
            buffer: fs.readFileSync(logoPath),
            extension: 'png',
        });

        // Se coloca la imagen UNA SOLA VEZ con la variable correcta 'logoId'
        worksheet.addImage(logoId, {
            tl: { col: 0.2, row: 0.2 },
            ext: { width: 140, height: 60 } // Ajusta el tamaño como prefieras
        });
    }
    
    // Ajustar altura de filas para el logo y títulos
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 25;
    
    // --- 2. TÍTULO Y SUBTÍTULO ---
    worksheet.mergeCells('D1:O2');
    const titleCell = worksheet.getCell('D1');
    titleCell.value = 'REGISTRO DE HORAS EXTRAS Y SUPLEMENTARIAS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    let subtitulo = 'Reporte General';
    if(funcionarioFiltrado) subtitulo = `Reporte para: ${funcionarioFiltrado.nombre_completo}`;
    if(fechaInicio && fechaFin) subtitulo += ` (del ${fechaInicio} al ${fechaFin})`;

    worksheet.mergeCells('D3:O3');
    const subtitleCell = worksheet.getCell('D3');
    subtitleCell.value = subtitulo;
    subtitleCell.font = { name: 'Calibri', size: 10, italic: true };
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    
    worksheet.getRow(4).height = 20;

    // --- 3. CABECERAS DE LA TABLA ---
    const headers = [
      'Cédula', 'Nombre Funcionario', 'Cargo',
      'Fecha Inicio', 'Hora Inicio', 'Fecha Fin', 'Hora Fin',
      'HEDO', 'HENO', 'HEDF', 'HENF', 'HDF', 'HNF', 'RNO', 'Total Extras'
    ];
    const headerRow = worksheet.getRow(5);
    headerRow.values = headers;
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }};
    });

    // --- 4. DATOS ---
    if (extras.length === 0) {
      worksheet.addRow(['No se encontraron registros para los filtros seleccionados.']);
    } else {
      extras.forEach(e => {
        if (!e.FuncionarioAsignado) return;
        
        worksheet.addRow([
          e.FuncionarioAsignado.identificacion || '',
          e.FuncionarioAsignado.nombre_completo || '',
          e.FuncionarioAsignado.Cargo?.name || 'N/A',
          moment(e.fecha_inicio_trabajo).format('DD/MM/YYYY'),
          e.hora_inicio_trabajo || '',
          moment(e.fecha_fin_trabajo).format('DD/MM/YYYY'),
          e.hora_fin_trabajo || '',
          e.HEDO || '00:00',
          e.HENO || '00:00',
          e.HEDF || '00:00',
          e.HENF || '00:00',
          e.HDF || '00:00',
          e.HNF || '00:00',
          e.RNO || '00:00',
          e.horas_extras || '00:00'
        ]);
      });
    }

    // --- 5. ESTILOS FINALES ---
    worksheet.columns.forEach(column => {
        column.width = 15;
        column.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
    worksheet.getColumn('B').width = 35;
    worksheet.getColumn('C').width = 25;

    worksheet.views = [{ state: 'frozen', ySplit: 5 }];

    // --- 6. ENVÍO DEL ARCHIVO ---
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=Reporte_Horas_Extras.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error("Error al generar Excel:", error);
    res.status(500).json({ success: false, message: 'Error interno al generar el archivo Excel.' });
  }
};

const eliminarExtras = async (req, res) => {
    try {
        const { id } = req.params;
        const extra = await Extras.findByIdAndDelete(id);
        if (!extra) return res.status(404).json({ success: false, message: 'No encontrado' });
        res.status(200).json({ success: true, message: 'Registro eliminado', data: extra });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const listarExtras = async (req, res) => {
    try {
        const extras = await Extras.find()
            .populate({ path: "FuncionarioAsignado", select: "nombre_completo identificacion", populate: { path: "Cargo", select: "name" }})
            .sort({ fecha_inicio_trabajo: -1 });
        res.status(200).json({ success: true, data: extras });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const listarExtrasPorIdentificacion = async (req, res) => {
    try {
        const { identificacion } = req.query;
        if (!identificacion) return res.status(400).json({ success: false, message: "Falta identificación" });
        
        const func = await Funcionario.findOne({ identificacion });
        if (!func) return res.status(200).json({ success: true, data: [] });

        const extras = await Extras.find({ FuncionarioAsignado: func._id })
            .populate({ path: "FuncionarioAsignado", select: "nombre_completo identificacion", populate: { path: "Cargo", select: "name" }})
            .sort({ fecha_inicio_trabajo: -1 });

        res.status(200).json({ success: true, data: extras });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const listarExtrasPorFechas = async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        if (!fechaInicio || !fechaFin) return res.status(400).json({ success: false, message: "Faltan fechas" });

        const inicio = new Date(fechaInicio);
        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999);

        const extras = await Extras.find({
            fecha_inicio_trabajo: { $gte: inicio },
            fecha_fin_trabajo: { $lte: fin },
        }).populate({
            path: "FuncionarioAsignado", select: "nombre_completo identificacion",
            populate: { path: "Cargo", select: "name" }
        }).sort({ fecha_inicio_trabajo: -1 });
        
        res.status(200).json({ success: true, data: extras });
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
    exportarExtrasExcel
};