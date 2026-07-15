const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const adminQueries = require('../queries/admin.queries');
const walletHelper = require('../helpers/wallet.helper');

const getAdmins = asyncHandler(async (req, res) => {
  const admins = await adminQueries.getAllAdmins();
  return success(res, admins, 'Admins fetched successfully');
});

const getAdmin = asyncHandler(async (req, res) => {
  const admin = await adminQueries.getAdminById(req.params.id);
  if (!admin) throw new ApiError(404, 'Admin not found');
  return success(res, admin, 'Admin fetched successfully');
});

const createAdmin = asyncHandler(async (req, res) => {
  const { name, email } = req.body;

  const existing = await adminQueries.getAdminByEmail(email);
  if (existing) throw new ApiError(409, 'An admin with this email already exists');

  const admin = await adminQueries.createAdmin({ name, email });
  return success(res, admin, 'Admin created successfully', 201);
});

const updateAdmin = asyncHandler(async (req, res) => {
  const existing = await adminQueries.getAdminById(req.params.id);
  if (!existing) throw new ApiError(404, 'Admin not found');

  const { name, email } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (email !== undefined) data.email = email;

  const admin = await adminQueries.updateAdmin(req.params.id, data);
  return success(res, admin, 'Admin updated successfully');
});

const deleteAdmin = asyncHandler(async (req, res) => {
  const existing = await adminQueries.getAdminById(req.params.id);
  if (!existing) throw new ApiError(404, 'Admin not found');

  await adminQueries.deleteAdmin(req.params.id);
  return success(res, null, 'Admin deleted successfully');
});

// Imports an existing private key (e.g. a wallet pre-funded via the Amoy faucet) as this
// admin's custodial wallet. This is the wallet used to pay gas, fund companies, and call
// owner-only functions (addAuthorizedCompany) on the DigitalBatteryPassport contract.
const importAdminWallet = asyncHandler(async (req, res) => {
  const existing = await adminQueries.getAdminById(req.params.id);
  if (!existing) throw new ApiError(404, 'Admin not found');

  const { private_key } = req.body;
  const { address, encryptedPk } = walletHelper.importWallet(private_key);

  const admin = await adminQueries.updateAdmin(req.params.id, {
    wallet_address: address,
    encrypted_pk: encryptedPk,
  });
  return success(res, admin, 'Admin wallet imported successfully');
});

// Generates a brand-new custodial wallet for this admin. It holds 0 gas until funded
// manually (e.g. via the Amoy faucet) — useful for a fresh testnet setup.
const generateAdminWallet = asyncHandler(async (req, res) => {
  const existing = await adminQueries.getAdminById(req.params.id);
  if (!existing) throw new ApiError(404, 'Admin not found');

  const { address, encryptedPk } = walletHelper.generateWallet();

  const admin = await adminQueries.updateAdmin(req.params.id, {
    wallet_address: address,
    encrypted_pk: encryptedPk,
  });
  return success(res, admin, 'Admin wallet generated successfully. Fund it via the Amoy faucet before use.', 201);
});

module.exports = {
  getAdmins,
  getAdmin,
  createAdmin,
  updateAdmin,
  deleteAdmin,
  importAdminWallet,
  generateAdminWallet,
};
