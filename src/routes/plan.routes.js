const router = require('express').Router();
const controller = require('../controllers/plan.controller');
const validateBody = require('../middleware/validate.middleware');

router.get('/', controller.getPlans);
router.get('/:id', controller.getPlan);
router.post('/', validateBody(['name']), controller.createPlan);
router.put('/:id', controller.updatePlan);
router.delete('/:id', controller.deletePlan);

module.exports = router;
