import { Request, Response } from 'express'
import authService from './auth.service'
import { UserRole } from './auth.types'

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, role, name } = req.body

      // Validation
      if (!email || !password || !role) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }

      if (!['interviewer', 'interviewee'].includes(role)) {
        res.status(400).json({ error: 'Invalid role' })
        return
      }

      const { user, token } = await authService.register(email, password, role as UserRole, name)
      res.status(201).json({ user, token })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body

      // Validation
      if (!email || !password) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }

      const { user, token } = await authService.login(email, password)
      res.json({ user, token })
    } catch (error: any) {
      res.status(401).json({ error: error.message })
    }
  }

  async me(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).userId
      const user = await authService.getUserById(userId)
      res.json({ user })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }
}

export default new AuthController()
