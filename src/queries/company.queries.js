const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

// Table name matches mysql-queries.sql exactly (including the "registrtion" spelling).
const TABLE = 'company_registrtion';

module.exports = {
  getAllCompanies: (options) => findAll(TABLE, options),
  getCompanyById: (id) => findById(TABLE, id),
  createCompany: (data) => insert(TABLE, data),
  updateCompany: (id, data) => update(TABLE, id, data),
  setApprovalStatus: (id, is_approved) => update(TABLE, id, { is_approved }),
  deleteCompany: (id) => remove(TABLE, id),
};
