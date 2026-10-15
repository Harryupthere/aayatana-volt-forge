
const pool = require('../config/db.config');
const adminQueries = require('../queries/admin.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const walletFundingLogQueries = require('../queries/walletFundingLog.queries');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const blockchainService = require('../services/blockchain.service');

const MAX_RETRIES = Number(process.env.BLOCKCHAIN_WORKER_MAX_RETRIES) || 3;
const POLL_INTERVAL_MS = Number(process.env.BLOCKCHAIN_WORKER_INTERVAL_MS) || 10000;

const parsePayload = (payload) => {
  if (!payload) return {};
  if (typeof payload === 'string') {
    try { return JSON.parse(payload); } catch { throw new Error('Queue payload is not valid JSON'); }
  }
  return payload;
};

const getBatchById = async (id) => {
  const [rows] = await pool.query('SELECT * FROM passport_batches WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
};

const updateBatch = async (id, data) => {
  await pool.query('UPDATE passport_batches SET ? WHERE id = ?', [data, id]);
};

const updateBatchRecords = async (batchId, data) => {
  await pool.query(
    `UPDATE passport_blockchain_records pbr
     INNER JOIN passport_batch_items pbi
       ON pbi.passport_blockchain_record_id = pbr.id
     SET ?
     WHERE pbi.passport_batch_id = ?`,
    [data, batchId]
  );
};

// Owner-only on-chain call: whitelists the company's wallet via addAuthorizedCompany.
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
    wallet.encrypted_pk, passport_number, new_data_hash, new_version
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
    wallet.encrypted_pk, passport_number, new_responsible_wallet
  );
  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    responsible_wallet: new_responsible_wallet,
    company_id: new_company_id,
    status: 'completed',
  });
  return result.hash;
};

// V2 batch registration. Rechecks chain state first so a retry after a successful
// transaction/database failure will not submit the same batch ID twice.
const handleCreatePassportBatch = async (row) => {
  const { passport_batch_id } = row.payload;
  if (!passport_batch_id) throw new Error('Queue payload is missing passport_batch_id');

  const batch = await getBatchById(passport_batch_id);
  if (!batch) throw new Error(`Passport batch ${passport_batch_id} not found`);

  const wallet = await companyWalletQueries.getWalletByCompanyId(batch.company_id);
  if (!wallet) throw new Error(`Company wallet for company ${batch.company_id} not found`);

  await updateBatch(batch.id, { status: 'processing', error_message: null });
  await updateBatchRecords(batch.id, { status: 'processing' });

  let result;
  const existingOnChain = await blockchainService.getMerkleBatchFromChain(batch.batch_id);

  if (existingOnChain.exists) {
    const sameRoot = existingOnChain.merkleRoot.toLowerCase() === batch.merkle_root.toLowerCase();
    const sameCount = Number(existingOnChain.passportCount) === Number(batch.passport_count);
    const sameIssuer = existingOnChain.issuer.toLowerCase() === wallet.wallet_address.toLowerCase();

    if (!sameRoot || !sameCount || !sameIssuer) {
      throw new Error(`Batch ID ${batch.batch_id} already exists on-chain with different metadata`);
    }

    result = {
      hash: batch.created_tx_hash || null,
      blockNumber: batch.created_block_number || null,
      contractAddress: existingOnChain.contractAddress,
      active: existingOnChain.active,
    };
  } else {
    result = await blockchainService.createPassportBatchOnChain(
      wallet.encrypted_pk,
      batch.batch_id,
      batch.merkle_root,
      batch.passport_count
    );
    result.active = true;
  }

  const batchUpdate = {
    status: 'completed',
    is_active: result.active === false ? 0 : 1,
    error_message: null,
    contract_address: result.contractAddress,
  };
  if (result.hash) batchUpdate.created_tx_hash = result.hash;
  if (result.blockNumber !== null && result.blockNumber !== undefined) {
    batchUpdate.created_block_number = result.blockNumber;
  }
  await updateBatch(batch.id, batchUpdate);

  const recordUpdate = {
    status: 'completed',
    contract_address: result.contractAddress,
  };
  if (result.hash) recordUpdate.created_tx_hash = result.hash;
  if (result.blockNumber !== null && result.blockNumber !== undefined) {
    recordUpdate.created_block_number = result.blockNumber;
  }
  await updateBatchRecords(batch.id, recordUpdate);

  return result.hash;
};

