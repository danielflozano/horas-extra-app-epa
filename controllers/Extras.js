const Extras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');
const moment = require('moment');
const ExcelJS = require('exceljs');
const mongoose = require('mongoose'); // Importar mongoose para validar ObjectId

// ===================================================================================
// CONTROLADOR PARA CREAR REGISTRO DE HORAS EXTRAS (VERSIÓN CORREGIDA Y ROBUSTA)
// ===================================================================================
const crearExtras = async (req, res) => {
  try {
    const data = req.body;
    
    // --- 1. VALIDACIONES INICIALES (Formato y Campos Obligatorios) ---
    const camposObligatorios = ['FuncionarioAsignado', 'fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo'];
    for (const campo of camposObligatorios) {
      if (!data[campo]) return res.status(400).json({ success: false, message: `El campo obligatorio '${campo}' es requerido.` });
    }
    // Validar que FuncionarioAsignado sea un ObjectId válido
    if (!mongoose.Types.ObjectId.isValid(data.FuncionarioAsignado)) {
      return res.status(400).json({ success: false, message: 'El ID del FuncionarioAsignado no es válido.' });
    }

    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    const camposDeHora = ['hora_inicio_trabajo', 'hora_fin_trabajo', 'hora_inicio_descanso', 'hora_fin_descanso'];
    for (const campo of camposDeHora) {
        if (data[campo] && !horaRegex.test(data[campo])) {
            return res.status(400).json({ success: false, message: `El formato de hora para '${campo}' debe ser HH:MM.` });
        }
    }
    
    // --- 2. CONSTRUCCIÓN Y VALIDACIÓN DE FECHAS CON MOMENT.JS ---
    let inicioNuevo = moment(`${data.fecha_inicio_trabajo}T${data.hora_inicio_trabajo}`);
    let finNuevo = moment(`${data.fecha_fin_trabajo}T${data.hora_fin_trabajo}`);

    if (finNuevo.isBefore(inicioNuevo)) {
      finNuevo.add(1, 'day');
    }

    if (inicioNuevo.isAfter(moment())) {
        return res.status(400).json({ success: false, message: 'No se pueden registrar horas extras para una fecha futura.' });
    }
    
    if (data.hora_inicio_descanso && data.hora_fin_descanso) {
        let inicioDesc = moment(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}`);
        let finDesc = moment(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}`);
        if (finDesc.isBefore(inicioDesc)) finDesc.add(1, 'day');

        if (!inicioDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]') || !finDesc.isBetween(inicioNuevo, finNuevo, undefined, '[]')) {
            return res.status(400).json({ success: false, message: 'El período de descanso debe estar completamente dentro del horario de trabajo.' });
        }
    }

    // --- 3. VALIDACIÓN DE SOLAPAMIENTO ---
    const filtro = {
      FuncionarioAsignado: data.FuncionarioAsignado, 
      fecha_inicio_trabajo: { $lte: finNuevo.format('YYYY-MM-DD') },
      fecha_fin_trabajo: { $gte: inicioNuevo.format('YYYY-MM-DD') }
    };
    
    const registrosExistentes = await Extras.find(filtro).lean();

    for (const existente of registrosExistentes) {
        let inicioExistente = moment(`${existente.fecha_inicio_trabajo.toISOString().split('T')[0]}T${existente.hora_inicio_trabajo}`);
        let finExistente = moment(`${existente.fecha_fin_trabajo.toISOString().split('T')[0]}T${existente.hora_fin_trabajo}`);

        if (finExistente.isBefore(inicioExistente)) {
            finExistente.add(1, 'day');
        }

        if (inicioNuevo.isBefore(finExistente) && finNuevo.isAfter(inicioExistente)) {
            return res.status(409).json({
                success: false, 
                message: `El registro se solapa con un turno existente que va del ${inicioExistente.format('DD/MM/YYYY HH:mm')} al ${finExistente.format('DD/MM/YYYY HH:mm')}.` 
            });
        }
    }

    // --- 4. CÁLCULO Y GUARDADO ---
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
// CONTROLADOR PARA ACTUALIZAR REGISTRO (VERSIÓN CORREGIDA Y ROBUSTA)
// ===================================================================================
const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;
    
    const extra = await Extras.findById(id);
    if (!extra) return res.status(404).json({ success: false, message: 'Registro no encontrado.' });

    // --- 1. VALIDACIÓN DE SOLAPAMIENTO ANTES DE GUARDAR (SI LAS FECHAS CAMBIAN) ---
    const camposClave = ['fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo'];
    const fechasCambiaron = camposClave.some(campo => nuevosDatos[campo] && nuevosDatos[campo] !== extra[campo]);

    if (fechasCambiaron) {
        const datosParaValidar = { ...extra.toObject(), ...nuevosDatos };

        let inicioNuevo = moment(`${datosParaValidar.fecha_inicio_trabajo}T${datosParaValidar.hora_inicio_trabajo}`);
        let finNuevo = moment(`${datosParaValidar.fecha_fin_trabajo}T${datosParaValidar.hora_fin_trabajo}`);
        if (finNuevo.isBefore(inicioNuevo)) finNuevo.add(1, 'day');

        const filtro = {
            FuncionarioAsignado: datosParaValidar.FuncionarioAsignado,
            _id: { $ne: id }, // Excluir el propio documento que estamos actualizando
            fecha_inicio_trabajo: { $lte: finNuevo.format('YYYY-MM-DD') },
            fecha_fin_trabajo: { $gte: inicioNuevo.format('YYYY-MM-DD') }
        };

        const registrosExistentes = await Extras.find(filtro).lean();
        for (const existente of registrosExistentes) {
            let inicioExistente = moment(`${existente.fecha_inicio_trabajo.toISOString().split('T')[0]}T${existente.hora_inicio_trabajo}`);
            let finExistente = moment(`${existente.fecha_fin_trabajo.toISOString().split('T')[0]}T${existente.hora_fin_trabajo}`);
            if (finExistente.isBefore(inicioExistente)) finExistente.add(1, 'day');

            if (inicioNuevo.isBefore(finExistente) && finNuevo.isAfter(inicioExistente)) {
                return res.status(409).json({
                    success: false,
                    message: `La actualización crearía un solapamiento con otro registro existente.`
                });
            }
        }
    }

    // --- 2. APLICAR CAMBIOS Y RECALCULAR SI ES NECESARIO ---
    Object.assign(extra, nuevosDatos); // Aplicar todos los nuevos datos

    const camposDeCalculo = [...camposClave, 'fecha_inicio_descanso', 'hora_inicio_descanso', 'fecha_fin_descanso', 'hora_fin_descanso'];
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


