// config/db.config.js
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'aayatana',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true,
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log(`Connected to MySQL database "${process.env.DB_NAME || 'aayatana'}" at ${process.env.DB_HOST || 'localhost'}`);
    connection.release();
  } catch (error) {
    console.error('Failed to connect to MySQL database:', error.message);
    process.exit(1);
  }
};

module.exports = pool;
module.exports.testConnection = testConnection;



// config/web3.config.js
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const ApiError = require('../helpers/ApiError.helper');

let provider;
let contractAbi;

// Lazily initialized so the API can boot and serve non-blockchain routes even
// before POLYGON_AMOY_RPC_URL / CONTRACT_ADDRESS are configured.
const getProvider = () => {
  if (provider) return provider;

  if (!process.env.POLYGON_AMOY_RPC_URL) {
    throw new ApiError(500, 'POLYGON_AMOY_RPC_URL is not configured');
  }

  provider = new ethers.JsonRpcProvider(process.env.POLYGON_AMOY_RPC_URL, {
    chainId: Number(process.env.CHAIN_ID) || 80002,
    name: 'polygon-amoy',
  });
  return provider;
};

const getContractAbi = () => {
  if (contractAbi) return contractAbi;

  const abiPath = path.resolve(process.cwd(), process.env.CONTRACT_ABI_PATH || './src/contracts/VoltForgeOS.abi.json');
  contractAbi = JSON.parse(fs.readFileSync(abiPath, 'utf-8'));
  return contractAbi;
};

// Pass an ethers Signer to write to the chain, or omit/pass the provider for read-only calls.
const getContract = (signerOrProvider) => {
  if (!process.env.CONTRACT_ADDRESS) {
    throw new ApiError(500, 'CONTRACT_ADDRESS is not configured');
  }

  return new ethers.Contract(process.env.CONTRACT_ADDRESS, getContractAbi(), signerOrProvider || getProvider());
};

module.exports = { getProvider, getContractAbi, getContract };


// controllers/admin.controller.js
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

// controllers/blockchainTransactionQueue.controller.js
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

// controllers/company.controller.js
const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const companyQueries = require('../queries/company.queries');

const getCompanies = asyncHandler(async (req, res) => {
  const companies = await companyQueries.getAllCompanies();
  return success(res, companies, 'Companies fetched successfully');
});

const getCompany = asyncHandler(async (req, res) => {
  const company = await companyQueries.getCompanyById(req.params.id);
  if (!company) throw new ApiError(404, 'Company not found');
  return success(res, company, 'Company fetched successfully');
});

const registerCompany = asyncHandler(async (req, res) => {
  const { name, address } = req.body;
  const company = await companyQueries.createCompany({ name, address });
  return success(res, company, 'Company registered successfully. Pending admin approval.', 201);
});

const updateCompany = asyncHandler(async (req, res) => {
  const existing = await companyQueries.getCompanyById(req.params.id);
  if (!existing) throw new ApiError(404, 'Company not found');

  const { name, address, status } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (address !== undefined) data.address = address;
  if (status !== undefined) data.status = status;

  const company = await companyQueries.updateCompany(req.params.id, data);
  return success(res, company, 'Company updated successfully');
});

const approveCompany = asyncHandler(async (req, res) => {
  const existing = await companyQueries.getCompanyById(req.params.id);
  if (!existing) throw new ApiError(404, 'Company not found');

  const { is_approved } = req.body;
  if (!['yes', 'no'].includes(is_approved)) {
    throw new ApiError(400, "is_approved must be 'yes' or 'no'");
  }

  const company = await companyQueries.setApprovalStatus(req.params.id, is_approved);
  return success(res, company, 'Company approval status updated successfully');
});

const deleteCompany = asyncHandler(async (req, res) => {
  const existing = await companyQueries.getCompanyById(req.params.id);
  if (!existing) throw new ApiError(404, 'Company not found');

  await companyQueries.deleteCompany(req.params.id);
  return success(res, null, 'Company deleted successfully');
});

module.exports = { getCompanies, getCompany, registerCompany, updateCompany, approveCompany, deleteCompany };

