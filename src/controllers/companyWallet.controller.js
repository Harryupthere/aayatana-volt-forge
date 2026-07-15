const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const walletQueries = require('../queries/companyWallet.queries');
const walletHelper = require('../helpers/wallet.helper');

const getWallets = asyncHandler(async (req, res) => {
  const wallets = await walletQueries.getAllWallets();
  return success(res, wallets, 'Wallets fetched successfully');
});

const getWallet = asyncHandler(async (req, res) => {
  const wallet = await walletQueries.getWalletById(req.params.id);
  if (!wallet) throw new ApiError(404, 'Wallet not found');
  return success(res, wallet, 'Wallet fetched successfully');
});

const getWalletByCompany = asyncHandler(async (req, res) => {
  const wallet = await walletQueries.getWalletByCompanyId(req.params.companyId);
  if (!wallet) throw new ApiError(404, 'No wallet found for this company');
  return success(res, wallet, 'Wallet fetched successfully');
});

// Manual/admin path: import an existing private key as a company's custodial wallet.
// Normally wallets are created automatically when an admin approves a company_application.
const createWallet = asyncHandler(async (req, res) => {
  const { company_id, private_key, current_balance } = req.body;

  const { address, encryptedPk } = walletHelper.importWallet(private_key);

  const existing = await walletQueries.getWalletByAddress(address);
  if (existing) throw new ApiError(409, 'A wallet with this address already exists');

  const wallet = await walletQueries.createWallet({
    company_id: company_id ?? null,
    wallet_address: address,
    encrypted_pk: encryptedPk,
    current_balance: current_balance ?? 0,
  });
  return success(res, wallet, 'Wallet created successfully', 201);
});

const updateWallet = asyncHandler(async (req, res) => {
  const existing = await walletQueries.getWalletById(req.params.id);
  if (!existing) throw new ApiError(404, 'Wallet not found');

  const { status } = req.body;
  const data = {};
  if (status !== undefined) data.status = status;

  const wallet = await walletQueries.updateWallet(req.params.id, data);
  return success(res, wallet, 'Wallet updated successfully');
});

const deleteWallet = asyncHandler(async (req, res) => {
  const existing = await walletQueries.getWalletById(req.params.id);
  if (!existing) throw new ApiError(404, 'Wallet not found');

  await walletQueries.deleteWallet(req.params.id);
  return success(res, null, 'Wallet deleted successfully');
});

module.exports = { getWallets, getWallet, getWalletByCompany, createWallet, updateWallet, deleteWallet };
