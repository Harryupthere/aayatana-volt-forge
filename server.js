require('dotenv').config();

const app = require('./src/app');
const pool = require('./src/config/db.config');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await pool.testConnection();
  app.listen(PORT, () => {
    console.log(`Volt Forge backend running on http://localhost:${PORT}`);
  });
};

start();
