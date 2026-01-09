import { Request, Response } from 'express'
import challengeService from './challenge.service'
import { Difficulty } from '../auth/auth.types'

export class ChallengeController {
  /**
   * Endpoint para avaliar challenge automaticamente
   */
  async evaluate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const sessionId = req.query.sessionId as string || req.body.sessionId as string
      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' })
        return
      }
      const result = await challengeService.evaluate(id, sessionId)
      res.json({ evaluation: result })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { title, description, difficulty, codeExample, langExample } = req.body
      const userId = (req as any).userId

      if (!title || !description || !difficulty || !codeExample || !langExample) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }

      const validDifficulties = ['basic', 'intermediate', 'advanced']
      if (!validDifficulties.includes(difficulty)) {
        res.status(400).json({ error: 'Invalid difficulty level' })
        return
      }

      const challenge = await challengeService.createChallenge(
        title,
        description,
        difficulty as Difficulty,
        codeExample,
        langExample,
        userId,
      )

      res.status(201).json({ challenge })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async list(req: Request, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 100)
      const offset = parseInt(req.query.offset as string) || 0

      const { challenges, total } = await challengeService.getChallenges(limit, offset)
      res.json({ challenges, total, limit, offset })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const challenge = await challengeService.getChallengeById(id)
      res.json({ challenge })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const { title, description, difficulty, codeExample, langExample } = req.body

      if (difficulty && !['basic', 'intermediate', 'advanced'].includes(difficulty)) {
        res.status(400).json({ error: 'Invalid difficulty level' })
        return
      }

      const challenge = await challengeService.updateChallenge(id, title, description, difficulty, codeExample, langExample)
      res.json({ challenge })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      await challengeService.deleteChallenge(id)
      res.status(204).send()
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}

export default new ChallengeController()
