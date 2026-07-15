const { findAll, findOne, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'admins';

module.exports = {
  getAllAdmins: (options) => findAll(TABLE, options),
  getAdminById: (id) => findById(TABLE, id),
  getAdminByEmail: (email) => findOne(TABLE, 'email = ?', [email]),
  createAdmin: (data) => insert(TABLE, data),
  updateAdmin: (id, data) => update(TABLE, id, data),
  deleteAdmin: (id) => remove(TABLE, id),
};
