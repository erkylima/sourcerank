import { Request, Response } from 'express'
import sessionService from './session.service'

export class SessionController {
  async create(req: Request, res: Response): Promise<void> {
    try {
      const { intervieweeId, currentChallengeId } = req.body
      const interviewerId = (req as any).userId

      if (!currentChallengeId) {
        res.status(400).json({ error: 'Missing required field: currentChallengeId' })
        return
      }

      const session = await sessionService.createSession(interviewerId, intervieweeId, currentChallengeId)
      res.status(201).json({ session })
    } catch (error: any) {
      console.error('Session creation error:', error.message)
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message })
      } else if (error.message.includes('Foreign key')) {
        res.status(400).json({ error: 'Invalid data: ' + error.message })
      } else {
        res.status(400).json({ error: error.message })
      }
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const session = await sessionService.getSessionById(id)

      // Check if user is part of this session
      const userId = (req as any).userId
      if (session.interviewer_id !== userId && session.interviewee_id !== userId) {
        res.status(403).json({ error: 'Unauthorized' })
        return
      }

      res.json({ session })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  async listUserSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId
      const sessions = await sessionService.getSessionsByUser(userId)
      res.json({ sessions })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async updateStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { status } = req.body

      if (!['pending', 'active', 'completed', 'cancelled'].includes(status)) {
        res.status(400).json({ error: 'Invalid status' })
        return
      }

      const session = await sessionService.updateSessionStatus(id, status)
      res.json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async updateChallenge(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { challengeId } = req.body

      if (!challengeId) {
        res.status(400).json({ error: 'Challenge ID is required' })
        return
      }

      const session = await sessionService.updateCurrentChallenge(id, challengeId)
      res.json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async createForInterviewer(req: Request, res: Response): Promise<void> {
    try {
      const interviewerId = (req as any).userId
      const session = await sessionService.createSessionForInterviewer(interviewerId)
      res.status(201).json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async requestAccess(req: Request, res: Response): Promise<void> {
    try {
      const intervieweeId = (req as any).userId
      const { sessionCode } = req.body

      if (!sessionCode) {
        res.status(400).json({ error: 'Session code is required' })
        return
      }

      const session = await sessionService.requestIntervieweeAccess(sessionCode, intervieweeId)
      
      // Get candidate info
      const candidate = await sessionService.getUserById(intervieweeId)
      
      // Notify interviewer via WebSocket
      const gateway = (req.app as any).locals?.executionGateway
      if (gateway) {
        gateway.notifyInterviewerOfAccessRequest(session.interviewer_id, session.id, candidate.name || candidate.email)
      }
      
      res.status(200).json({ session })
    } catch (error: any) {
      console.error('Request access error:', error.message)
      if (error.message.includes('not found')) {
        res.status(404).json({ error: error.message })
      } else if (error.message.includes('Foreign key')) {
        res.status(400).json({ error: 'Invalid data: ' + error.message })
      } else {
        res.status(400).json({ error: error.message })
      }
    }
  }

  async acceptInterviewee(req: Request, res: Response): Promise<void> {
    try {
      const interviewerId = (req as any).userId
      const { id } = req.params

      const session = await sessionService.acceptInterviewee(id, interviewerId)
      res.json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async rejectInterviewee(req: Request, res: Response): Promise<void> {
    try {
      const interviewerId = (req as any).userId
      const { id } = req.params

      const session = await sessionService.rejectInterviewee(id, interviewerId)
      res.json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async endSession(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId
      const { id } = req.params

      const session = await sessionService.endSession(id, userId)
      res.json({ session })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}

export default new SessionController()
