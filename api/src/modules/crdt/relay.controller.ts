import axios from 'axios'

const RELAY_URL = process.env.RELAY_URL || 'http://yjs-relay:1234'

export class RelayController {
  /**
   * Get snapshot from relay if changed since last poll
   * This is called by the API polling timer every 5 seconds
   */
  async getSnapshotIfChanged(
    sessionId: string,
    challengeId: number,
    contentType: string = 'code',
    language: string = 'python'
  ) {
    try {
      console.log('[RelayController] Getting snapshot from relay:', { sessionId, challengeId, contentType, language })

      const url = `${RELAY_URL}/relay/state?sessionId=${sessionId}&challengeId=${challengeId}&contentType=${contentType}&language=${language}`
      const response = await axios.get(url)

      if (response.data.hasChanged) {
        console.log('[RelayController] ✅ Snapshot changed, size:', response.data.snapshot?.length)
        
        // Decode base64 snapshot
        const snapshotBuffer = Buffer.from(response.data.snapshot, 'base64')
        
        return {
          hasChanged: true,
          sessionId: response.data.sessionId,
          challengeId: response.data.challengeId,
          contentType: response.data.contentType,
          language: response.data.language,
          snapshot: snapshotBuffer,
          timestamp: response.data.timestamp
        }
      } else {
        console.log('[RelayController] ℹ️ No changes in relay')
        return {
          hasChanged: false
        }
      }
    } catch (err: any) {
      console.error('[RelayController] Error getting snapshot from relay:', err.message)
      throw err
    }
  }

  /**
   * Force relay to save snapshot (called when switching challenges)
   */
  async forceSnapshot(
    sessionId: string,
    challengeId: number,
    contentType: string = 'code',
    language: string = 'python'
  ) {
    try {
      console.log('[RelayController] Forcing snapshot in relay:', { sessionId, challengeId, contentType, language })

      const url = `${RELAY_URL}/snapshot`
      const response = await axios.post(url, {
        sessionId,
        challengeId,
        contentType,
        language
      })

      console.log('[RelayController] ✅ Force snapshot succeeded')
      return response.data
    } catch (err: any) {
      console.error('[RelayController] Error forcing snapshot:', err.message)
      throw err
    }
  }

  /**
   * Decode Y.js snapshot to extract content
   * This would need y-protocols or similar to fully decode, but for now we just pass it through
   */
  async decodeSnapshot(snapshot: Buffer) {
    // For now, we'll let the frontend decode this via y-protocols
    // The API just passes the binary snapshot through
    return snapshot
  }
}

export default new RelayController()
