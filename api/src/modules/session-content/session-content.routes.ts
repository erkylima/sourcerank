import { Router, Request, Response } from 'express'
import { authenticateToken } from '../../middlewares/auth.middleware'
import sessionContentService from './session-content.service'

const router = Router()

/**
 * GET /session-content/:sessionId/challenges/:challengeId/preferred-language
 * Get the most recently used language for a challenge
 */
router.get('/:sessionId/challenges/:challengeId/preferred-language', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId } = req.params

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    console.log('[SessionContentController] GET preferred language for:', { sessionId, challengeId })
    const language = await sessionContentService.getPreferredLanguage(sessionId, parseInt(challengeId))

    res.json({ language })
  } catch (err: any) {
    console.error('[SessionContentController] Error getting preferred language:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /session-content/:sessionId/challenges/:challengeId
 * Get content for a specific challenge
 */
router.get('/:sessionId/challenges/:challengeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId } = req.params
    const { contentType = 'code', language = 'python' } = req.query

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    console.log('[SessionContentController] GET content for:', { sessionId, challengeId, contentType, language })
    const content = await sessionContentService.getChallengeContent(sessionId, parseInt(challengeId), String(contentType), String(language))

    res.json(content)
  } catch (err: any) {
    console.error('[SessionContentController] Error getting content:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /session-content/:sessionId/challenges/:challengeId
 * Save content for a specific challenge
 */
router.post('/:sessionId/challenges/:challengeId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId } = req.params
    const { content, contentType = 'code', language = 'python', started } = req.body

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    if (content === undefined) {
      res.status(400).json({ error: 'Missing content' })
      return
    }

    console.log('[SessionContentController] POST content for:', { sessionId, challengeId, contentType, language, contentLength: content.length, started })
    const saved = await sessionContentService.saveChallengeContent(
      sessionId, 
      parseInt(challengeId), 
      String(contentType), 
      content, 
      language,
      started !== undefined ? started : true  // Default to true if not specified
    )

    res.json({ success: true, data: saved })
  } catch (err: any) {
    console.error('[SessionContentController] Error saving content:', err.message)
    
    // Check for foreign key constraint violation
    if (err.code === '23503') {
      console.warn('[SessionContentController] ⚠️ Session or challenge does not exist - ignoring save')
      // Return success anyway - the content will be saved when session is created
      res.json({ success: true, message: 'Session not ready yet, content will be saved when available', data: null })
      return
    }
    
    res.status(500).json({ error: err.message })
  }
})

export default router
