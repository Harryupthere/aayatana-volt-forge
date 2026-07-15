const router = require('express').Router();
const controller = require('../controllers/company.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getCompanies);
router.get('/:id', controller.getCompany);
router.post('/', validateBody(['name', 'address']), controller.registerCompany);
router.put('/:id', controller.updateCompany);
router.patch('/:id/approve', validateBody(['is_approved']), controller.approveCompany);
router.delete('/:id', controller.deleteCompany);

module.exports = router;
