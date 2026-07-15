const router = require('express').Router();
const controller = require('../controllers/companyWallet.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getWallets);
router.get('/company/:companyId', controller.getWalletByCompany);
router.get('/:id', controller.getWallet);
router.post('/', validateBody(['private_key']), controller.createWallet);
router.put('/:id', controller.updateWallet);
router.delete('/:id', controller.deleteWallet);

module.exports = router;