// controllers/companyApplication.controller.js
const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const applicationQueries = require('../queries/companyApplication.queries');
const companyQueries = require('../queries/company.queries');
const planQueries = require('../queries/plan.queries');
const adminQueries = require('../queries/admin.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const walletHelper = require('../helpers/wallet.helper');

const getApplications = asyncHandler(async (req, res) => {
  const applications = await applicationQueries.getAllApplications();
  return success(res, applications, 'Applications fetched successfully');
});

const getApplicationsByCompany = asyncHandler(async (req, res) => {
  const applications = await applicationQueries.getApplicationsByCompanyId(req.params.companyId);
  return success(res, applications, 'Company applications fetched successfully');
});

const getApplication = asyncHandler(async (req, res) => {
  const application = await applicationQueries.getApplicationWithDetails(req.params.id);
  if (!application) throw new ApiError(404, 'Application not found');
  return success(res, application, 'Application fetched successfully');
});

const createApplication = asyncHandler(async (req, res) => {
  const { company_id, plan_id } = req.body;

  const company = await companyQueries.getCompanyById(company_id);
  if (!company) throw new ApiError(404, 'Company not found');

  const plan = await planQueries.getPlanById(plan_id);
  if (!plan) throw new ApiError(404, 'Plan not found');

  const application = await applicationQueries.createApplication({ company_id, plan_id });
  return success(res, application, 'Application submitted successfully. Pending admin approval.', 201);
});

// Approving an application is the trigger point for the whole on-chain onboarding:
// it ensures the company has a custodial wallet, then queues an 'add_company' job
// (calls addAuthorizedCompany on-chain) followed by a 'fund_wallet' job (transfers the
// plan's polygon_quantity from the admin's wallet to the company's wallet). Jobs are
// processed in insertion order, so add_company runs first.
const approveApplication = asyncHandler(async (req, res) => {
  const existing = await applicationQueries.getApplicationById(req.params.id);
  if (!existing) throw new ApiError(404, 'Application not found');

  const { is_approved, approved_by } = req.body;
  if (!['yes', 'no'].includes(is_approved)) {
    throw new ApiError(400, "is_approved must be 'yes' or 'no'");
  }

  const application = await applicationQueries.setApprovalStatus(req.params.id, is_approved);

  if (is_approved !== 'yes') {
    return success(res, application, 'Application approval status updated successfully');
  }

  if (!approved_by) {
    throw new ApiError(400, 'approved_by (admin id) is required when approving an application');
  }
  const admin = await adminQueries.getAdminById(approved_by);
  if (!admin) throw new ApiError(404, 'Approving admin not found');
  if (!admin.wallet_address || !admin.encrypted_pk) {
    throw new ApiError(400, "Approving admin has no custodial wallet. Import or generate one first via /admins/:id/wallet");
  }

  const company = await companyQueries.getCompanyById(application.company_id);
  if (!company) throw new ApiError(404, 'Company not found');
  if (company.is_approved !== 'yes') {
    await companyQueries.setApprovalStatus(company.id, 'yes');
  }

  const plan = await planQueries.getPlanById(application.plan_id);
  if (!plan) throw new ApiError(404, 'Plan not found');

  let wallet = await companyWalletQueries.getWalletByCompanyId(company.id);
  if (!wallet) {
    const { address, encryptedPk } = walletHelper.generateWallet();
    wallet = await companyWalletQueries.createWallet({
      company_id: company.id,
      wallet_address: address,
      encrypted_pk: encryptedPk,
      current_balance: 0,
    });
  }

  const addCompanyJob = await queueQueries.createTransaction({
    company_id: company.id,
    transaction_type: 'add_company',
    status: 'pending',
    payload: JSON.stringify({
      admin_id: admin.id,
      company_wallet_id: wallet.id,
      company_wallet_address: wallet.wallet_address,
      application_id: application.id,
    }),
  });

  const fundWalletJob = await queueQueries.createTransaction({
    company_id: company.id,
    transaction_type: 'fund_wallet',
    status: 'pending',
    payload: JSON.stringify({
      admin_id: admin.id,
      company_wallet_id: wallet.id,
      company_wallet_address: wallet.wallet_address,
      amount: plan.polygon_quantity,
      application_id: application.id,
      plan_id: plan.id,
    }),
  });

  return success(
    res,
    { application, wallet, queued_jobs: [addCompanyJob, fundWalletJob] },
    'Application approved. On-chain authorization and wallet funding have been queued.'
  );
});

const deleteApplication = asyncHandler(async (req, res) => {
  const existing = await applicationQueries.getApplicationById(req.params.id);
  if (!existing) throw new ApiError(404, 'Application not found');

  await applicationQueries.deleteApplication(req.params.id);
  return success(res, null, 'Application deleted successfully');
});

module.exports = {
  getApplications,
  getApplicationsByCompany,
  getApplication,
  createApplication,
  approveApplication,
  deleteApplication,
};

// controllers/companyWallet.controller.js
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

// controllers/passport.controller.js
const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const passportQueries = require('../queries/passport.queries');
const companyQueries = require('../queries/company.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const applicationQueries = require('../queries/companyApplication.queries');
const planQueries = require('../queries/plan.queries');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const { toBytes32 } = require('../helpers/hash.helper');

const getPassports = asyncHandler(async (req, res) => {
  const passports = await passportQueries.getAllPassports();
  return success(res, passports, 'Passports fetched successfully');
});

const getPassportsByCompany = asyncHandler(async (req, res) => {
  const passports = await passportQueries.getPassportsByCompanyId(req.params.companyId);
  return success(res, passports, 'Company passports fetched successfully');
});

const getPassport = asyncHandler(async (req, res) => {
  const passport = await passportQueries.getPassportById(req.params.id);
  if (!passport) throw new ApiError(404, 'Passport not found');
  return success(res, passport, 'Passport fetched successfully');
});

// Creates the off-chain passport record, then queues an on-chain createPassport() call
// signed by the company's custodial wallet. The blockchain worker processes the queue
// and fills in passport_blockchain_records with the resulting tx hash/block/status.
const createPassport = asyncHandler(async (req, res) => {
  const { company_id, passport_number } = req.body;
const passport_hash =toBytes32(passport_number)
  const company = await companyQueries.getCompanyById(company_id);
  if (!company) throw new ApiError(404, 'Company not found');
  if (company.is_approved !== 'yes') {
    throw new ApiError(403, 'Company is not approved to issue passports');
  }

  const duplicate = await passportQueries.getPassportByNumber(passport_number);
  if (duplicate) throw new ApiError(409, 'A passport with this number already exists');

  const wallet = await companyWalletQueries.getWalletByCompanyId(company_id);
  if (!wallet) {
    throw new ApiError(400, 'Company has no custodial wallet yet. It is created when an application is approved.');
  }

  const applications = await applicationQueries.getApplicationsByCompanyId(company_id);
  const approvedApplication = applications.find((a) => a.is_approved === 'yes' && a.status === 'active');
  if (!approvedApplication) {
    throw new ApiError(403, 'Company has no approved, active plan application');
  }

  const plan = await planQueries.getPlanById(approvedApplication.plan_id);
  const existingPassports = await passportQueries.getPassportsByCompanyId(company_id);
  if (plan && existingPassports.length >= plan.total_passports) {
    throw new ApiError(403, `Passport quota reached for plan "${plan.name}" (${plan.total_passports})`);
  }

  const passport = await passportQueries.createPassport({ company_id, passport_number, passport_hash });

  const record = await recordQueries.createRecord({
    company_id,
    passport_id: passport.id,
    passport_number,
    passport_hash,
    issuer_wallet: wallet.wallet_address,
    responsible_wallet: wallet.wallet_address,
    current_version: 1,
    status: 'pending',
    is_active: 1,
  });

  const dataHash = toBytes32(passport_hash);
  const queueEntry = await queueQueries.createTransaction({
    company_id,
    passport_id: passport.id,
    passport_blockchain_record_id: record.id,
    transaction_type: 'create_passport',
    status: 'pending',
    payload: JSON.stringify({
      company_wallet_id: wallet.id,
      passport_number,
      data_hash: dataHash,
    }),
  });

  return success(
    res,
    { passport, blockchain_record: record, queued_job: queueEntry },
    'Passport created and queued for on-chain registration',
    201
  );
});

const updatePassport = asyncHandler(async (req, res) => {
  const existing = await passportQueries.getPassportById(req.params.id);
  if (!existing) throw new ApiError(404, 'Passport not found');

  const { passport_number, passport_hash } = req.body;
  const data = {};
  if (passport_number !== undefined) data.passport_number = passport_number;
  if (passport_hash !== undefined) data.passport_hash = passport_hash;

  const passport = await passportQueries.updatePassport(req.params.id, data);
  return success(res, passport, 'Passport updated successfully');
});

const deletePassport = asyncHandler(async (req, res) => {
  const existing = await passportQueries.getPassportById(req.params.id);
  if (!existing) throw new ApiError(404, 'Passport not found');

  await passportQueries.deletePassport(req.params.id);
  return success(res, null, 'Passport deleted successfully');
});

module.exports = { getPassports, getPassportsByCompany, getPassport, createPassport, updatePassport, deletePassport };

// controllers/passportBlockchainRecord.controller.js
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

// controllers/plan.controller.js
const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const planQueries = require('../queries/plan.queries');

const getPlans = asyncHandler(async (req, res) => {
  const plans = req.query.active === 'true' ? await planQueries.getActivePlans() : await planQueries.getAllPlans();
  return success(res, plans, 'Plans fetched successfully');
});

const getPlan = asyncHandler(async (req, res) => {
  const plan = await planQueries.getPlanById(req.params.id);
  if (!plan) throw new ApiError(404, 'Plan not found');
  return success(res, plan, 'Plan fetched successfully');
});

const createPlan = asyncHandler(async (req, res) => {
  const { name, total_passports, polygon_quantity, status } = req.body;
  const plan = await planQueries.createPlan({
    name,
    total_passports: total_passports ?? 0,
    polygon_quantity: polygon_quantity ?? 0,
    status: status || 'active',
  });
  return success(res, plan, 'Plan created successfully', 201);
});

const updatePlan = asyncHandler(async (req, res) => {
  const existing = await planQueries.getPlanById(req.params.id);
  if (!existing) throw new ApiError(404, 'Plan not found');

  const { name, total_passports, polygon_quantity, status } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (total_passports !== undefined) data.total_passports = total_passports;
  if (polygon_quantity !== undefined) data.polygon_quantity = polygon_quantity;
  if (status !== undefined) data.status = status;

  const plan = await planQueries.updatePlan(req.params.id, data);
  return success(res, plan, 'Plan updated successfully');
});

const deletePlan = asyncHandler(async (req, res) => {
  const existing = await planQueries.getPlanById(req.params.id);
  if (!existing) throw new ApiError(404, 'Plan not found');

  await planQueries.deletePlan(req.params.id);
  return success(res, null, 'Plan deleted successfully');
});

module.exports = { getPlans, getPlan, createPlan, updatePlan, deletePlan };

// controllers/walletFundingLog.controller.js
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


// helper/ApiError.helper.js
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ApiError;

// helper/crypto.helper.js
const crypto = require('crypto');
const ApiError = require('./ApiError.helper');

const ALGORITHM = 'aes-256-gcm';

const getKey = () => {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new ApiError(500, 'WALLET_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
};

// Returns "iv:authTag:ciphertext" (all hex) so encrypted_pk stays a single text column.
const encrypt = (plainText) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
};

const decrypt = (payload) => {
  const [ivHex, authTagHex, dataHex] = String(payload).split(':');
  if (!ivHex || !authTagHex || !dataHex) {
    throw new ApiError(500, 'Malformed encrypted payload');
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
};

module.exports = { encrypt, decrypt };

// helper/hash.helper.js
const { ethers } = require('ethers');

const BYTES32_REGEX = /^0x[0-9a-fA-F]{64}$/;

// Accepts an already-computed 0x-prefixed bytes32 hex hash and returns it as-is,
// otherwise derives a bytes32 keccak256 hash from arbitrary input (string or object).
const toBytes32 = (input) => {
  try{
  if (typeof input === 'string' && BYTES32_REGEX.test(input)) return input;

  const text = typeof input === 'string' ? input : JSON.stringify(input);
  console.log(text)
  return ethers.keccak256(ethers.toUtf8Bytes(text));
  }catch(err){
    console.log(err)
  }
};

module.exports = { toBytes32 };

// helper/queryBuilder.helper.js
const pool = require('../config/db.config');

// Generic, parameterized CRUD helpers shared by every resource's queries file.
// `table` is always a hardcoded string from within the codebase, never user input.

const findAll = async (table, { where = '', params = [], orderBy = 'id DESC', limit, offset } = {}) => {
  let sql = `SELECT * FROM ${table}`;
  if (where) sql += ` WHERE ${where}`;
  sql += ` ORDER BY ${orderBy}`;

  const finalParams = [...params];
  if (limit) {
    sql += ' LIMIT ?';
    finalParams.push(Number(limit));
    if (offset) {
      sql += ' OFFSET ?';
      finalParams.push(Number(offset));
    }
  }

  const [rows] = await pool.query(sql, finalParams);
  return rows;
};

const findOne = async (table, where, params = []) => {
  const [rows] = await pool.query(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, params);
  return rows[0];
};

const findById = async (table, id) => findOne(table, 'id = ?', [id]);

const insert = async (table, data) => {
  const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);
  return findById(table, result.insertId);
};

const update = async (table, id, data) => {
  await pool.query(`UPDATE ${table} SET ? WHERE id = ?`, [data, id]);
  return findById(table, id);
};

const remove = async (table, id) => {
  const [result] = await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
  return result.affectedRows > 0;
};

module.exports = { findAll, findOne, findById, insert, update, remove };

// helper/response.helper.js
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({ success: true, message, data });
};

module.exports = { success };

// helper/wallet.helper.js
const { ethers } = require('ethers');
const { encrypt, decrypt } = require('./crypto.helper');
const ApiError = require('./ApiError.helper');

// Creates a brand-new custodial wallet. It holds 0 gas until funded.
const generateWallet = () => {
  const wallet = ethers.Wallet.createRandom();
  return { address: wallet.address, encryptedPk: encrypt(wallet.privateKey) };
};

// Imports an existing private key (e.g. an already-funded Amoy testnet wallet).
const importWallet = (privateKey) => {
  try {
    const wallet = new ethers.Wallet(privateKey);
    return { address: wallet.address, encryptedPk: encrypt(wallet.privateKey) };
  } catch (err) {
    throw new ApiError(400, `Invalid private key: ${err.message}`);
  }
};

// Decrypts encrypted_pk and returns a ready-to-use ethers Signer connected to `provider`.
const getSigner = (encryptedPk, provider) => new ethers.Wallet(decrypt(encryptedPk), provider);

module.exports = { generateWallet, importWallet, getSigner };

// middleware/asyncHandler.middleware.js
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;

// middleware/errorHandler.middleware.js
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode === 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;

// middleware/validateRequest.middleware.js
const ApiError = require('../helpers/ApiError.helper');

const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found - ${req.originalUrl}`));
};

module.exports = notFound;

// middleware/notFound.middleware.js
const ApiError = require('../helpers/ApiError.helper');

// Usage: validateBody(['name', 'email']) as a route-level middleware.
const validateBody = (requiredFields = []) => (req, res, next) => {
  const missing = requiredFields.filter(
    (field) => req.body[field] === undefined || req.body[field] === null || req.body[field] === ''
  );

  if (missing.length) {
    return next(new ApiError(400, `Missing required field(s): ${missing.join(', ')}`));
  }

  next();
};

module.exports = validateBody;


// queries/admin.queries.js
const { findAll, findOne, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'admins';

module.exports = {
  getAllAdmins: (options) => findAll(TABLE, options),
  getAdminById: (id) => findById(TABLE, id),
  getAdminByEmail: (email) => findOne(TABLE, 'email = ?', [email]),
  createAdmin: (data) => insert(TABLE, data),
  updateAdmin: (id, data) => update(TABLE, id, data),
  deleteAdmin: (id) => remove(TABLE, id),
};

// queries/blockchainTransactionQueue.queries.js
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

// queries/company.queries.js
const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

// Table name matches mysql-queries.sql exactly (including the "registrtion" spelling).
const TABLE = 'company_registrtion';

module.exports = {
  getAllCompanies: (options) => findAll(TABLE, options),
  getCompanyById: (id) => findById(TABLE, id),
  createCompany: (data) => insert(TABLE, data),
  updateCompany: (id, data) => update(TABLE, id, data),
  setApprovalStatus: (id, is_approved) => update(TABLE, id, { is_approved }),
  deleteCompany: (id) => remove(TABLE, id),
};

// queries/companyApplication.queries.js
const pool = require('../config/db.config');
const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'company_application';

const getApplicationsByCompanyId = async (companyId) =>
  findAll(TABLE, { where: 'company_id = ?', params: [companyId] });

const getApplicationWithDetails = async (id) => {
  const [rows] = await pool.query(
    `SELECT ca.*, c.name AS company_name, c.address AS company_address,
            p.name AS plan_name, p.total_passports, p.polygon_quantity
     FROM ${TABLE} ca
     JOIN company_registrtion c ON c.id = ca.company_id
     JOIN plans p ON p.id = ca.plan_id
     WHERE ca.id = ?`,
    [id]
  );
  return rows[0];
};

module.exports = {
  getAllApplications: (options) => findAll(TABLE, options),
  getApplicationById: (id) => findById(TABLE, id),
  getApplicationsByCompanyId,
  getApplicationWithDetails,
  createApplication: (data) => insert(TABLE, data),
  updateApplication: (id, data) => update(TABLE, id, data),
  setApprovalStatus: (id, is_approved) => update(TABLE, id, { is_approved }),
  deleteApplication: (id) => remove(TABLE, id),
};

// queries/companyWallet.queries.js
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

// queries/passport.queries.js
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

// queries/passportBlockchainRecord.queries.js
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

// queries/plan.queries.js
const { findAll, findById, insert, update, remove } = require('../helpers/queryBuilder.helper');

const TABLE = 'plans';

module.exports = {
  getAllPlans: (options) => findAll(TABLE, options),
  getActivePlans: () => findAll(TABLE, { where: "status = 'active'" }),
  getPlanById: (id) => findById(TABLE, id),
  createPlan: (data) => insert(TABLE, data),
  updatePlan: (id, data) => update(TABLE, id, data),
  deletePlan: (id) => remove(TABLE, id),
};

// queries/walletFundingLog.queries.js
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


// routes/admin.routes.js
const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getAdmins);
router.get('/:id', controller.getAdmin);
router.post('/', validateBody(['name', 'email']), controller.createAdmin);
router.put('/:id', controller.updateAdmin);
router.post('/:id/wallet/import', validateBody(['private_key']), controller.importAdminWallet);
router.post('/:id/wallet/generate', controller.generateAdminWallet);
router.delete('/:id', controller.deleteAdmin);

module.exports = router;

// routes/blockchainTransactionQueue.routes.js
const router = require('express').Router();
const controller = require('../controllers/blockchainTransactionQueue.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getTransactions);
router.get('/pending', controller.getPendingTransactions);
router.get('/company/:companyId', controller.getTransactionsByCompany);
router.get('/:id', controller.getTransaction);
router.post('/', validateBody(['company_id', 'transaction_type']), controller.createTransaction);
router.patch('/:id/status', validateBody(['status']), controller.updateTransactionStatus);
router.post('/:id/process', controller.processTransactionNow);
router.delete('/:id', controller.deleteTransaction);

module.exports = router;

// routes/company.routes.js
const router = require('express').Router();
const controller = require('../controllers/company.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getCompanies);
router.get('/:id', controller.getCompany);
router.post('/', validateBody(['name', 'address']), controller.registerCompany);
router.put('/:id', controller.updateCompany);
router.patch('/:id/approve', validateBody(['is_approved']), controller.approveCompany);
router.delete('/:id', controller.deleteCompany);

module.exports = router;

// routes/companyApplication.routes.js
const router = require('express').Router();
const controller = require('../controllers/companyApplication.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getApplications);
router.get('/company/:companyId', controller.getApplicationsByCompany);
router.get('/:id', controller.getApplication);
router.post('/', validateBody(['company_id', 'plan_id']), controller.createApplication);
router.patch('/:id/approve', validateBody(['is_approved']), controller.approveApplication);
router.delete('/:id', controller.deleteApplication);

module.exports = router;

// routes/companyWallet.routes.js
const router = require('express').Router();
const controller = require('../controllers/companyWallet.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getWallets);
router.get('/company/:companyId', controller.getWalletByCompany);
router.get('/:id', controller.getWallet);
router.post('/', validateBody(['private_key']), controller.createWallet);
router.put('/:id', controller.updateWallet);
router.delete('/:id', controller.deleteWallet);

module.exports = router;

// routes/admin.index.js
const router = require('express').Router();

router.use('/admins', require('./admin.routes'));
router.use('/plans', require('./plan.routes'));
router.use('/companies', require('./company.routes'));
router.use('/company-applications', require('./companyApplication.routes'));
router.use('/company-wallets', require('./companyWallet.routes'));
router.use('/wallet-funding-logs', require('./walletFundingLog.routes'));
router.use('/passports', require('./passport.routes'));
router.use('/passport-blockchain-records', require('./passportBlockchainRecord.routes'));
router.use('/blockchain-transactions', require('./blockchainTransactionQueue.routes'));

module.exports = router;

// routes/admin.passport.routes.js
const router = require('express').Router();
const controller = require('../controllers/passport.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getPassports);
router.get('/company/:companyId', controller.getPassportsByCompany);
router.get('/:id', controller.getPassport);
router.post('/', validateBody(['company_id', 'passport_number']), controller.createPassport);
router.put('/:id', controller.updatePassport);
router.delete('/:id', controller.deletePassport);

module.exports = router;

// routes/admin.passportBlockchainRecord.routes.js
const router = require('express').Router();
const controller = require('../controllers/passportBlockchainRecord.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getRecords);
router.get('/passport/:passportId', controller.getRecordsByPassport);
router.get('/company/:companyId', controller.getRecordsByCompany);
router.get('/sync/:passportNumber', controller.syncFromChain);
router.get('/:id', controller.getRecord);
router.post('/', validateBody(['company_id', 'passport_id']), controller.createRecord);
router.patch('/:id/lifecycle', validateBody(['data']), controller.queueLifecycleUpdate);
router.patch('/:id/transfer', validateBody(['new_company_id']), controller.queueTransferResponsibility);
router.put('/:id', controller.updateRecord);
router.delete('/:id', controller.deleteRecord);

module.exports = router;

// routes/admin.plan.routes.js
const router = require('express').Router();
const controller = require('../controllers/plan.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getPlans);
router.get('/:id', controller.getPlan);
router.post('/', validateBody(['name']), controller.createPlan);
router.put('/:id', controller.updatePlan);
router.delete('/:id', controller.deletePlan);

module.exports = router;

// routes/admin.walletFundingLog.routes.js
const router = require('express').Router();
const controller = require('../controllers/walletFundingLog.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getFundingLogs);
router.get('/company/:companyId', controller.getFundingLogsByCompany);
router.get('/:id', controller.getFundingLog);
router.post('/', validateBody(['company_id', 'wallet_address', 'amount']), controller.createFundingLog);
router.delete('/:id', controller.deleteFundingLog);

module.exports = router;

// scripts/syncFromChain.js
// Bulk-reconciles every active passport_blockchain_records row with the current
// on-chain state, read via the configured Infura RPC. Safe to re-run (idempotent) —
// run it manually, or on a cron, to catch up the DB after any missed/failed events.
//
// Usage: node src/scripts/syncFromChain.js

require('dotenv').config();

const pool = require('../config/db.config');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const blockchainService = require('../services/blockchain.service');

const run = async () => {
  await pool.testConnection();

  const records = await recordQueries.getAllRecords({ where: 'is_active = 1' });
  console.log(`Syncing ${records.length} active passport record(s) from chain...`);

  let synced = 0;
  let missing = 0;
  let failed = 0;

  for (const record of records) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const onChain = await blockchainService.getPassportFromChain(record.passport_number);

      if (!onChain.exists) {
        // eslint-disable-next-line no-await-in-loop
        await recordQueries.updateRecord(record.id, { is_active: 0 });
        missing += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await recordQueries.updateRecord(record.id, {
        latest_public_data_hash: onChain.latestDataHash,
        current_version: onChain.currentVersion,
        responsible_wallet: onChain.responsibleEntity,
        status: 'completed',
        is_active: 1,
      });
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${record.passport_number}: ${err.message}`);
    }
  }

  console.log(`Done. Synced: ${synced}, missing on-chain: ${missing}, failed: ${failed}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Sync script failed:', err);
  process.exit(1);
});


// services/blockchain.service.js
const { ethers } = require('ethers');
const { getProvider, getContract } = require('../config/web3.config');
const { getSigner } = require('../helpers/wallet.helper');

const signerFor = (encryptedPk) => getSigner(encryptedPk, getProvider());

// Native POL/MATIC transfer from the admin's custodial wallet to a company's custodial wallet.
const fundCompanyWallet = async (adminEncryptedPk, toAddress, amountInEther) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const tx = await adminSigner.sendTransaction({
    to: toAddress,
    value: ethers.parseEther(String(amountInEther)),
  });
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

// Owner-only call: whitelists a company's wallet address on the contract.
const authorizeCompanyOnChain = async (adminEncryptedPk, companyWalletAddress) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const contract = getContract(adminSigner);
  const tx = await contract.addAuthorizedCompany(companyWalletAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const removeAuthorizedCompanyOnChain = async (adminEncryptedPk, companyWalletAddress) => {
  const adminSigner = signerFor(adminEncryptedPk);
  const contract = getContract(adminSigner);
  const tx = await contract.removeAuthorizedCompany(companyWalletAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const createPassportOnChain = async (companyEncryptedPk, passportNumber, dataHashHex) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.createPassport(passportNumber, dataHashHex);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber, contractAddress: await contract.getAddress() };
};

const updatePassportOnChain = async (companyEncryptedPk, passportNumber, newDataHashHex, newVersion) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.updatePassport(passportNumber, newDataHashHex, newVersion);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

const transferResponsibilityOnChain = async (companyEncryptedPk, passportNumber, newResponsibleAddress) => {
  const companySigner = signerFor(companyEncryptedPk);
  const contract = getContract(companySigner);
  const tx = await contract.transferResponsibility(passportNumber, newResponsibleAddress);
  const receipt = await tx.wait();
  return { hash: tx.hash, blockNumber: receipt.blockNumber };
};

// Read-only: fetches the current on-chain state of a passport via the configured RPC (Infura).
const getPassportFromChain = async (passportNumber) => {
  const contract = getContract();
  const result = await contract.getPassport(passportNumber);

  return {
    passportNumber: result.passportNumber,
    latestDataHash: result.latestDataHash,
    currentVersion: Number(result.currentVersion),
    createdAt: Number(result.createdAt),
    updatedAt: Number(result.updatedAt),
    issuer: result.issuer,
    responsibleEntity: result.responsibleEntity,
    exists: result.exists,
  };
};

const isCompanyAuthorizedOnChain = async (address) => {
  const contract = getContract();
  return contract.authorizedCompanies(address);
};

const getBalanceByCompanyAddress = async (address) => {
  const provider = getProvider();
  return await provider.getBalance(address);
};

module.exports = {
  fundCompanyWallet,
  authorizeCompanyOnChain,
  removeAuthorizedCompanyOnChain,
  createPassportOnChain,
  updatePassportOnChain,
  transferResponsibilityOnChain,
  getPassportFromChain,
  isCompanyAuthorizedOnChain,
  getBalanceByCompanyAddress,
};


// worker/blockchainWorker.js
const adminQueries = require('../queries/admin.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const walletFundingLogQueries = require('../queries/walletFundingLog.queries');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const blockchainService = require('../services/blockchain.service');

const MAX_RETRIES = Number(process.env.BLOCKCHAIN_WORKER_MAX_RETRIES) || 3;
const POLL_INTERVAL_MS = Number(process.env.BLOCKCHAIN_WORKER_INTERVAL_MS) || 10000;

// Owner-only on-chain call: whitelists the company's wallet via addAuthorizedCompany.
// Queued first (before fund_wallet) when an admin approves a company_application.
const handleAddCompany = async (row) => {
  const { admin_id, company_wallet_address } = row.payload;

  const admin = await adminQueries.getAdminById(admin_id);
  if (!admin || !admin.encrypted_pk) throw new Error(`Admin ${admin_id} has no custodial wallet`);

  const result = await blockchainService.authorizeCompanyOnChain(admin.encrypted_pk, company_wallet_address);
  return result.hash;
};

const handleFundWallet = async (row) => {
  const { admin_id, company_wallet_id, company_wallet_address, amount } = row.payload;

  const admin = await adminQueries.getAdminById(admin_id);
  if (!admin || !admin.encrypted_pk) throw new Error(`Admin ${admin_id} has no custodial wallet`);

  const fundResult = await blockchainService.fundCompanyWallet(admin.encrypted_pk, company_wallet_address, amount);

  await companyWalletQueries.adjustBalance(company_wallet_id, amount);
  await walletFundingLogQueries.createFundingLog({
    company_id: row.company_id,
    wallet_address: company_wallet_address,
    amount,
    transaction_hash: fundResult.hash,
    funded_by: admin_id,
    remarks: 'Auto-funded on application approval',
  });

  return fundResult.hash;
};

const handleCreatePassport = async (row) => {
  const { company_wallet_id, passport_number, data_hash } = row.payload;

  const wallet = await companyWalletQueries.getWalletById(company_wallet_id);
  if (!wallet) throw new Error(`Company wallet ${company_wallet_id} not found`);

  const result = await blockchainService.createPassportOnChain(wallet.encrypted_pk, passport_number, data_hash);

  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    latest_public_data_hash: data_hash,
    current_version: 1,
    created_tx_hash: result.hash,
    created_block_number: result.blockNumber,
    contract_address: result.contractAddress,
    status: 'completed',
  });

  return result.hash;
};

const handleUpdatePassport = async (row) => {
  const { company_wallet_id, passport_number, new_data_hash, new_version } = row.payload;

  const wallet = await companyWalletQueries.getWalletById(company_wallet_id);
  if (!wallet) throw new Error(`Company wallet ${company_wallet_id} not found`);

  const result = await blockchainService.updatePassportOnChain(
    wallet.encrypted_pk,
    passport_number,
    new_data_hash,
    new_version
  );

  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    latest_public_data_hash: new_data_hash,
    current_version: new_version,
    status: 'completed',
  });

  return result.hash;
};

const handleTransferResponsibility = async (row) => {
  const { company_wallet_id, passport_number, new_company_id, new_responsible_wallet } = row.payload;

  const wallet = await companyWalletQueries.getWalletById(company_wallet_id);
  if (!wallet) throw new Error(`Company wallet ${company_wallet_id} not found`);

  const result = await blockchainService.transferResponsibilityOnChain(
    wallet.encrypted_pk,
    passport_number,
    new_responsible_wallet
  );

  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    responsible_wallet: new_responsible_wallet,
    company_id: new_company_id,
    status: 'completed',
  });

  return result.hash;
};

const HANDLERS = {
  add_company: handleAddCompany,
  fund_wallet: handleFundWallet,
  create_passport: handleCreatePassport,
  update_passport: handleUpdatePassport,
  transfer_responsibility: handleTransferResponsibility,
};

const markRelatedRecordFailed = async (row, message) => {
  if (!row.passport_blockchain_record_id) return;
  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    status: 'failed',
  }).catch(() => {});
};

const processQueueItem = async (row) => {
  const handler = HANDLERS[row.transaction_type];
  if (!handler) {
    await queueQueries.updateTransaction(row.id, {
      status: 'failed',
      error_message: `No handler for transaction_type "${row.transaction_type}"`,
    });
    return;
  }

  await queueQueries.updateTransaction(row.id, { status: 'processing' });

  try {
    const txHash = await handler(row);
    await queueQueries.updateTransaction(row.id, {
      status: 'completed',
      transaction_hash: txHash,
      error_message: null,
    });
    console.log(`[blockchain-worker] job ${row.id} (${row.transaction_type}) completed: ${txHash}`);
  } catch (err) {
    const remaining = Math.max((row.retry_count ?? MAX_RETRIES) - 1, 0);
    const nextStatus = remaining > 0 ? 'pending' : 'failed';

    await queueQueries.updateTransaction(row.id, {
      status: nextStatus,
      retry_count: remaining,
      error_message: err.message?.slice(0, 1000) || 'Unknown error',
    });

    if (nextStatus === 'failed') {
      await markRelatedRecordFailed(row, err.message);
    }

    console.error(`[blockchain-worker] job ${row.id} (${row.transaction_type}) failed: ${err.message}`);
  }
};

const pollOnce = async () => {
  const pending = await queueQueries.getPendingTransactions();
  for (const row of pending) {
    // eslint-disable-next-line no-await-in-loop
    await processQueueItem(row);
  }
  return pending.length;
};

const startWorker = () => {
  console.log(`[blockchain-worker] started, polling every ${POLL_INTERVAL_MS}ms`);

  const tick = async () => {
    try {
      await pollOnce();
    } catch (err) {
      console.error('[blockchain-worker] poll cycle error:', err.message);
    }
  };

  tick();
  return setInterval(tick, POLL_INTERVAL_MS);
};

module.exports = { startWorker, pollOnce, processQueueItem };


// app.js
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const routes = require('./routes');
const notFound = require('./middleware/notFound.middleware');
const errorHandler = require('./middleware/errorHandler.middleware');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ success: true, message: 'API is healthy' }));

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;


// server.js
require('dotenv').config();

const app = require('./src/app');
const pool = require('./src/config/db.config');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await pool.testConnection();
  app.listen(PORT, () => {
    console.log(`Volt Forge backend running on http://localhost:${PORT}`);
  });
};

