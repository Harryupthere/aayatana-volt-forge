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
// it ensures the company has a custodial wallet, then queues a 'fund_wallet' job that
// the blockchain worker picks up to (1) transfer the plan's polygon_quantity from the
// admin's wallet to the company's wallet and (2) call addAuthorizedCompany on-chain.
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

  const queueEntry = await queueQueries.createTransaction({
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
    { application, wallet, queued_job: queueEntry },
    'Application approved. Wallet funding and on-chain authorization have been queued.'
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
