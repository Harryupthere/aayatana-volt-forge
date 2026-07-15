const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const { processQueueItem } = require('../workers/blockchainWorker');

const getTransactions = asyncHandler(async (req, res) => {
  const transactions = await queueQueries.getAllTransactions();
  return success(res, transactions, 'Transactions fetched successfully');
});

const getPendingTransactions = asyncHandler(async (req, res) => {
  const transactions = await queueQueries.getPendingTransactions();
  return success(res, transactions, 'Pending transactions fetched successfully');
});

const getTransactionsByCompany = asyncHandler(async (req, res) => {
  const transactions = await queueQueries.getTransactionsByCompanyId(req.params.companyId);
  return success(res, transactions, 'Company transactions fetched successfully');
});

const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await queueQueries.getTransactionById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  return success(res, transaction, 'Transaction fetched successfully');
});

const createTransaction = asyncHandler(async (req, res) => {
  const { company_id, passport_id, passport_blockchain_record_id, transaction_type, payload } = req.body;

  const transaction = await queueQueries.createTransaction({
    company_id,
    passport_id,
    passport_blockchain_record_id,
    transaction_type: transaction_type || 'create_passport',
    payload: payload !== undefined ? JSON.stringify(payload) : null,
    status: 'pending',
  });
  return success(res, transaction, 'Transaction queued successfully', 201);
});

const updateTransactionStatus = asyncHandler(async (req, res) => {
  const existing = await queueQueries.getTransactionById(req.params.id);
  if (!existing) throw new ApiError(404, 'Transaction not found');

  const { status, transaction_hash, error_message, retry_count } = req.body;
  const validStatuses = ['pending', 'processing', 'completed', 'failed'];
  if (status && !validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
  }

  const data = {};
  if (status !== undefined) data.status = status;
  if (transaction_hash !== undefined) data.transaction_hash = transaction_hash;
  if (error_message !== undefined) data.error_message = error_message;
  if (retry_count !== undefined) data.retry_count = retry_count;

  const transaction = await queueQueries.updateTransaction(req.params.id, data);
  return success(res, transaction, 'Transaction updated successfully');
});

const deleteTransaction = asyncHandler(async (req, res) => {
  const existing = await queueQueries.getTransactionById(req.params.id);
  if (!existing) throw new ApiError(404, 'Transaction not found');

  await queueQueries.deleteTransaction(req.params.id);
  return success(res, null, 'Transaction deleted successfully');
});

// Dev/admin convenience: process a single queued job immediately instead of waiting
// for the background worker's next poll cycle.
const processTransactionNow = asyncHandler(async (req, res) => {
  const transaction = await queueQueries.getTransactionById(req.params.id);
  if (!transaction) throw new ApiError(404, 'Transaction not found');
  if (transaction.status === 'completed') throw new ApiError(400, 'Transaction already completed');

  await processQueueItem(transaction);
  const updated = await queueQueries.getTransactionById(req.params.id);
  return success(res, updated, 'Transaction processed');
});

module.exports = {
  getTransactions,
  getPendingTransactions,
  getTransactionsByCompany,
  getTransaction,
  createTransaction,
  updateTransactionStatus,
  deleteTransaction,
  processTransactionNow,
};
