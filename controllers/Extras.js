const Extras = require('../models/HorasExtras');
const Funcionario = require('../models/Funcionarios');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');
const moment = require('moment');
const ExcelJS = require('exceljs');

const crearExtras = async (req, res) => {
  try {
    const data = req.body;

    // Campos obligatorios
    const camposObligatorios = [
      'FuncionarioAsignado', 'fecha_inicio_trabajo', 'hora_inicio_trabajo',
      'fecha_fin_trabajo', 'hora_fin_trabajo'
    ];
    for (const campo of camposObligatorios) {
      if (!data[campo]) return res.status(400).json({ success: false, message: `Falta el campo: ${campo}` });
    }

    // Validar formato hora
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    ['hora_inicio_trabajo', 'hora_fin_trabajo', 'hora_inicio_descanso', 'hora_fin_descanso']
      .forEach(c => { if (data[c] && !horaRegex.test(data[c])) throw new Error(`Formato inválido en ${c}`) });

    // Validar fechas
    ['fecha_inicio_trabajo', 'fecha_fin_trabajo', 'fecha_inicio_descanso', 'fecha_fin_descanso']
      .forEach(f => { if (data[f] && !moment(data[f], 'YYYY-MM-DD', true).isValid()) throw new Error(`Fecha inválida: ${f}`) });

    //  Validar que el funcionario existe y está ACTIVO
    const existeFuncionario = await Funcionario.findOne({
      _id: data.FuncionarioAsignado,
      estado: 'Activo'
    });
    if (!existeFuncionario) {
      return res.status(400).json({ success: false, message: 'El funcionario no existe o está inactivo.' });
    }

    // Ajuste fechas de trabajo
    let inicioTrabajo = moment(`${data.fecha_inicio_trabajo}T${data.hora_inicio_trabajo}`);
    let finTrabajo = moment(`${data.fecha_fin_trabajo}T${data.hora_fin_trabajo}`);
    if (finTrabajo.isBefore(inicioTrabajo)) finTrabajo.add(1, 'day');

    // Validar descanso
    if (data.hora_inicio_descanso && data.hora_fin_descanso && data.fecha_inicio_descanso && data.fecha_fin_descanso) {
      let inicioDesc = moment(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}`);
      let finDesc = moment(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}`);
      if (finDesc.isBefore(inicioDesc)) finDesc.add(1, 'day');
      if (inicioDesc.isBefore(inicioTrabajo) || finDesc.isAfter(finTrabajo))
        return res.status(400).json({ success: false, message: 'Descanso fuera del rango de trabajo' });
      if (finDesc.diff(inicioDesc, 'minutes') > 480)
        return res.status(400).json({ success: false, message: 'Descanso > 8h' });
    }

    // helper: acepta fecha (Date o "YYYY-MM-DD") y hora ("HH:mm")
    function parseDateTime(fecha, hora) {
      const fechaObj = fecha instanceof Date ? fecha : new Date(fecha); // fecha puede ser Date o string
      const year = fechaObj.getFullYear();
      const month = fechaObj.getMonth(); // 0-based
      const day = fechaObj.getDate();
      let hour = 0, minute = 0;
      if (hora && typeof hora === 'string') {
        const parts = hora.trim().split(':').map(Number);
        hour = Number.isFinite(parts[0]) ? parts[0] : 0;
        minute = Number.isFinite(parts[1]) ? parts[1] : 0;
      }
      return new Date(year, month, day, hour, minute, 0, 0);
    }

    // Construir rango del nuevo registro
    const inicioNuevo = parseDateTime(data.fecha_inicio_trabajo, data.hora_inicio_trabajo);
    const finNuevo = parseDateTime(data.fecha_fin_trabajo, data.hora_fin_trabajo);

    // validación básica de coherencia
    if (!(inicioNuevo < finNuevo)) {
      return res.status(400).json({ success: false, message: 'Rango inválido: la fecha/hora de inicio debe ser anterior a la de fin' });
    }

    // Buscar candidatos por ventana de fechas (filtro amplio para no traer TODA la colección)
    const filtro = {
      FuncionarioAsignado: data.FuncionarioAsignado,
      fecha_inicio_trabajo: { $lte: data.fecha_fin_trabajo },
      fecha_fin_trabajo: { $gte: data.fecha_inicio_trabajo }
    };
    // si estás actualizando un documento, excluirte a ti mismo:
    if (data._id) filtro._id = { $ne: data._id };

    const candidatos = await Extras.find(filtro).lean();

    // Revisar uno a uno con horas
    for (const c of candidatos) {
      const inicioExistente = parseDateTime(c.fecha_inicio_trabajo, c.hora_inicio_trabajo);
      const finExistente = parseDateTime(c.fecha_fin_trabajo, c.hora_fin_trabajo);

      // condición de solapamiento (note: igualdad en los límites NO es solapamiento)
      if (inicioNuevo < finExistente && finNuevo > inicioExistente) {
        return res.status(400).json({ success: false, message: 'Registro se solapa' });
      }
    }
    // Validación mínima 8h (lunes-sábado)
    const minutosEfectivos = finTrabajo.diff(inicioTrabajo, 'minutes');
    const diaSemana = inicioTrabajo.isoWeekday();
    if ((diaSemana >= 1 && diaSemana <= 6) && !data.es_festivo_Inicio && minutosEfectivos < 480)
      return res.status(400).json({ success: false, message: 'Mínimo 8h efectivas' });

    // Calcular horas extras
    const calculos = calcularHorasExtras(data);

    // Revisar si la fecha es futura
    if (!calculos.success) return res.status(400).json(calculos);

    // Guardar registro
    const nuevaExtra = new Extras({ ...data, ...calculos });
    await nuevaExtra.save();

    res.status(201).json({ success: true, message: 'Registro creado', data: nuevaExtra });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar registro
const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;
    const extra = await Extras.findById(id);
    if (!extra) return res.status(404).json({ success: false, message: 'No encontrado' });

    const camposClave = ['fecha_inicio_trabajo', 'hora_inicio_trabajo', 'fecha_fin_trabajo', 'hora_fin_trabajo', 'fecha_inicio_descanso', 'hora_inicio_descanso', 'fecha_fin_descanso', 'hora_fin_descanso'];
    let recalcular = false;

    for (let campo in nuevosDatos) {
      if (extra[campo] !== undefined && extra[campo] !== nuevosDatos[campo]) {
        extra[campo] = nuevosDatos[campo];
        if (camposClave.includes(campo)) recalcular = true;
      }
    }

    if (recalcular) {
      const calculos = calcularHorasExtras(extra.toObject());
      Object.assign(extra, calculos);
    }

    await extra.save();
    res.status(200).json({ success: true, message: 'Registro actualizado', data: extra });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const exportarExtrasExcel = async (req, res) => {
  try {
    const { identificacion, fechaInicio, fechaFin } = req.query;
    let query = {};
    // Filtrar por identificación si existe
    if (identificacion) {
      const func = await Funcionario.findOne({ identificacion });
      if (!func) {
        // Excel vacío si no existe funcionario
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

    //  Filtrar por fechas si existen
    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fin.setHours(23, 59, 59, 999); // Incluir todo el día final
      query.fecha_inicio_trabajo = { $gte: inicio };
      query.fecha_fin_trabajo = { $lte: fin };
    }

    //  Buscar registros
    const extras = await Extras.find(query)
      .populate({ path: 'FuncionarioAsignado', select: 'nombre_completo identificacion', populate: { path: 'Cargo', select: 'name' } })
      .sort({ fecha_inicio_trabajo: -1 });

    //  Crear Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Horas Extras');

    sheet.columns = [
      { header: 'Funcionario', key: 'nombre', width: 25 },
      { header: 'Identificación', key: 'identificacion', width: 15 },
      { header: 'Cargo', key: 'cargo', width: 20 },
      { header: 'Fecha Inicio', key: 'fechaInicio', width: 15 },
      { header: 'Hora Inicio', key: 'horaInicio', width: 10 },
      { header: 'Fecha Fin', key: 'fechaFin', width: 15 },
      { header: 'Hora Fin', key: 'horaFin', width: 10 },
      { header: 'HEDO', key: 'HEDO', width: 10 },
      { header: 'HENO', key: 'HENO', width: 10 },
      { header: 'HEDF', key: 'HEDF', width: 10 },
      { header: 'HENF', key: 'HENF', width: 10 },
      { header: 'HDF', key: 'HDF', width: 10 },
      { header: 'HNF', key: 'HNF', width: 10 },
      { header: 'RNO', key: 'RNO', width: 10 },
      { header: 'Total Extras', key: 'total', width: 15 },
    ];

    if (extras.length === 0) {
      sheet.addRow(['No hay datos']);
    } else {
      extras.forEach(e => {
        sheet.addRow({
          nombre: e.FuncionarioAsignado?.nombre_completo || '',
          identificacion: e.FuncionarioAsignado?.identificacion || '',
          cargo: e.FuncionarioAsignado?.Cargo?.name || '',
          fechaInicio: e.fecha_inicio_trabajo ? e.fecha_inicio_trabajo.toLocaleDateString() : '',
          horaInicio: e.hora_inicio_trabajo || '',
          fechaFin: e.fecha_fin_trabajo ? e.fecha_fin_trabajo.toLocaleDateString() : '',
          horaFin: e.hora_fin_trabajo || '',
          HEDO: e.HEDO || 0,
          HENO: e.HENO || 0,
          HEDF: e.HEDF || 0,
          HENF: e.HENF || 0,
          HDF: e.HDF || 0,
          HNF: e.HNF || 0,
          RNO: e.RNO || 0,
          total: e.horas_extras || 0,
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=HorasExtras.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Error al generar Excel' });
  }
};


// Eliminar registro
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
      .populate({
        path: "FuncionarioAsignado",
        select: "nombre_completo identificacion",
        populate: { path: "Cargo", select: "name" },
      })
      .sort({ fecha_inicio_trabajo: -1 });

    const data = extras.map((e) => {
      const inicio = e.fecha_inicio_trabajo
        ? new Date(e.fecha_inicio_trabajo.getTime() + 24 * 60 * 60 * 1000)
        : null;

      const fin = e.fecha_fin_trabajo
        ? new Date(e.fecha_fin_trabajo.getTime() + 24 * 60 * 60 * 1000)
        : null;

      return {
        ...e._doc,
        fecha_inicio_trabajo: inicio,
        fecha_fin_trabajo: fin,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};



// Filtrar por identificación
const listarExtrasPorIdentificacion = async (req, res) => {
  try {
    const { identificacion } = req.query;
    if (!identificacion) {
      return res
        .status(400)
        .json({ success: false, message: "Falta identificación" });
    }

    const extras = await Extras.find()
      .populate({
        path: "FuncionarioAsignado",
        match: { identificacion },
        select: "nombre_completo identificacion",
        populate: { path: "Cargo", select: "name" },
      })
      .sort({ fecha_inicio_trabajo: -1 });

    const filtrados = extras
      .filter((e) => e.FuncionarioAsignado)
      .map((e) => {
        const inicio = e.fecha_inicio_trabajo
          ? new Date(e.fecha_inicio_trabajo.getTime() + 24 * 60 * 60 * 1000)
          : null;

        const fin = e.fecha_fin_trabajo
          ? new Date(e.fecha_fin_trabajo.getTime() + 24 * 60 * 60 * 1000)
          : null;

        return {
          ...e._doc,
          fecha_inicio_trabajo: inicio,
          fecha_fin_trabajo: fin,
        };
      });

    res.status(200).json({ success: true, data: filtrados });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


const listarExtrasPorFechas = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    if (!fechaInicio || !fechaFin) {
      return res
        .status(400)
        .json({ success: false, message: "Faltan fechas" });
    }

    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    fin.setHours(23, 59, 59, 999);

    const extras = await Extras.find({
      fecha_inicio_trabajo: { $gte: inicio },
      fecha_fin_trabajo: { $lte: fin },
    })
      .populate({
        path: "FuncionarioAsignado",
        select: "nombre_completo identificacion",
        populate: { path: "Cargo", select: "name" },
      })
      .sort({ fecha_inicio_trabajo: -1 });

    // Ajuste: sumamos un día solo en la respuesta
    const data = extras.map((e) => {
      const inicio = e.fecha_inicio_trabajo
        ? new Date(e.fecha_inicio_trabajo.getTime() + 24 * 60 * 60 * 1000)
        : null;

      const fin = e.fecha_fin_trabajo
        ? new Date(e.fecha_fin_trabajo.getTime() + 24 * 60 * 60 * 1000)
        : null;

      return {
        ...e._doc,
        fecha_inicio_trabajo: inicio,
        fecha_fin_trabajo: fin,
      };
    });

    res.status(200).json({ success: true, data });
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
