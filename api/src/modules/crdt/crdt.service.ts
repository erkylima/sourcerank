import axios from 'axios'

const RELAY_URL = process.env.YJS_RELAY_URL || 'http://yjs-relay:1234'

class CrdtService {
  /**
   * Force save snapshot on the relay server
   * This ensures the current state is persisted when user switches challenges
   */
  async forceSnapshotSave(sessionId: string, challengeId: string, contentType: string = 'code') {
    try {
      const response = await axios.post(
        `${RELAY_URL}/snapshot`,
        {
          sessionId,
          challengeId,
          contentType,
        },
        {
          timeout: 5000,
        }
      )

      console.log(`[crdtService] ✅ Snapshot saved for ${sessionId}:${challengeId}:${contentType}`)
      return response.data
    } catch (err: any) {
      console.error(`[crdtService] ❌ Failed to save snapshot:`, err.message)
      // Don't throw - snapshot save failure shouldn't block UI
      return { success: false, error: err.message }
    }
  }
}

export default new CrdtService()
