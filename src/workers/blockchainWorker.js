const adminQueries = require('../queries/admin.queries');
const companyWalletQueries = require('../queries/companyWallet.queries');
const walletFundingLogQueries = require('../queries/walletFundingLog.queries');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const queueQueries = require('../queries/blockchainTransactionQueue.queries');
const blockchainService = require('../services/blockchain.service');

const MAX_RETRIES = Number(process.env.BLOCKCHAIN_WORKER_MAX_RETRIES) || 3;
const POLL_INTERVAL_MS = Number(process.env.BLOCKCHAIN_WORKER_INTERVAL_MS) || 10000;

const handleFundWallet = async (row) => {
  const { admin_id, company_wallet_id, company_wallet_address, amount } = row.payload;

  const admin = await adminQueries.getAdminById(admin_id);
  if (!admin || !admin.encrypted_pk) throw new Error(`Admin ${admin_id} has no custodial wallet`);

  const fundResult = await blockchainService.fundCompanyWallet(admin.encrypted_pk, company_wallet_address, amount);
  const authResult = await blockchainService.authorizeCompanyOnChain(admin.encrypted_pk, company_wallet_address);

  await companyWalletQueries.adjustBalance(company_wallet_id, amount);
  await walletFundingLogQueries.createFundingLog({
    company_id: row.company_id,
    wallet_address: company_wallet_address,
    amount,
    transaction_hash: fundResult.hash,
    funded_by: admin_id,
    remarks: `Auto-funded on application approval. Company authorized on-chain (tx: ${authResult.hash})`,
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
    wallet.encrypted_pk,
    passport_number,
    new_data_hash,
    new_version
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
    wallet.encrypted_pk,
    passport_number,
    new_responsible_wallet
  );

  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    responsible_wallet: new_responsible_wallet,
    company_id: new_company_id,
    status: 'completed',
  });

  return result.hash;
};

const HANDLERS = {
  fund_wallet: handleFundWallet,
  create_passport: handleCreatePassport,
  update_passport: handleUpdatePassport,
  transfer_responsibility: handleTransferResponsibility,
};

const markRelatedRecordFailed = async (row, message) => {
  if (!row.passport_blockchain_record_id) return;
  await recordQueries.updateRecord(row.passport_blockchain_record_id, {
    status: 'failed',
  }).catch(() => {});
};

const processQueueItem = async (row) => {
  const handler = HANDLERS[row.transaction_type];
  if (!handler) {
    await queueQueries.updateTransaction(row.id, {
      status: 'failed',
      error_message: `No handler for transaction_type "${row.transaction_type}"`,
    });
    return;
  }

  await queueQueries.updateTransaction(row.id, { status: 'processing' });

  try {
    const txHash = await handler(row);
    await queueQueries.updateTransaction(row.id, {
      status: 'completed',
      transaction_hash: txHash,
      error_message: null,
    });
    console.log(`[blockchain-worker] job ${row.id} (${row.transaction_type}) completed: ${txHash}`);
  } catch (err) {
    const remaining = Math.max((row.retry_count ?? MAX_RETRIES) - 1, 0);
    const nextStatus = remaining > 0 ? 'pending' : 'failed';

    await queueQueries.updateTransaction(row.id, {
      status: nextStatus,
      retry_count: remaining,
      error_message: err.message?.slice(0, 1000) || 'Unknown error',
    });

    if (nextStatus === 'failed') {
      await markRelatedRecordFailed(row, err.message);
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
