const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aayatana',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`Connected to MySQL database "${process.env.DB_NAME || 'aayatana'}" at ${process.env.DB_HOST || 'localhost'}`);
    connection.release();
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error.message);
    process.exit(1);
  }
};

module.exports = pool;
module.exports.testConnection = testConnection;
