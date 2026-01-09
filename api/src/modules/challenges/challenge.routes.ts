import { Router } from 'express'
import challengeController from './challenge.controller'
import { authenticateToken, requireRole } from '../../middlewares/auth.middleware'

const router = Router()
// Avaliação automática do challenge
router.get('/:id/evaluate', (req, res) => challengeController.evaluate(req, res))
// Endpoint para exemplos de avaliação
router.get('/:id/examples', (req, res) => challengeController.examples(req, res))

// Public routes
router.get('/', (req, res) => challengeController.list(req, res))
router.get('/:id', (req, res) => challengeController.getById(req, res))

// Protected routes (interviewer only)
router.post('/', authenticateToken, requireRole(['interviewer']), (req, res) =>
  challengeController.create(req, res),
)
router.put('/:id', authenticateToken, requireRole(['interviewer']), (req, res) =>
  challengeController.update(req, res),
)
router.delete('/:id', authenticateToken, requireRole(['interviewer']), (req, res) =>
  challengeController.delete(req, res),
)

export default router
