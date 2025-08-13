require('dotenv').config();
const mongoose = require('mongoose');

const dbConnection = async() => {
  try {

    await mongoose.connect(process.env.MONGO_URI);

    console.log('DB Online');    
  } catch (error) {
    console.error('❌ Error al conectar la base de datos:', error);
    process.exit(1);

  }
}

module.exports = {
  dbConnection
}