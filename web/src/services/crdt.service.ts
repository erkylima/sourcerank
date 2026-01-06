import axios from 'axios'
import { authService } from './auth.service'

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`

class CrdtService {
  /**
   * Force save current challenge state to relay
   * Called when user changes challenges to ensure persistence
   */
  async forceSnapshotSave(sessionId: string, challengeId: string, contentType: string = 'code') {
    try {
      console.log('[crdtService] Forcing snapshot save for challenge:', { sessionId, challengeId, contentType })
      
      // Get token from auth service
      const token = authService.getToken()
      if (!token) {
        console.error('[crdtService] No auth token found')
        return { success: false }
      }

      const response = await axios.post(
        `${API_BASE}/crdt/snapshot`,
        {
          sessionId,
          challengeId,
          contentType,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      )
      console.log('[crdtService] ✅ Snapshot saved successfully')
      return response.data
    } catch (err) {
      console.error('[crdtService] Failed to save snapshot:', err)
      // Don't throw - snapshot save failure shouldn't block UI
      return { success: false }
    }
  }
}

export default new CrdtService()
