const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'wallet_funding_logs';

module.exports = {
  getAllFundingLogs: (options) => findAll(TABLE, options),
  getFundingLogById: (id) => findById(TABLE, id),
  getFundingLogsByCompanyId: (companyId) =>
    findAll(TABLE, { where: 'company_id = ?', params: [companyId] }),
  createFundingLog: (data) => insert(TABLE, data),
  updateFundingLog: (id, data) => update(TABLE, id, data),
  deleteFundingLog: (id) => remove(TABLE, id),
};
