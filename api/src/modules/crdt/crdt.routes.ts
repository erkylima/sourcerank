import { Router, Request, Response } from 'express'
import { authenticateToken } from '../../middlewares/auth.middleware'
import crdtService from './crdt.service'

const router = Router()

/**
 * POST /crdt/snapshot
 * Force save snapshot for a specific challenge/session combination
 * Called when user switches challenges to ensure state persistence
 */
router.post('/snapshot', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { sessionId, challengeId, contentType } = req.body

    if (!sessionId || !challengeId) {
      res.status(400).json({ error: 'Missing sessionId or challengeId' })
      return
    }

    console.log('[CRDT] Force save snapshot:', { sessionId, challengeId, contentType })
    const result = await crdtService.forceSnapshotSave(sessionId, challengeId, contentType || 'code')

    res.json({ success: true, result })
  } catch (err: any) {
    console.error('[CRDT] Error forcing snapshot:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
