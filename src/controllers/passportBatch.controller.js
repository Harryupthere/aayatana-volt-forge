
const asyncHandler = require('../middleware/asyncHandler.middleware');
const { success } = require('../helpers/response.helper');
const ApiError = require('../helpers/ApiError.helper');
const passportBatchQueries = require('../queries/passportBatch.queries');
const passportBatchService = require('../services/passportBatch.service');

const createBatch = asyncHandler(async (req, res) => {
  const { company_id, passports } = req.body;

  const result = await passportBatchService.createPassportBatch({
    company_id,
    passports,
  });

  return success(
    res,
    result,
    'Passport batch created successfully. Blockchain submission is pending Phase 4.',
    201
  );
});

const getBatch = asyncHandler(async (req, res) => {
  const batch = await passportBatchQueries.getBatchByBatchId(
    req.params.batchId
  );

  if (!batch) {
    throw new ApiError(404, 'Passport batch not found');
  }

  return success(res, batch, 'Passport batch fetched successfully');
});

const getBatchesByCompany = asyncHandler(async (req, res) => {
  const companyId = Number(req.params.companyId);

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new ApiError(400, 'companyId must be a valid positive integer');
  }

  const batches = await passportBatchQueries.getBatchesByCompanyId(companyId);

  return success(res, batches, 'Company passport batches fetched successfully');
});

const getBatchPassports = asyncHandler(async (req, res) => {
  const batch = await passportBatchQueries.getBatchByBatchId(
    req.params.batchId
  );

  if (!batch) {
    throw new ApiError(404, 'Passport batch not found');
  }

  const passports = await passportBatchQueries.getBatchItemsByBatchId(
    req.params.batchId
  );

  return success(
    res,
    {
      batch,
      passports,
    },
    'Passport batch items fetched successfully'
  );
});

module.exports = {
  createBatch,
  getBatch,
  getBatchesByCompany,
  getBatchPassports,
};
