const pool = require('../config/db.config');

// Generic, parameterized CRUD helpers shared by every resource's queries file.
// `table` is always a hardcoded string from within the codebase, never user input.

const findAll = async (table, { where = '', params = [], orderBy = 'id DESC', limit, offset } = {}) => {
  let sql = `SELECT * FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  sql += ` ORDER BY ${orderBy}`;

  const finalParams = [...params];
  if (limit) {
    sql += ' LIMIT ?';
    finalParams.push(Number(limit));
    if (offset) {
      sql += ' OFFSET ?';
      finalParams.push(Number(offset));
    }
  }

  const [rows] = await pool.query(sql, finalParams);
  return rows;
};

const findOne = async (table, where, params = []) => {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, params);
  return rows[0];
};

const findById = async (table, id) => findOne(table, 'id = ?', [id]);

const insert = async (table, data) => {
  const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
  return findById(table, result.insertId);
};

const update = async (table, id, data) => {
  await pool.query(`UPDATE ${table} SET ? WHERE id = ?`, [data, id]);
  return findById(table, id);
};

const remove = async (table, id) => {
  const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

module.exports = { findAll, findOne, findById, insert, update, remove };
