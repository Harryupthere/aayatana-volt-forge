const router = require('express').Router();
const controller = require('../controllers/blockchainTransactionQueue.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getTransactions);
router.get('/pending', controller.getPendingTransactions);
router.get('/company/:companyId', controller.getTransactionsByCompany);
router.get('/:id', controller.getTransaction);
router.post('/', validateBody(['company_id', 'transaction_type']), controller.createTransaction);
router.patch('/:id/status', validateBody(['status']), controller.updateTransactionStatus);
router.post('/:id/process', controller.processTransactionNow);
router.delete('/:id', controller.deleteTransaction);

module.exports = router;
