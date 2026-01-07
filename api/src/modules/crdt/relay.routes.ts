import { Router, Request, Response } from 'express'
import relayController from './relay.controller'

const router = Router()

/**
 * GET /relay/state?sessionId=X&challengeId=Y&contentType=code&language=python
 * Poll relay for snapshot changes
 * Used by API polling timer to decide whether to persist to database
 */
router.get('/state', async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId, contentType = 'code', language = 'python' } = req.query

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    console.log('[RelayRoute] GET /relay/state:', { sessionId, challengeId, contentType, language })

    const result = await relayController.getSnapshotIfChanged(
      String(sessionId),
      parseInt(String(challengeId)),
      String(contentType),
      String(language)
    )

    res.json(result)
  } catch (err: any) {
    console.error('[RelayRoute] Error in /relay/state:', err)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /relay/snapshot
 * Force relay to persist snapshot (called when switching challenges)
 */
router.post('/snapshot', async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId, contentType = 'code', language = 'python' } = req.body

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    console.log('[RelayRoute] POST /relay/snapshot:', { sessionId, challengeId, contentType, language })

    const result = await relayController.forceSnapshot(
      sessionId,
      challengeId,
      contentType,
      language
    )

    res.json(result)
  } catch (err: any) {
    console.error('[RelayRoute] Error in /relay/snapshot:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
