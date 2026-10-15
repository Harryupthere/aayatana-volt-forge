
const router = require('express').Router();
const controller = require('../controllers/passportBatch.controller');
const validateBody = require('../middleware/validate.middleware');

router.post(
  '/',
  validateBody(['company_id', 'passports']),
  controller.createBatch
);

router.get('/company/:companyId', controller.getBatchesByCompany);
router.get('/:batchId/passports', controller.getBatchPassports);
router.get('/:batchId', controller.getBatch);

module.exports = router;
