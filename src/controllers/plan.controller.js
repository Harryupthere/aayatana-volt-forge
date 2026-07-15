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
