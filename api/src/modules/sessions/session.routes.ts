import { Router } from 'express'
import sessionController from './session.controller'
import { authenticateToken } from '../../middlewares/auth.middleware'

const router = Router()

// All routes require authentication
router.use(authenticateToken)

// Routes sem parâmetro :id (devem vir primeiro)
router.post('/create-interview', (req, res) => sessionController.createForInterviewer(req, res))
router.post('/request-access', (req, res) => sessionController.requestAccess(req, res))
router.post('/', (req, res) => sessionController.create(req, res))
router.get('/', (req, res) => sessionController.listUserSessions(req, res))

// Routes com parâmetro :id (devem vir depois)
router.get('/:id', (req, res) => sessionController.getById(req, res))
router.patch('/:id/accept', (req, res) => sessionController.acceptInterviewee(req, res))
router.patch('/:id/reject', (req, res) => sessionController.rejectInterviewee(req, res))
router.patch('/:id/end', (req, res) => sessionController.endSession(req, res))
router.patch('/:id/status', (req, res) => sessionController.updateStatus(req, res))
router.patch('/:id/challenge', (req, res) => sessionController.updateChallenge(req, res))

export default router