// Deactivation handler is ready for the deactivation queue/API phase.
// Payload requires passport_batch_id; batch issuer wallet is resolved from DB.
const handleDeactivatePassportBatch = async (row) => {
  const { passport_batch_id } = row.payload;
  if (!passport_batch_id) throw new Error('Queue payload is missing passport_batch_id');

  const batch = await getBatchById(passport_batch_id);
  if (!batch) throw new Error(`Passport batch ${passport_batch_id} not found`);

  const wallet = await companyWalletQueries.getWalletByCompanyId(batch.company_id);
  if (!wallet) throw new Error(`Company wallet for company ${batch.company_id} not found`);

  const onChain = await blockchainService.getMerkleBatchFromChain(batch.batch_id);
  if (!onChain.exists) throw new Error(`Batch ${batch.batch_id} does not exist on-chain`);

  let result = {
    hash: batch.created_tx_hash || null,
    blockNumber: null,
    contractAddress: onChain.contractAddress,
  };

  if (onChain.active) {
    result = await blockchainService.deactivatePassportBatchOnChain(wallet.encrypted_pk, batch.batch_id);
  }

  await updateBatch(batch.id, {
    is_active: 0,
    status: 'completed',
    error_message: null,
    contract_address: result.contractAddress,
  });

  // These rows represent membership in the deactivated Merkle batch.
  await updateBatchRecords(batch.id, { is_active: 0, status: 'completed' });
  return result.hash;
};

const HANDLERS = {
  add_company: handleAddCompany,
  fund_wallet: handleFundWallet,
  create_passport: handleCreatePassport,
  update_passport: handleUpdatePassport,
  transfer_responsibility: handleTransferResponsibility,
  create_passport_batch: handleCreatePassportBatch,
  deactivate_passport_batch: handleDeactivatePassportBatch,
};

const markRelatedRecordFailed = async (row) => {
  if (!row.passport_blockchain_record_id) return;
  await recordQueries.updateRecord(row.passport_blockchain_record_id, { status: 'failed' }).catch(() => {});
};

const markRelatedBatchStatus = async (row, status, errorMessage = null) => {
  if (!['create_passport_batch', 'deactivate_passport_batch'].includes(row.transaction_type)) return;
  const payload = parsePayload(row.payload);
  if (!payload.passport_batch_id) return;

  await updateBatch(payload.passport_batch_id, {
    status,
    error_message: errorMessage ? String(errorMessage).slice(0, 1000) : null,
  }).catch(() => {});
  await updateBatchRecords(payload.passport_batch_id, { status }).catch(() => {});
};

const processQueueItem = async (originalRow) => {
  const row = { ...originalRow, payload: parsePayload(originalRow.payload) };
  const handler = HANDLERS[row.transaction_type];

  if (!handler) {
    await queueQueries.updateTransaction(row.id, {
      status: 'failed',
      error_message: `No handler for transaction_type "${row.transaction_type}"`,
    });
    await markRelatedBatchStatus(row, 'failed', `No handler for transaction_type "${row.transaction_type}"`);
    return;
  }

  await queueQueries.updateTransaction(row.id, { status: 'processing' });

  try {
    const txHash = await handler(row);
    await queueQueries.updateTransaction(row.id, {
      status: 'completed',
      transaction_hash: txHash || null,
      error_message: null,
    });
    console.log(`[blockchain-worker] job ${row.id} (${row.transaction_type}) completed${txHash ? `: ${txHash}` : ''}`);
  } catch (err) {
    const remaining = Math.max((row.retry_count ?? MAX_RETRIES) - 1, 0);
    const nextStatus = remaining > 0 ? 'pending' : 'failed';

    await queueQueries.updateTransaction(row.id, {
      status: nextStatus,
      retry_count: remaining,
      error_message: err.message?.slice(0, 1000) || 'Unknown error',
    });

    if (nextStatus === 'failed') {
      await markRelatedRecordFailed(row);
      await markRelatedBatchStatus(row, 'failed', err.message);
    } else {
      await markRelatedBatchStatus(row, 'pending', err.message);
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
