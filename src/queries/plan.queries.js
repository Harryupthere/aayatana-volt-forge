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
