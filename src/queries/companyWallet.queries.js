const pool = require('../config/db.config');
const { findAll, findOne, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'company_wallets';

const adjustBalance = async (id, amount) => {
  await pool.query(`UPDATE ${TABLE} SET current_balance = current_balance + ? WHERE id = ?`, [amount, id]);
  return findById(TABLE, id);
};

module.exports = {
  getAllWallets: (options) => findAll(TABLE, options),
  getWalletById: (id) => findById(TABLE, id),
  getWalletByAddress: (wallet_address) => findOne(TABLE, 'wallet_address = ?', [wallet_address]),
  getWalletByCompanyId: (companyId) => findOne(TABLE, 'company_id = ?', [companyId]),
  createWallet: (data) => insert(TABLE, data),
  updateWallet: (id, data) => update(TABLE, id, data),
  adjustBalance,
  deleteWallet: (id) => remove(TABLE, id),
};
