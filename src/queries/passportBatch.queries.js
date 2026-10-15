
const pool = require('../config/db.config');

const getBatchByBatchId = async (batchId) => {
  const [rows] = await pool.query(
    'SELECT * FROM passport_batches WHERE batch_id = ? LIMIT 1',
    [batchId]
  );

  return rows[0] || null;
};

const getBatchesByCompanyId = async (companyId) => {
  const [rows] = await pool.query(
    `SELECT *
     FROM passport_batches
     WHERE company_id = ?
     ORDER BY id DESC`,
    [companyId]
  );

  return rows;
};

const getBatchItemsByBatchId = async (batchId) => {
  const [rows] = await pool.query(
    `SELECT
       bi.id AS batch_item_id,
       bi.passport_batch_id,
       bi.passport_id,
       bi.passport_blockchain_record_id,
       bi.passport_hash,
       bi.merkle_proof,
       bi.created_at AS batch_item_created_at,
       p.passport_number,
       p.company_id,
       pbr.status AS blockchain_status,
       pbr.registration_mode,
       pbr.created_tx_hash,
       pbr.created_block_number
     FROM passport_batch_items bi
     INNER JOIN passport_batches pb
       ON pb.id = bi.passport_batch_id
     INNER JOIN passports p
       ON p.id = bi.passport_id
     LEFT JOIN passport_blockchain_records pbr
       ON pbr.id = bi.passport_blockchain_record_id
     WHERE pb.batch_id = ?
     ORDER BY bi.id ASC`,
    [batchId]
  );

  return rows.map((row) => ({
    ...row,
    merkle_proof:
      typeof row.merkle_proof === 'string'
        ? JSON.parse(row.merkle_proof)
        : row.merkle_proof,
  }));
};

module.exports = {
  getBatchByBatchId,
  getBatchesByCompanyId,
  getBatchItemsByBatchId,
};
