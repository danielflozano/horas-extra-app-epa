const Extras = require('../models/HorasExtras');
const {calcularHorasExtras} = require('../helpers/CalculoHoras');

const crearExtras = async (req, res) => {
  try {
    const data = req.body;

    // Validación básica
    if (!data.FuncionarioAsignado || !data.fecha_inicio_trabajo || !data.hora_inicio_trabajo || !data.hora_fin_trabajo) {
      return res.status(400).json({ success: false, message: 'Campos obligatorios faltantes.' });
    }

    // Calcular todas las horas
    const calculos = calcularHorasExtras(data);

    // Combinar data + cálculos
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

module.exports = { crearExtras,eliminarExtras,updateExtra };
