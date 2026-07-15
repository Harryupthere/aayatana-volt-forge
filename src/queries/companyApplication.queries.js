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
