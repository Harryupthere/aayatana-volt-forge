const router = require('express').Router();
const controller = require('../controllers/passportBlockchainRecord.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getRecords);
router.get('/passport/:passportId', controller.getRecordsByPassport);
router.get('/company/:companyId', controller.getRecordsByCompany);
router.get('/sync/:passportNumber', controller.syncFromChain);
router.get('/:id', controller.getRecord);
router.post('/', validateBody(['company_id', 'passport_id']), controller.createRecord);
router.patch('/:id/lifecycle', validateBody(['data']), controller.queueLifecycleUpdate);
router.patch('/:id/transfer', validateBody(['new_company_id']), controller.queueTransferResponsibility);
router.put('/:id', controller.updateRecord);
router.delete('/:id', controller.deleteRecord);

module.exports = router;
