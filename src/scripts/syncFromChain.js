
require('dotenv').config();

const pool = require('../config/db.config');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const blockchainService = require('../services/blockchain.service');

const run = async () => {
  await pool.testConnection();

  const allRecords = await recordQueries.getAllRecords({ where: 'is_active = 1' });
  const individualRecords = allRecords.filter((record) => record.registration_mode !== 'batch');
  console.log(`Syncing ${individualRecords.length} active individual passport record(s) from chain...`);

  let synced = 0;
  let missing = 0;
  let failed = 0;

  for (const record of individualRecords) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const onChain = await blockchainService.getPassportFromChain(record.passport_number);

      if (!onChain.exists) {
        // eslint-disable-next-line no-await-in-loop
        await recordQueries.updateRecord(record.id, { is_active: 0 });
        missing += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      await recordQueries.updateRecord(record.id, {
        latest_public_data_hash: onChain.latestDataHash,
        current_version: onChain.currentVersion,
        responsible_wallet: onChain.responsibleEntity,
        status: 'completed',
        is_active: 1,
      });
      synced += 1;
    } catch (err) {
      failed += 1;
      console.error(`  ✗ individual ${record.passport_number}: ${err.message}`);
    }
  }

  const [batches] = await pool.query('SELECT * FROM passport_batches ORDER BY id ASC');
  let batchesSynced = 0;
  let batchesMissing = 0;
  let batchesFailed = 0;

  console.log(`Syncing ${batches.length} Merkle batch record(s) from chain...`);
  for (const batch of batches) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const onChain = await blockchainService.getMerkleBatchFromChain(batch.batch_id);

      if (!onChain.exists) {
        // Do not silently delete local proof/membership data. Mark the batch and its
        // member blockchain records inactive so they are not represented as verified.
        // eslint-disable-next-line no-await-in-loop
        await pool.query(
          `UPDATE passport_batches
           SET status = 'failed', is_active = 0,
               error_message = 'Batch not found on-chain during sync'
           WHERE id = ?`,
          [batch.id]
        );
        // eslint-disable-next-line no-await-in-loop
        await pool.query(
          `UPDATE passport_blockchain_records pbr
           INNER JOIN passport_batch_items pbi
             ON pbi.passport_blockchain_record_id = pbr.id
           SET pbr.is_active = 0, pbr.status = 'failed'
           WHERE pbi.passport_batch_id = ?`,
          [batch.id]
        );
        batchesMissing += 1;
        continue;
      }

      const rootMatches = onChain.merkleRoot.toLowerCase() === batch.merkle_root.toLowerCase();
      const countMatches = Number(onChain.passportCount) === Number(batch.passport_count);
      const issuerMatches = onChain.issuer.toLowerCase() === batch.issuer_wallet.toLowerCase();

      if (!rootMatches || !countMatches || !issuerMatches) {
        throw new Error('On-chain batch root/count/issuer differs from the database');
      }

      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `UPDATE passport_batches
         SET status = 'completed', is_active = ?, contract_address = ?, error_message = NULL
         WHERE id = ?`,
        [onChain.active ? 1 : 0, onChain.contractAddress, batch.id]
      );
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `UPDATE passport_blockchain_records pbr
         INNER JOIN passport_batch_items pbi
           ON pbi.passport_blockchain_record_id = pbr.id
         SET pbr.status = 'completed', pbr.is_active = ?
         WHERE pbi.passport_batch_id = ?`,
        [onChain.active ? 1 : 0, batch.id]
      );
      batchesSynced += 1;
    } catch (err) {
      batchesFailed += 1;
      console.error(`  ✗ batch ${batch.batch_id}: ${err.message}`);
    }
  }

  console.log(
    `Done. Individual synced: ${synced}, missing: ${missing}, failed: ${failed}. ` +
    `Batches synced: ${batchesSynced}, missing: ${batchesMissing}, failed: ${batchesFailed}.`
  );
  process.exit(failed + batchesFailed > 0 ? 1 : 0);
};

run().catch((err) => {
  console.error('Sync script failed:', err);
  process.exit(1);
});
