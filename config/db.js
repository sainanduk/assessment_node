require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('Attempting to connect to Neon database...');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  protocol: 'postgres',
  logging: console.log, // Enable logging temporarily for debugging
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false  // Required for Neon
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;
