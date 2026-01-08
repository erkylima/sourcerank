import { query } from '../../config/database'
import relayController from './relay.controller'
import contentHistoryService from '../session-content/content-history.service'
import sessionContentService from '../session-content/session-content.service'
import * as Y from 'yjs'

const POLLING_INTERVAL = Number(process.env.POLLING_INTERVAL || 5000)

export class PollingService {
  private pollingIntervalId: NodeJS.Timeout | null = null

  /**
   * Start the polling timer
   * This runs every 5 seconds and checks all active relay documents for changes
   */
  startPolling() {
    if (this.pollingIntervalId) {
      console.log('[PollingService] Polling already running')
      return
    }

    console.log(`[PollingService] Starting polling interval: ${POLLING_INTERVAL}ms`)

    this.pollingIntervalId = setInterval(async () => {
      try {
        await this.pollAllSessions()
      } catch (err) {
        console.error('[PollingService] Error in polling loop:', err)
      }
    }, POLLING_INTERVAL)
  }

  /**
   * Stop the polling timer
   */
  stopPolling() {
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId)
      this.pollingIntervalId = null
      console.log('[PollingService] Polling stopped')
    }
  }

  /**
   * Poll all active sessions in relay and persist changes to database
   * This is called every 5 seconds
   */
  private async pollAllSessions() {
    try {
      // Get all active sessions (not just ones with content)
      const result = await query(
        `SELECT id FROM sessions WHERE status = 'active' LIMIT 100`,
        []
      )

      const activeSessions = result.rows || []
      
      if (activeSessions.length === 0) {
        console.log('[PollingService] No active sessions to poll')
        return
      }

      console.log(`[PollingService] 🔄 Polling ${activeSessions.length} active sessions...`)

      // Get all challenges for polling
      const challengesResult = await query(`SELECT id FROM challenges LIMIT 50`, [])
      const challenges = challengesResult.rows || []

      const languages = ['python', 'javascript', 'typescript', 'java', 'go', 'csharp', 'cpp']

      let changesCount = 0
      for (const session of activeSessions) {
        for (const challenge of challenges) {
          for (const language of languages) {
            try {
              const changed = await this.pollSession(
                session.id,
                challenge.id,
                'code',
                language
              )
              if (changed) changesCount++
            } catch (err) {
              // Silently skip - not all combinations will exist
            }
          }
        }
      }

      if (changesCount > 0) {
        console.log(`[PollingService] ✅ Persisted ${changesCount} changes`)
      }
    } catch (err) {
      console.error('[PollingService] Error in pollAllSessions:', err)
    }
  }

  /**
   * Poll a single session for changes
   */
  private async pollSession(
    sessionId: string,
    challengeId: number,
    contentType: string,
    language: string
  ): Promise<boolean> {
    try {
      // Get snapshot from relay
      const snapshot = await relayController.getSnapshotIfChanged(
        sessionId,
        challengeId,
        contentType,
        language
      )

      if (!snapshot.hasChanged) {
        return false
      }

      console.log(`[PollingService] 📝 Changes detected in relay for:`, { sessionId, challengeId, contentType, language })

      // Decode snapshot to extract content
      if (!snapshot.snapshot) {
        console.warn('[PollingService] Snapshot buffer is empty')
        return false
      }

      const content = await this.decodeSnapshot(snapshot.snapshot)

      if (content === null) {
        console.warn('[PollingService] Failed to decode snapshot')
        return false
      }

      // Get current content from DB to check if language changed
      const dbResult = await query(
        `SELECT content, language FROM session_challenge_content 
         WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 AND language = $4`,
        [sessionId, challengeId, contentType, language]
      )

      const oldContent = dbResult.rows.length > 0 ? dbResult.rows[0].content : null

      // If language changed, move old content to history
      if (oldContent && oldContent !== content) {
        console.log('[PollingService] 💾 Saving old content to history')
        await contentHistoryService.saveToHistory(
          sessionId,
          challengeId,
          contentType,
          language,
          oldContent
        )
      }

      // Save new content to DB
      console.log('[PollingService] 💾 Saving content to DB:', { contentLength: content.length })
      await sessionContentService.saveChallengeContent(
        sessionId,
        challengeId,
        contentType,
        content,
        language,
        true
      )

      return true
    } catch (err) {
      console.error('[PollingService] Error polling session:', err)
      return false
    }
  }

  /**
   * Decode Y.js snapshot to extract content
   * Extracts the text content from the Y.Doc
   */
  private async decodeSnapshot(snapshotBuffer: Buffer): Promise<string | null> {
    try {
      // Create a temporary Y.Doc and apply the snapshot
      const tempDoc = new Y.Doc()
      Y.applyUpdate(tempDoc, new Uint8Array(snapshotBuffer))

      // Get the content from the doc
      // Try to get from Y.Text first (if frontend uses Y.Text for content)
      const ytext = tempDoc.getText('content')
      if (ytext && ytext.toString().length > 0) {
        return ytext.toString()
      }

      // Fallback: check for Y.Map with content field
      const ymap = tempDoc.getMap('state')
      if (ymap && ymap.has('content')) {
        const content = ymap.get('content')
        if (typeof content === 'string') {
          return content
        }
      }

      // If still empty, try to get any Y.Text
      for (const [key, value] of tempDoc.share.entries()) {
        if (value instanceof Y.Text) {
          const text = value.toString()
          if (text.length > 0) {
            console.log(`[PollingService] Found Y.Text at key: ${key}`)
            return text
          }
        }
      }

      console.warn('[PollingService] Could not extract content from snapshot')
      return null
    } catch (err) {
      console.error('[PollingService] Error decoding snapshot:', err)
      return null
    }
  }
}

export default new PollingService()
