const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const passportQueries = require('../queries/passport.queries');
const companyQueries = require('../queries/company.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const blockchainService = require('../services/blockchain.service');
const { toBytes32 } = require('../helpers/hash.helper');

const getRecords = asyncHandler(async (req, res) => {
  const records = await recordQueries.getAllRecords();
  return success(res, records, 'Blockchain records fetched successfully');
});

const getRecordsByPassport = asyncHandler(async (req, res) => {
  const records = await recordQueries.getRecordsByPassportId(req.params.passportId);
  return success(res, records, 'Passport blockchain records fetched successfully');
});

const getRecordsByCompany = asyncHandler(async (req, res) => {
  const records = await recordQueries.getRecordsByCompanyId(req.params.companyId);
  return success(res, records, 'Company blockchain records fetched successfully');
});

const getRecord = asyncHandler(async (req, res) => {
  const record = await recordQueries.getRecordById(req.params.id);
  if (!record) throw new ApiError(404, 'Blockchain record not found');
  return success(res, record, 'Blockchain record fetched successfully');
});

const createRecord = asyncHandler(async (req, res) => {
  const { company_id, passport_id, passport_number, passport_hash, issuer_wallet, responsible_wallet } = req.body;

  const passport = await passportQueries.getPassportById(passport_id);
  if (!passport) throw new ApiError(404, 'Passport not found');

  const record = await recordQueries.createRecord({
    company_id,
    passport_id,
    passport_number,
    passport_hash,
    issuer_wallet,
    responsible_wallet,
    current_version: 1,
    status: 'pending',
    is_active: 1,
  });
  return success(res, record, 'Blockchain record created successfully', 201);
});

const updateRecord = asyncHandler(async (req, res) => {
  const existing = await recordQueries.getRecordById(req.params.id);
  if (!existing) throw new ApiError(404, 'Blockchain record not found');

  const allowedFields = [
    'latest_public_data_hash',
    'current_version',
    'responsible_wallet',
    'created_tx_hash',
    'created_block_number',
    'contract_address',
    'status',
    'is_active',
  ];
  const data = {};
  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  });

  const record = await recordQueries.updateRecord(req.params.id, data);
  return success(res, record, 'Blockchain record updated successfully');
});

const deleteRecord = asyncHandler(async (req, res) => {
  const existing = await recordQueries.getRecordById(req.params.id);
  if (!existing) throw new ApiError(404, 'Blockchain record not found');

  await recordQueries.deleteRecord(req.params.id);
  return success(res, null, 'Blockchain record deleted successfully');
});

// Company action: queues an updatePassport() call to record new lifecycle data on-chain.
const queueLifecycleUpdate = asyncHandler(async (req, res) => {
  const record = await recordQueries.getRecordById(req.params.id);
  if (!record) throw new ApiError(404, 'Blockchain record not found');

  const { data } = req.body;
  if (data === undefined) throw new ApiError(400, 'Missing required field(s): data');

  const wallet = await companyWalletQueries.getWalletByCompanyId(record.company_id);
  if (!wallet) throw new ApiError(400, 'Company has no custodial wallet');

  const newDataHash = toBytes32(data);
  const newVersion = (record.current_version || 1) + 1;

  const queueEntry = await queueQueries.createTransaction({
    company_id: record.company_id,
    passport_id: record.passport_id,
    passport_blockchain_record_id: record.id,
    transaction_type: 'update_passport',
    status: 'pending',
    payload: JSON.stringify({
      company_wallet_id: wallet.id,
      passport_number: record.passport_number,
      new_data_hash: newDataHash,
      new_version: newVersion,
    }),
  });

  const updatedRecord = await recordQueries.updateRecord(record.id, { status: 'pending' });
  return success(res, { record: updatedRecord, queued_job: queueEntry }, 'Lifecycle update queued', 201);
});

// Company action: queues a transferResponsibility() call, handing the passport off to
// another authorized company's wallet.
const queueTransferResponsibility = asyncHandler(async (req, res) => {
  const record = await recordQueries.getRecordById(req.params.id);
  if (!record) throw new ApiError(404, 'Blockchain record not found');

  const { new_company_id } = req.body;
  if (!new_company_id) throw new ApiError(400, 'Missing required field(s): new_company_id');

  const currentWallet = await companyWalletQueries.getWalletByCompanyId(record.company_id);
  if (!currentWallet) throw new ApiError(400, 'Current company has no custodial wallet');

  const newCompany = await companyQueries.getCompanyById(new_company_id);
  if (!newCompany) throw new ApiError(404, 'New responsible company not found');

  const newWallet = await companyWalletQueries.getWalletByCompanyId(new_company_id);
  if (!newWallet) throw new ApiError(400, 'New responsible company has no custodial wallet');

  const queueEntry = await queueQueries.createTransaction({
    company_id: record.company_id,
    passport_id: record.passport_id,
    passport_blockchain_record_id: record.id,
    transaction_type: 'transfer_responsibility',
    status: 'pending',
    payload: JSON.stringify({
      company_wallet_id: currentWallet.id,
      passport_number: record.passport_number,
      new_company_id,
      new_responsible_wallet: newWallet.wallet_address,
    }),
  });

  const updatedRecord = await recordQueries.updateRecord(record.id, { status: 'pending' });
  return success(res, { record: updatedRecord, queued_job: queueEntry }, 'Responsibility transfer queued', 201);
});

// Reads the passport directly from the chain (via the configured Infura RPC) and
// reconciles passport_blockchain_records with whatever is actually on-chain.
const syncFromChain = asyncHandler(async (req, res) => {
  const { passportNumber } = req.params;

  const passport = await passportQueries.getPassportByNumber(passportNumber);
  if (!passport) throw new ApiError(404, 'Passport not found in database');

  const records = await recordQueries.getRecordsByPassportId(passport.id);
  const record = records[0];
  if (!record) throw new ApiError(404, 'No blockchain record found for this passport');

  const onChain = await blockchainService.getPassportFromChain(passportNumber);

  if (!onChain.exists) {
    const updated = await recordQueries.updateRecord(record.id, { is_active: 0 });
    return success(res, { record: updated, onChain }, 'Passport does not exist on-chain yet');
  }

  const updated = await recordQueries.updateRecord(record.id, {
    latest_public_data_hash: onChain.latestDataHash,
    current_version: onChain.currentVersion,
    responsible_wallet: onChain.responsibleEntity,
    status: 'completed',
    is_active: 1,
  });

  return success(res, { record: updated, onChain }, 'Synced from chain successfully');
});

module.exports = {
  getRecords,
  getRecordsByPassport,
  getRecordsByCompany,
  getRecord,
  createRecord,
  updateRecord,
  deleteRecord,
  queueLifecycleUpdate,
  queueTransferResponsibility,
  syncFromChain,
};
