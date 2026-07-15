const router = require('express').Router();
const controller = require('../controllers/companyApplication.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getApplications);
router.get('/company/:companyId', controller.getApplicationsByCompany);
router.get('/:id', controller.getApplication);
router.post('/', validateBody(['company_id', 'plan_id']), controller.createApplication);
router.patch('/:id/approve', validateBody(['is_approved']), controller.approveApplication);
router.delete('/:id', controller.deleteApplication);

module.exports = router;
