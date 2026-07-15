const router = require('express').Router();
const controller = require('../controllers/walletFundingLog.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getFundingLogs);
router.get('/company/:companyId', controller.getFundingLogsByCompany);
router.get('/:id', controller.getFundingLog);
router.post('/', validateBody(['company_id', 'wallet_address', 'amount']), controller.createFundingLog);
router.delete('/:id', controller.deleteFundingLog);

module.exports = router;
