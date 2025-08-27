const Extras = require('../models/HorasExtras');
const { calcularHorasExtras } = require('../helpers/CalculoHoras');

// Crear registro
const crearExtras = async (req, res) => {
  try {
    let data = req.body;

    if (
      !data.FuncionarioAsignado ||
      !data.fecha_inicio_trabajo ||
      !data.hora_inicio_trabajo ||
      !data.fecha_fin_trabajo ||
      !data.hora_fin_trabajo
    ) {
      return res.status(400).json({ success: false, message: 'Campos obligatorios faltantes.' });
    }

  
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(data.hora_inicio_trabajo) || !horaRegex.test(data.hora_fin_trabajo)) {
      return res.status(400).json({ success: false, message: 'Formato de hora inválido (HH:mm).' });
    }
    if (
      (data.hora_inicio_descanso && !horaRegex.test(data.hora_inicio_descanso)) ||
      (data.hora_fin_descanso && !horaRegex.test(data.hora_fin_descanso))
    ) {
      return res.status(400).json({ success: false, message: 'Formato de hora inválido en descanso (HH:mm).' });
    }

    //  Ajustar automáticamente la fecha fin si la hora fin es menor que la hora inicio
    const inicioTrabajo = new Date(`${data.fecha_inicio_trabajo}T${data.hora_inicio_trabajo}:00`);
    let finTrabajo = new Date(`${data.fecha_fin_trabajo}T${data.hora_fin_trabajo}:00`);

    if (finTrabajo <= inicioTrabajo) {
      // Significa que cruzó medianoche → sumamos un día
      finTrabajo.setDate(finTrabajo.getDate() + 1);
      data.fecha_fin_trabajo = finTrabajo.toISOString().split('T')[0]; // Ajustamos la fecha en el body
    }

    //  Ajuste similar para descanso si aplica
    if (data.hora_inicio_descanso && data.hora_fin_descanso && data.fecha_inicio_descanso && data.fecha_fin_descanso) {
      const inicioDescanso = new Date(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}:00`);
      let finDescanso = new Date(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}:00`);

      if (finDescanso <= inicioDescanso) {
        finDescanso.setDate(finDescanso.getDate() + 1);
        data.fecha_fin_descanso = finDescanso.toISOString().split('T')[0];
      }
    }

    //  Validación coherencia fechas después del ajuste
    if (finTrabajo <= inicioTrabajo) {
      return res.status(400).json({ success: false, message: 'La fecha/hora de fin debe ser posterior a la de inicio.' });
    }

    //  Validación descanso (si viene)
    if (data.fecha_inicio_descanso && data.fecha_fin_descanso && data.hora_inicio_descanso && data.hora_fin_descanso) {
      const inicioDescanso = new Date(`${data.fecha_inicio_descanso}T${data.hora_inicio_descanso}:00`);
      const finDescanso = new Date(`${data.fecha_fin_descanso}T${data.hora_fin_descanso}:00`);
      if (finDescanso <= inicioDescanso) {
        return res.status(400).json({ success: false, message: 'El fin del descanso debe ser posterior al inicio.' });
      }
      if (inicioDescanso < inicioTrabajo || finDescanso > finTrabajo) {
        return res.status(400).json({ success: false, message: 'El descanso debe estar dentro del rango del trabajo.' });
      }
    }

    //  Validación: en un mismo día, máximo 24h
    if (data.fecha_inicio_trabajo === data.fecha_fin_trabajo) {
      const diffHoras = (finTrabajo - inicioTrabajo) / (1000 * 60 * 60);
      if (diffHoras > 24) {
        return res.status(400).json({ success: false, message: 'En un mismo día no puede superar 24 horas.' });
      }
    }

    //  Validación global: máximo 48 horas continuas
    const diffGlobalHoras = (finTrabajo - inicioTrabajo) / (1000 * 60 * 60);
    if (diffGlobalHoras > 48) {
      return res.status(400).json({ success: false, message: 'El periodo no puede exceder 48 horas continuas.' });
    }

    //  Calcular las horas extras y categorías
    const calculos = calcularHorasExtras(data);

    //  Guardar en BD
    const nuevaExtra = new Extras({ ...data, ...calculos });
    await nuevaExtra.save();

    return res.status(201).json({
      success: true,
      message: 'Registro creado correctamente.',
      data: nuevaExtra
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Eliminar registro
const eliminarExtras = async (req, res) => {
  try {
    const { id } = req.params;
    const extra = await Extras.findByIdAndDelete(id);

    if (!extra) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }

    return res.status(200).json({ success: true, message: 'Registro eliminado correctamente.', data: extra });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Actualizar registro
const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;

    const extra = await Extras.findById(id);
    if (!extra) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado.' });
    }

    // Actualizar dinámicamente
    for (let campo in nuevosDatos) {
      if (extra[campo] !== undefined && extra[campo] !== nuevosDatos[campo]) {
        extra[campo] = nuevosDatos[campo];
      }
    }

    await extra.save();

    return res.status(200).json({ success: true, message: 'Registro actualizado correctamente.', data: extra });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { crearExtras, eliminarExtras, updateExtra };
