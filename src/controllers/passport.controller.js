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
  const { company_id, passport_number, passport_hash } = req.body;

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
