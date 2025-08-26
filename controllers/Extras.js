const Extras = require('../models/HorasExtras');

// Crear registro de horas extras
const crearExtras = async (req, res) => {
  try {
    const {
      FuncionarioAsignado,
      fecha_inicio_trabajo,
      fecha_fin_trabajo,
      hora_inicio_trabajo,
      hora_fin_trabajo,
      fecha_inicio_descanso,
      fecha_fin_descanso,
      hora_inicio_descanso,
      hora_fin_descanso
    } = req.body;

    if (
     
      !FuncionarioAsignado||
      !fecha_inicio_trabajo ||
      !fecha_fin_trabajo ||
      !hora_inicio_trabajo ||
      !hora_fin_trabajo
    ) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben estar completos.'
      });
    }

    // ✅ Validación de formato de hora (solo si se envían)
    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora_inicio_trabajo) || !horaRegex.test(hora_fin_trabajo)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido en hora de trabajo. Debe ser HH:mm (24h).'
      });
    }
    if (
      (hora_inicio_descanso && !horaRegex.test(hora_inicio_descanso)) ||
      (hora_fin_descanso && !horaRegex.test(hora_fin_descanso))
    ) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido en descanso. Debe ser HH:mm (24h).'
      });
    }

    // ✅ Crear el documento
    const nuevaExtra = new Extras({
      FuncionarioAsignado,
      fecha_inicio_trabajo,
      fecha_fin_trabajo,
      hora_inicio_trabajo,
      hora_fin_trabajo,
      fecha_inicio_descanso,
      fecha_fin_descanso,
      hora_inicio_descanso,
      hora_fin_descanso
    });

    // ✅ Guardar (el pre-save hook hará cálculos: horas trabajadas, descanso, día)
    await nuevaExtra.save();

    res.status(201).json({
      success: true,
      message: 'Registro de horas extra creado correctamente.',
      data: nuevaExtra
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error interno en el servidor'
    });
  }
};

// Eliminar registro
const eliminarExtras = async (req, res) => {
  try {
    const { id } = req.params;

    const extra = await Extras.findByIdAndDelete(id);

    if (!extra) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Registro eliminado correctamente.',
      data: extra
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al eliminar'
    });
  }
};

// Actualizar registro
const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;

    const extra = await Extras.findById(id);
    if (!extra) {
      return res.status(404).json({
        success: false,
        message: 'Registro no encontrado.'
      });
    }

    // Actualizar campos dinámicamente
    for (let campo in nuevosDatos) {
      if (extra[campo] !== undefined && extra[campo] !== nuevosDatos[campo]) {
        extra[campo] = nuevosDatos[campo];
      }
    }

    // ✅ Guardar para recalcular en el hook
    await extra.save();

    return res.status(200).json({
      success: true,
      message: 'Registro actualizado correctamente.',
      data: extra
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al actualizar'
    });
  }
};

module.exports = { crearExtras, eliminarExtras, updateExtra };
