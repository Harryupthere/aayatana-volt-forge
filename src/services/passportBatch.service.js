



const pool = require('../config/db.config');
const ApiError = require('../helpers/ApiError.helper');
const { buildMerkleBatch } = require('../helpers/merkleBatch.helper');

const MAX_BATCH_SIZE = 500;

const createPassportBatch = async ({ company_id, passports }) => {
  const companyId = Number(company_id);

  if (!Number.isSafeInteger(companyId) || companyId <= 0) {
    throw new ApiError(400, 'company_id must be a valid positive integer');
  }

  if (!Array.isArray(passports) || passports.length === 0) {
    throw new ApiError(400, 'passports must be a non-empty array');
  }

  if (passports.length > MAX_BATCH_SIZE) {
    throw new ApiError(
      400,
      `A batch cannot contain more than ${MAX_BATCH_SIZE} passports`
    );
  }

  // This API accepts the same object format planned for bulk registration:
  // { passports: [{ passport_number: "BATT-0001" }, ...] }
  const passportNumbers = passports.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new ApiError(
        400,
        `passports[${index}] must be an object containing passport_number`
      );
    }

    const number = item.passport_number;

    if (typeof number !== 'string' || number.trim().length === 0) {
      throw new ApiError(
        400,
        `passports[${index}].passport_number must be a non-empty string`
      );
    }

    if (number.length > 255) {
      throw new ApiError(
        400,
        `passports[${index}].passport_number cannot exceed 255 characters`
      );
    }

    // Preserve the exact original value for hashing. Do not silently trim
    // or change the case because that would change the on-chain hash.
    return number;
  });

  // Match the database's usual case-insensitive passport-number comparison
  // for common ASCII passport identifiers.
  const seenNumbers = new Set();

  for (const number of passportNumbers) {
    const comparisonKey = number.toLowerCase();

    if (seenNumbers.has(comparisonKey)) {
      throw new ApiError(
        409,
        `Duplicate passport number in request: ${number}`
      );
    }

    seenNumbers.add(comparisonKey);
  }

  // Compute root/proofs before opening the transaction so CPU work does not
  // keep a database connection locked longer than necessary.
  const merkleBatch = buildMerkleBatch(passportNumbers);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Lock the company row while checking quota. This serializes batch
    // registrations for the same company.
    const [companyRows] = await connection.query(
      `SELECT *
       FROM company_registrtion
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [companyId]
    );

    const company = companyRows[0];

    if (!company) {
      throw new ApiError(404, 'Company not found');
    }

    if (company.is_approved !== 'yes') {
      throw new ApiError(403, 'Company is not approved to issue passports');
    }

    const [walletRows] = await connection.query(
      `SELECT *
       FROM company_wallets
       WHERE company_id = ?
       ORDER BY id DESC
       LIMIT 1`,
      [companyId]
    );

    const wallet = walletRows[0];

    if (!wallet) {
      throw new ApiError(
        400,
        'Company has no custodial wallet yet. It is created when an application is approved.'
      );
    }

    const [applicationRows] = await connection.query(
      `SELECT *
       FROM company_application
       WHERE company_id = ?
         AND is_approved = 'yes'
         AND status = 'active'
       ORDER BY id DESC`,
      [companyId]
    );

    const approvedApplication = applicationRows[0];

    if (!approvedApplication) {
      throw new ApiError(
        403,
        'Company has no approved, active plan application'
      );
    }

    const [planRows] = await connection.query(
      'SELECT * FROM plans WHERE id = ? LIMIT 1',
      [approvedApplication.plan_id]
    );

    const plan = planRows[0];

    if (!plan) {
      throw new ApiError(403, 'The approved company plan could not be found');
    }

    const [countRows] = await connection.query(
      `SELECT COUNT(*) AS total
       FROM passports
       WHERE company_id = ?`,
      [companyId]
    );

    const existingPassportCount = Number(countRows[0].total);
    const quota = Number(plan.total_passports);

    if (
      Number.isFinite(quota) &&
      existingPassportCount + passportNumbers.length > quota
    ) {
      const remaining = Math.max(quota - existingPassportCount, 0);

      throw new ApiError(
        403,
        `Passport quota exceeded for plan "${plan.name}". ` +
          `${remaining} passport(s) remaining; ${passportNumbers.length} requested.`
      );
    }

    // Passport numbers are globally checked, matching the individual
    // endpoint's getPassportByNumber() behavior.
    const placeholders = passportNumbers.map(() => '?').join(', ');

    const [duplicateRows] = await connection.query(
      `SELECT passport_number
       FROM passports
       WHERE passport_number IN (${placeholders})`,
      passportNumbers
    );

    if (duplicateRows.length > 0) {
      const duplicates = duplicateRows.map((row) => row.passport_number);

      throw new ApiError(
        409,
        `These passport number(s) already exist: ${duplicates.join(', ')}`
      );
    }

    // 1. Create the off-chain batch metadata.
    const [batchInsert] = await connection.query(
      `INSERT INTO passport_batches SET ?`,
      [{
        batch_id: merkleBatch.batchId,
        company_id: companyId,
        merkle_root: merkleBatch.merkleRoot,
        passport_count: merkleBatch.passportCount,
        issuer_wallet: wallet.wallet_address,
        status: 'pending',
        is_active: 1,
      }]
    );

    const databaseBatchId = batchInsert.insertId;
    const createdItems = [];

    // 2. Create the passport, blockchain record, and Merkle proof membership
    // for each passport, all within the same transaction.
    for (const item of merkleBatch.passports) {
      const [passportInsert] = await connection.query(
        `INSERT INTO passports SET ?`,
        [{
          company_id: companyId,
          passport_number: item.passportNumber,
          passport_hash: item.passportHash,
        }]
      );

      const passportId = passportInsert.insertId;

      const [recordInsert] = await connection.query(
        `INSERT INTO passport_blockchain_records SET ?`,
        [{
          company_id: companyId,
          passport_id: passportId,
          passport_number: item.passportNumber,
          passport_hash: item.passportHash,
          registration_mode: 'batch',
          latest_public_data_hash: null,
          current_version: 1,
          issuer_wallet: wallet.wallet_address,
          responsible_wallet: wallet.wallet_address,
          created_tx_hash: null,
          created_block_number: null,
          contract_address: null,
          status: 'pending',
          is_active: 1,
        }]
      );

      const blockchainRecordId = recordInsert.insertId;

      const [itemInsert] = await connection.query(
        `INSERT INTO passport_batch_items SET ?`,
        [{
          passport_batch_id: databaseBatchId,
          passport_id: passportId,
          passport_blockchain_record_id: blockchainRecordId,
          passport_hash: item.passportHash,
          merkle_proof: JSON.stringify(item.proof),
        }]
      );

      createdItems.push({
        batch_item_id: itemInsert.insertId,
        passport_id: passportId,
        passport_blockchain_record_id: blockchainRecordId,
        passport_number: item.passportNumber,
        passport_hash: item.passportHash,
        merkle_proof: item.proof,
      });
    }

    // 3. Queue the on-chain root registration in the SAME SQL transaction.
    // This prevents a batch from being committed without a worker job.
    const queuePayload = {
      passport_batch_id: databaseBatchId,
    };

    const [queueInsert] = await connection.query(
      `INSERT INTO blockchain_transaction_queue SET ?`,
      [{
        company_id: companyId,
        passport_id: null,
        passport_blockchain_record_id: null,
        transaction_type: 'create_passport_batch',
        status: 'pending',
        retry_count: 3,
        payload: JSON.stringify(queuePayload),
      }]
    );

    const [queueRows] = await connection.query(
      `SELECT * FROM blockchain_transaction_queue WHERE id = ? LIMIT 1`,
      [queueInsert.insertId]
    );

    await connection.commit();

    return {
      batch: {
        id: databaseBatchId,
        batch_id: merkleBatch.batchId,
        company_id: companyId,
        merkle_root: merkleBatch.merkleRoot,
        passport_count: merkleBatch.passportCount,
        issuer_wallet: wallet.wallet_address,
        status: 'pending',
        is_active: 1,
      },
      passports: createdItems,
      blockchain_queue: queueRows[0] || { id: queueInsert.insertId, status: 'pending' },
      message:
        'Batch and Merkle proofs saved and queued for on-chain Merkle root registration.',
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  createPassportBatch,
};
