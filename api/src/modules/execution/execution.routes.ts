import { Router } from 'express'
import executionController from './execution.controller'
import { authenticateToken } from '../../middlewares/auth.middleware'

const router = Router()

// Routes accessible by Runner without authentication
router.post('/:id/report', (req, res) => executionController.reportResult(req, res))
router.post('/:executionId/logs', (req, res) => executionController.addLog(req, res))

// All other routes require authentication
router.use(authenticateToken)

// Submit code for execution
router.post('/', (req, res) => executionController.submit(req, res))

// Alias for backward compatibility
router.post('/run', (req, res) => executionController.submit(req, res))

// Get execution by ID
router.get('/:id', (req, res) => executionController.getById(req, res))

// Get logs for execution
router.get('/:executionId/logs', (req, res) => executionController.getLogs(req, res))

// Get all executions for a session
router.get('/session/:sessionId', (req, res) => executionController.getSessionExecutions(req, res))

export default router
