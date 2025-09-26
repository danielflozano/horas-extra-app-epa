const Funcionario = require('../models/Funcionarios');
const Cargo = require('../models/cargo');

// Crear un funcionario
const crearFuncionario = async (req, res) => {
    try {
        const { nombre_completo, identificacion, tipoOperario, Cargo: cargoId,estado} = req.body;

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
            Cargo: cargo._id,
            estado: estado || 'Activo'  
        });

        await nuevoFuncionario.save();

        res.status(201).json({ success: true, data: nuevoFuncionario, message:'Funcionario creado con exito' }); // TODO: Debo dejar esto !!!
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error creando el funcionario' });
    }
};

const actualizarFuncionario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre_completo, identificacion, tipoOperario, Cargo: cargoId, estado } = req.body;

        // Validación enums
        const tiposValidos = ['Planta', 'Temporal'];
        const estadosValidos = ['Activo', 'Inactivo'];

        if (tipoOperario && !tiposValidos.includes(tipoOperario)) {
            return res.status(400).json({ success: false, message: `Tipo de operario inválido. Valores: ${tiposValidos.join(', ')}` });
        }

        if (estado && !estadosValidos.includes(estado)) {
            return res.status(400).json({ success: false, message: `Estado inválido. Valores: ${estadosValidos.join(', ')}` });
        }

        const funcionario = await Funcionario.findById(id);
        if (!funcionario) {
            return res.status(404).json({ success: false, message: 'Funcionario no encontrado' });
        }

        // Validar identificación única (excepto el propio funcionario)
        if (identificacion && identificacion !== funcionario.identificacion) {
            const existente = await Funcionario.findOne({ identificacion });
            if (existente) {
                return res.status(400).json({ success: false, message: 'Ya existe un funcionario con esta identificación' });
            }
        }

        // Validar cargo si se envía
        if (cargoId) {
            const cargo = await Cargo.findById(cargoId);
            if (!cargo) return res.status(404).json({ success: false, message: 'Cargo no encontrado' });
            funcionario.Cargo = cargo._id;
        }

        // Actualizar campos
        if (nombre_completo) funcionario.nombre_completo = nombre_completo;
        if (identificacion) funcionario.identificacion = identificacion;
        if (tipoOperario) funcionario.tipoOperario = tipoOperario;
        if (estado) funcionario.estado = estado;

        await funcionario.save();

        res.json({ success: true, data: funcionario });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error actualizando el funcionario' });
    }
};


// Listar todos los funcionarios
const listarFuncionarios = async (req, res) => {
    try {
        const funcionarios = await Funcionario.find().populate('Cargo', 'name'); 
        res.status(200).json({ success: true, data: funcionarios });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al listar los funcionarios' });
    }
};

const listarFuncionariosActivos = async (req, res) => {
    try {
        const funcionarios = await Funcionario.find({ estado: "Activo" })
           .populate("Cargo", "name");

        res.status(200).json({ success: true, data: funcionarios });
    } catch (error) {
        console.error("Error al listar funcionarios activos:", error);
        res.status(500).json({ success: false, message: "Error al listar los funcionarios activos" });
    }
};


const obtenerFuncionarioPorId = async (req, res) => {
    try {
        const { identificacion } = req.params; 
        const funcionario = await Funcionario.findOne({ identificacion }).populate('Cargo');

        if (!funcionario) {
            return res.status(404).json({ success: false, message: 'Funcionario no encontrado' });
        }

        res.json({ success: true, data: funcionario });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error al obtener el funcionario' });
    }
};



module.exports = { crearFuncionario, listarFuncionarios, actualizarFuncionario, obtenerFuncionarioPorId, listarFuncionariosActivos};
