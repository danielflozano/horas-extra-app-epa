// swagger.js
const swaggerJSDoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0", 
    info: {
      title: "Mi API Documentada",
      version: "1.0.0",
      description: "Documentación de mi API con Swagger",
    },
  },
  apis: ["./routes/*.js"], 
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;