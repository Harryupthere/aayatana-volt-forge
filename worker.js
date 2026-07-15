require('dotenv').config();

const pool = require('./src/config/db.config');
const { startWorker } = require('./src/workers/blockchainWorker');

const start = async () => {
  await pool.testConnection();
  startWorker();
};

start();
