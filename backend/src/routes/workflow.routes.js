const router = require('express').Router();
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const {
  getWorkflows, createWorkflow, updateWorkflow,
  toggleWorkflow, deleteWorkflow, getWorkflowRuns, testWorkflow,
} = require('../controllers/workflow.controller');

router.get('/',                    verifyToken, getWorkflows);
router.post('/',                   verifyToken, requireRole('ADMIN'), createWorkflow);
router.put('/:id',                 verifyToken, requireRole('ADMIN'), updateWorkflow);
router.patch('/:id/toggle',        verifyToken, requireRole('ADMIN'), toggleWorkflow);
router.delete('/:id',              verifyToken, requireRole('ADMIN'), deleteWorkflow);
router.get('/:id/runs',            verifyToken, getWorkflowRuns);
router.post('/:id/test',           verifyToken, requireRole('ADMIN'), testWorkflow);

module.exports = router;
