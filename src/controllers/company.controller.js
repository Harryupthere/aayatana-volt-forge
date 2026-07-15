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
