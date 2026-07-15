const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const fundingLogQueries = require('../queries/walletFundingLog.queries');
const walletQueries = require('../queries/companyWallet.queries');
const companyQueries = require('../queries/company.queries');

const getFundingLogs = asyncHandler(async (req, res) => {
  const logs = await fundingLogQueries.getAllFundingLogs();
  return success(res, logs, 'Funding logs fetched successfully');
});

const getFundingLogsByCompany = asyncHandler(async (req, res) => {
  const logs = await fundingLogQueries.getFundingLogsByCompanyId(req.params.companyId);
  return success(res, logs, 'Company funding logs fetched successfully');
});

const getFundingLog = asyncHandler(async (req, res) => {
  const log = await fundingLogQueries.getFundingLogById(req.params.id);
  if (!log) throw new ApiError(404, 'Funding log not found');
  return success(res, log, 'Funding log fetched successfully');
});

// Admin action: fund a company's wallet and record the transaction.
const createFundingLog = asyncHandler(async (req, res) => {
  const { company_id, wallet_address, amount, transaction_hash, funded_by, remarks } = req.body;

  const company = await companyQueries.getCompanyById(company_id);
  if (!company) throw new ApiError(404, 'Company not found');

  const log = await fundingLogQueries.createFundingLog({
    company_id,
    wallet_address,
    amount,
    transaction_hash,
    funded_by,
    remarks,
  });

  const wallet = await walletQueries.getWalletByAddress(wallet_address);
  if (wallet) {
    await walletQueries.adjustBalance(wallet.id, amount);
  }

  return success(res, log, 'Wallet funding recorded successfully', 201);
});

const deleteFundingLog = asyncHandler(async (req, res) => {
  const existing = await fundingLogQueries.getFundingLogById(req.params.id);
  if (!existing) throw new ApiError(404, 'Funding log not found');

  await fundingLogQueries.deleteFundingLog(req.params.id);
  return success(res, null, 'Funding log deleted successfully');
});

module.exports = { getFundingLogs, getFundingLogsByCompany, getFundingLog, createFundingLog, deleteFundingLog };
