const Cargo = require('../models/cargo');

const crearCargo = async (req, res) => {
  try {
    const { name } = req.body;

    const existente = await Cargo.findOne({ name: new RegExp(`^${name}$`, "i") });

    if (existente) {
      return res.status(400).json({
        success: false,
        message: "Ya existe el cargo"
      });
    }
    if (!name) return res.status(400).json({ success: false, message: 'El nombre del cargo es obligatorio.' });

    const nuevoCargo = new Cargo({ name });
    await nuevoCargo.save();

    res.status(201).json({ success: true, data: nuevoCargo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Error interno del servidor' });
  }
};

const listarCargos = async (req, res) => {
  try {
    const cargos = await Cargo.find({}, 'name');
    res.status(200).json({ success: true, data: cargos });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error al listar cargos' });
  }
};

// Eliminar registro
const eliminarCargo = async (req, res) => {
  try {
    const { id } = req.params;
    const cargo = await Cargo.findByIdAndDelete(id);
    if (!cargo) return res.status(404).json({ success: false, message: 'No encontrado' });
    res.status(200).json({ success: true, message: 'Registro eliminado', data: cargo });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { crearCargo, listarCargos, eliminarCargo };
