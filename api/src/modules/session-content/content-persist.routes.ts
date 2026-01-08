import { Router, Request, Response } from 'express'
import { authenticateToken } from '../../middlewares/auth.middleware'
import sessionContentService from './session-content.service'

const router = Router()

/**
 * POST /content/persist
 *
 * Unified endpoint to persist content across 3 scenarios:
 * 1. Reload/Recovery: Ensure DB has latest content
 * 2. Language Switch: Save old content to history, load new language starter
 * 3. Challenge Switch: Save previous challenge content, persist current challenge
 *
 * Request Body:
 * {
 *   sessionId: string,
 *   challengeId: number,
 *   contentType: "code",
 *   currentLanguage: string,
 *   currentContent: string,
 *   previousLanguage?: string,
 *   previousContent?: string,
 *   forceSnapshot?: boolean (default: true)
 * }
 */
router.post('/persist', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sessionId,
      challengeId,
      contentType = 'code',
      currentLanguage,
      currentContent,
      previousLanguage,
      previousContent,
      forceSnapshot = true
    } = req.body

    // Validation
    if (!sessionId || !challengeId || !currentLanguage || currentContent === undefined) {
      console.log('[ContentPersistRoute] ❌ Missing required fields')
      res.status(400).json({
        error: 'Missing required fields: sessionId, challengeId, currentLanguage, currentContent'
      })
      return
    }

    console.log('[ContentPersistRoute] POST /content/persist:', {
      sessionId,
      challengeId,
      currentLanguage,
      previousLanguage,
      scenario: previousLanguage ? 'language-switch' : 'recover'
    })

    // Call unified service method
    const result = await sessionContentService.saveWithHistory(
      sessionId,
      challengeId,
      contentType,
      currentLanguage,
      currentContent,
      {
        previousLanguage,
        previousContent,
        forceSnapshot,
        started: true
      }
    )

    if (result.success) {
      console.log('[ContentPersistRoute] ✅ Content persisted')
      res.json({
        success: true,
        message: 'Content persisted successfully',
        details: {
          savedHistory: !!previousLanguage,
          forceSnapshot: forceSnapshot,
          language: currentLanguage
        }
      })
    } else {
      console.error('[ContentPersistRoute] ❌ Failed to persist')
      res.status(500).json({
        error: 'Failed to persist content'
      })
    }
  } catch (err: any) {
    console.error('[ContentPersistRoute] Error:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /content/persist-and-switch
 *
 * For explicit language/challenge switches with detailed logging
 * Calls persistAndSwitchContent method instead
 */
router.post('/persist-and-switch', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      sessionId,
      challengeId,
      contentType = 'code',
      currentLanguage,
      currentContent,
      previousLanguage,
      previousContent
    } = req.body

    if (!sessionId || !challengeId || !currentLanguage || currentContent === undefined) {
      res.status(400).json({
        error: 'Missing required fields'
      })
      return
    }

    console.log('[ContentPersistRoute] POST /content/persist-and-switch')

    const result = await sessionContentService.persistAndSwitchContent(
      sessionId,
      challengeId,
      contentType,
      currentLanguage,
      currentContent,
      previousLanguage,
      previousContent
    )

    res.json(result)
  } catch (err: any) {
    console.error('[ContentPersistRoute] Error in persist-and-switch:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
