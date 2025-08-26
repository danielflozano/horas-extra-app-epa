const Funcionarios = require('../models/Funcionarios');

const crearFuncionario = async (req, res) => {
  try {
    const {
      nombre_completo,
      identificacion,
      tipoOperario,
      cargo,
    } = req.body;

    if (
      !nombre_completo ||
      !identificacion ||
      !tipoOperario ||
      !cargo
    ) {
      return res.status(400).json({
        success: false,
        message: 'Todos los campos obligatorios deben estar completos.'
      });
    }

    // Aquí vendría la lógica para crear el registro en la base de datos
     const nuevoFuncionario = new Funcionarios(req.body);
     await nuevoFuncionario.save();

    res.status(201).json({
      success: true,
      message: 'Funcionario creado correctamente.'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error interno del servidor'
    });
  }
};

module.exports = { crearFuncionario };