start();


// worker.js
require('dotenv').config();

const pool = require('./src/config/db.config');
const { startWorker } = require('./src/workers/blockchainWorker');

const start = async () => {
  await pool.testConnection();
  startWorker();
};

start();


// env
PORT=5088
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=aayatana

# --- Blockchain / Web3 (Polygon Amoy testnet) ---
INFURA_API_KEY=4c2d863cb8034100a53faff70a8ad3ec
POLYGON_AMOY_RPC_URL=https://polygon-amoy.infura.io/v3/4c2d863cb8034100a53faff70a8ad3ec
CHAIN_ID=80002

CONTRACT_ADDRESS=0x60F3EF5CC75687440f9E670FE40f8e1854002ae5
CONTRACT_ABI_PATH=./src/contracts/VoltForgeOS.abi.json

# Generated locally for dev use — replace for production.
WALLET_ENCRYPTION_KEY=a1441532ecf17feb1095154128ae7e35ddd0163a3752507c1dfca258c719dd17

BLOCKCHAIN_WORKER_INTERVAL_MS=10000
BLOCKCHAIN_WORKER_MAX_RETRIES=3



# --- Blockchain / Web3 (Polygon Amoy testnet) ---
INFURA_API_KEY=4c2d863cb8034100a53faff70a8ad3ec
POLYGON_AMOY_RPC_URL=https://sepolia.infura.io/v3/4c2d863cb8034100a53faff70a8ad3ec
CHAIN_ID=11155111

CONTRACT_ADDRESS=0xC2a39014335E2c65B1744D650e03038875ee60DB
CONTRACT_ABI_PATH=./src/contracts/VoltForgeOS.abi.json

# Generated locally for dev use — replace for production.
WALLET_ENCRYPTION_KEY=a1441532ecf17feb1095154128ae7e35ddd0163a3752507c1dfca258c719dd17

BLOCKCHAIN_WORKER_INTERVAL_MS=10000
BLOCKCHAIN_WORKER_MAX_RETRIES=3



0xC2a39014335E2c65B1744D650e03038875ee60DB