// ===================================================================================
// OTROS CONTROLADORES (SIN CAMBIOS FUNCIONALES IMPORTANTES)
// ===================================================================================

const exportarExtrasExcel = async (req, res) => {
    // (Este código no se modifica)
    try {
        const { identificacion, fechaInicio, fechaFin } = req.query;
        let query = {};
        if (identificacion) {
            const func = await Funcionario.findOne({ identificacion });
            if (!func) {
                const workbook = new ExcelJS.Workbook();
                const sheet = workbook.addWorksheet('Horas Extras');
                sheet.addRow(['No hay datos para esa identificación']);
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=HorasExtras.xlsx');
                await workbook.xlsx.write(res);
                return res.end();
            }
            query.FuncionarioAsignado = func._id;
        }

        if (fechaInicio && fechaFin) {
            const inicio = new Date(fechaInicio);
            const fin = new Date(fechaFin);
            fin.setHours(23, 59, 59, 999);
            query.fecha_inicio_trabajo = { $gte: inicio };
            query.fecha_fin_trabajo = { $lte: fin };
        }

        const extras = await Extras.find(query)
            .populate({ path: 'FuncionarioAsignado', select: 'nombre_completo identificacion', populate: { path: 'Cargo', select: 'name' } })
            .sort({ fecha_inicio_trabajo: -1 });

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Horas Extras');
        sheet.columns = [
            { header: 'Funcionario', key: 'nombre', width: 25 }, { header: 'Identificación', key: 'identificacion', width: 15 },
            { header: 'Cargo', key: 'cargo', width: 20 }, { header: 'Fecha Inicio', key: 'fechaInicio', width: 15 },
            { header: 'Hora Inicio', key: 'horaInicio', width: 10 }, { header: 'Fecha Fin', key: 'fechaFin', width: 15 },
            { header: 'Hora Fin', key: 'horaFin', width: 10 }, { header: 'HEDO', key: 'HEDO', width: 10 },
            { header: 'HENO', key: 'HENO', width: 10 }, { header: 'HEDF', key: 'HEDF', width: 10 },
            { header: 'HENF', key: 'HENF', width: 10 }, { header: 'HDF', key: 'HDF', width: 10 },
            { header: 'HNF', key: 'HNF', width: 10 }, { header: 'RNO', key: 'RNO', width: 10 },
            { header: 'Total Extras', key: 'total', width: 15 },
        ];
        extras.forEach(e => {
            sheet.addRow({
                nombre: e.FuncionarioAsignado?.nombre_completo || '', identificacion: e.FuncionarioAsignado?.identificacion || '',
                cargo: e.FuncionarioAsignado?.Cargo?.name || '',
                fechaInicio: e.fecha_inicio_trabajo ? e.fecha_inicio_trabajo.toLocaleDateString() : '',
                horaInicio: e.hora_inicio_trabajo || '',
                fechaFin: e.fecha_fin_trabajo ? e.fecha_fin_trabajo.toLocaleDateString() : '',
                horaFin: e.hora_fin_trabajo || '',
                HEDO: e.HEDO || 0, HENO: e.HENO || 0, HEDF: e.HEDF || 0, HENF: e.HENF || 0,
                HDF: e.HDF || 0, HNF: e.HNF || 0, RNO: e.RNO || 0, total: e.horas_extras || 0,
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=HorasExtras.xlsx');
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al generar Excel' });
    }
};

const eliminarExtras = async (req, res) => {
    // (Este código no se modifica)
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
    // (Este código no se modifica)
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
    // (Este código no se modifica)
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
    // (Este código no se modifica)
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