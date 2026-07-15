const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'blockchain_transaction_queue';

module.exports = {
  getAllTransactions: (options) => findAll(TABLE, options),
  getTransactionById: (id) => findById(TABLE, id),
  getPendingTransactions: () => findAll(TABLE, { where: "status = 'pending'", orderBy: 'id ASC' }),
  getTransactionsByCompanyId: (companyId) =>
    findAll(TABLE, { where: 'company_id = ?', params: [companyId] }),
  getTransactionsByPassportId: (passportId) =>
    findAll(TABLE, { where: 'passport_id = ?', params: [passportId] }),
  createTransaction: (data) => insert(TABLE, data),
  updateTransaction: (id, data) => update(TABLE, id, data),
  setStatus: (id, status) => update(TABLE, id, { status }),
  deleteTransaction: (id) => remove(TABLE, id),
};
