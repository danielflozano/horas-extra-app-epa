require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  mongoUri: process.env.MONGO_URI,
  emailUser: process.env.EMAIL_USER,
  emailPass: process.env.EMAIL_PASS,
  inicio_Jornada : process.env.INICIO_JORNADA,
  fin_jornada : process.env.FIN_JORNADA
};