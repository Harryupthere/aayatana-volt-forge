const router = require('express').Router();

router.use('/admins', require('./admin.routes'));
router.use('/plans', require('./plan.routes'));
router.use('/companies', require('./company.routes'));
router.use('/company-applications', require('./companyApplication.routes'));
router.use('/company-wallets', require('./companyWallet.routes'));
router.use('/wallet-funding-logs', require('./walletFundingLog.routes'));
router.use('/passports', require('./passport.routes'));
router.use('/passport-blockchain-records', require('./passportBlockchainRecord.routes'));
router.use('/blockchain-transactions', require('./blockchainTransactionQueue.routes'));

module.exports = router;
