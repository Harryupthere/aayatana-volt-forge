const { findAll, findOne, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'passports';

module.exports = {
  getAllPassports: (options) => findAll(TABLE, options),
  getPassportById: (id) => findById(TABLE, id),
  getPassportsByCompanyId: (companyId) =>
    findAll(TABLE, { where: 'company_id = ?', params: [companyId] }),
  getPassportByNumber: (passport_number) => findOne(TABLE, 'passport_number = ?', [passport_number]),
  createPassport: (data) => insert(TABLE, data),
  updatePassport: (id, data) => update(TABLE, id, data),
  deletePassport: (id) => remove(TABLE, id),
};
