const Cargo = require('../models/cargo');

const crearCargo = async (req, res) => {
  try {
    const {
      name
    } = req.body;

    if (
      !name
    ) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben estar completos.'
      });
    }

    // Aquí vendría la lógica para crear el registro en la base de datos
     const nuevoCargo = new Cargo(req.body);
     await nuevoCargo.save();

    res.status(201).json({
      success: true,
      message: 'Cargo creado correctamente.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error interno del servidor'
    });
  }
};

module.exports = { crearCargo };
