const router = require('express').Router();
const controller = require('../controllers/admin.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getAdmins);
router.get('/:id', controller.getAdmin);
router.post('/', validateBody(['name', 'email']), controller.createAdmin);
router.put('/:id', controller.updateAdmin);
router.post('/:id/wallet/import', validateBody(['private_key']), controller.importAdminWallet);
router.post('/:id/wallet/generate', controller.generateAdminWallet);
router.delete('/:id', controller.deleteAdmin);

module.exports = router;
