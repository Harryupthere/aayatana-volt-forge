// Bulk-reconciles every active passport_blockchain_records row with the current
// on-chain state, read via the configured Infura RPC. Safe to re-run (idempotent) —
// run it manually, or on a cron, to catch up the DB after any missed/failed events.
//
// Usage: node src/scripts/syncFromChain.js

require('dotenv').config();

const pool = require('../config/db.config');
const recordQueries = require('../queries/passportBlockchainRecord.queries');
const blockchainService = require('../services/blockchain.service');

const run = async () => {
  await pool.testConnection();

  const records = await recordQueries.getAllRecords({ where: 'is_active = 1' });
  console.log(`Syncing ${records.length} active passport record(s) from chain...`);

  let synced = 0;
  let missing = 0;
  let failed = 0;

  for (const record of records) {
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
      console.error(`  ✗ ${record.passport_number}: ${err.message}`);
    }
  }

  console.log(`Done. Synced: ${synced}, missing on-chain: ${missing}, failed: ${failed}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Sync script failed:', err);
  process.exit(1);
});
