class CrdtService {
  /**
   * Force save snapshot on the relay server
   * This ensures the current state is persisted when user switches challenges
   * NOTE: This calls the relay API handler which interacts with the Yjs relay
   */
  async forceSnapshotSave(sessionId: string, challengeId: string, contentType: string = 'code') {
    try {
      // Call the relay controller directly (not the Yjs relay)
      // The relay.routes handler will interact with the Yjs relay server
      const relayController = require('./relay.controller').default
      
      const result = await relayController.forceSnapshot(
        sessionId,
        challengeId,
        contentType
      )

      console.log(`[crdtService] ✅ Snapshot saved for ${sessionId}:${challengeId}:${contentType}`)
      return result
    } catch (err: any) {
      console.error(`[crdtService] ❌ Failed to save snapshot:`, err.message)
      // Don't throw - snapshot save failure shouldn't block UI
      return { success: false, error: err.message }
    }
  }
}

export default new CrdtService()
