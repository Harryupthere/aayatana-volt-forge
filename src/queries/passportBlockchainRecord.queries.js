const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'passport_blockchain_records';

module.exports = {
  getAllRecords: (options) => findAll(TABLE, options),
  getRecordById: (id) => findById(TABLE, id),
  getRecordsByPassportId: (passportId) =>
    findAll(TABLE, { where: 'passport_id = ?', params: [passportId] }),
  getRecordsByCompanyId: (companyId) =>
    findAll(TABLE, { where: 'company_id = ?', params: [companyId] }),
  createRecord: (data) => insert(TABLE, data),
  updateRecord: (id, data) => update(TABLE, id, data),
  deleteRecord: (id) => remove(TABLE, id),
};
