const router = require('express').Router();
const controller = require('../controllers/passport.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getPassports);
router.get('/company/:companyId', controller.getPassportsByCompany);
router.get('/:id', controller.getPassport);
router.post('/', validateBody(['company_id', 'passport_number']), controller.createPassport);
router.put('/:id', controller.updatePassport);
router.delete('/:id', controller.deletePassport);

module.exports = router;
