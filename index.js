
const express = require('express');
require('dotenv').config();
const cors = require('cors');
const { dbConnection } = require('./database/config');
const os = require('os');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const PORT =  process.env.PORT || 4000;


// Crear servidor de express
const app = express();

// Base de datos
dbConnection();

// CORS
app.use(cors());

// Directorio Público
app.use( express.static('public') );

// Lectura y parseo del body
app.use(express.json());

// Rutas
// TODO: auth // crear, login, renew
app.use('/api/auth', require('./routes/auth'));
app.use('/api/extras', require('./routes/extras'));
app.use('/api/funcionario', require('./routes/funcionario'));
app.use('/api/cargos', require('./routes/cargo'));
app.use('/api/Reporte', require('./routes/reporte'))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// TODO: CRUD: eventos
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Escuchar peticiones
app.listen( process.env.PORT, () => {
  console.log(`✅ Servidor Express escuchando en http://localhost:${PORT}`);
  const ip = getLocalIP();
  console.log(`📚 Swagger disponible en: http://${ip}:${PORT}/api-docs`);
} );