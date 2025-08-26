
const Extras = require('../models/HorasExtras');

const crearExtras = async (req, res) => {
  try {
    const { nombre_completo, identificacion, hora_inicio, hora_fin } = req.body;

    if (!nombre_completo || !identificacion || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben estar completos.'
      });
    }

    const horaRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!horaRegex.test(hora_inicio) || !horaRegex.test(hora_fin)) {
      return res.status(400).json({
        success: false,
        message: 'Formato de hora inválido. Debe ser HH:mm'
      });
    }

    const nuevaExtra = new Extras({
      ...req.body,
      nombre_completo: nombre_completo.trim(),
      identificacion: identificacion.trim()
    });

    await nuevaExtra.save();

    res.status(201).json({
      success: true,
      message: 'Registro de horas extra creado correctamente.',
      data: nuevaExtra
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const eliminarExtras = async (req, res) => {
  try {
    const { id } = req.params;


    const extra = await Extras.findByIdAndDelete(id);

    if (!extra) {
      return res.status(404).json({
        success: false,
        message: 'Extra no encontrado.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Extra eliminado correctamente.',
      data: extra
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al eliminar extra'
    });
  }
};

const updateExtra = async (req, res) => {
  try {
    const { id } = req.params;
    const nuevosDatos = req.body;

    const extra = await Extras.findById(id);
    if (!extra) {
      return res.status(404).json({
        success: false,
        message: 'Extra no encontrado.'
      });
    }

    for (let campo in nuevosDatos) {
      if (extra[campo] !== undefined && extra[campo] !== nuevosDatos[campo]) {
        extra[campo] = nuevosDatos[campo];
      }
    }

    await extra.save(); // guardar cambios

    return res.status(200).json({
      success: true,
      message: 'Extra actualizado correctamente.',
      data: extra
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error interno al actualizar extra'
    });
  }
};
module.exports = { crearExtras, eliminarExtras,updateExtra };
