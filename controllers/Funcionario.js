const Funcionario = require('../models/Funcionarios');
const Cargo = require('../models/cargo');

// Crear un funcionario
const crearFuncionario = async (req, res) => {
    try {
        const { nombre_completo, identificacion, tipoOperario, Cargo: cargoId } = req.body;

        // Validación de enum
        const tiposValidos = ['Planta', 'Temporal'];
        if (!tiposValidos.includes(tipoOperario)) {
            return res.status(400).json({
                success: false,
                message: `Tipo de operario inválido. Válidos: ${tiposValidos.join(', ')}`
            });
        }

        // Verificar que el cargo exista
        const cargo = await Cargo.findById(cargoId);
        if (!cargo) return res.status(404).json({ success: false, message: 'Cargo no encontrado' });

        // **Validación: no permitir identificaciones duplicadas**
        const existente = await Funcionario.findOne({ identificacion });
        if (existente) return res.status(400).json({
            success: false,
            message: 'Ya existe un funcionario con esta identificación'
        });

        const nuevoFuncionario = new Funcionario({
            nombre_completo,
            identificacion,
            tipoOperario,
            Cargo: cargo._id
        });

        await nuevoFuncionario.save();

        res.status(201).json({ success: true, data: nuevoFuncionario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creando el funcionario' });
    }
};

// Listar todos los funcionarios
const listarFuncionarios = async (req, res) => {
    try {
        const funcionarios = await Funcionario.find().populate('Cargo', 'name'); // populate con "name"
        res.status(200).json({ success: true, data: funcionarios });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al listar los funcionarios' });
    }
};

module.exports = { crearFuncionario, listarFuncionarios };
