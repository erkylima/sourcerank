import axios from 'axios'
import authService from './auth.service'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export interface ChallengeContent {
  content: string
  language: string
}

export class SessionContentService {
  /**
   * Load content for a challenge from the database
   */
  async loadChallengeContent(sessionId: string, challengeId: number, contentType: string = 'code'): Promise<ChallengeContent> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Loading content:', { sessionId, challengeId, contentType })

      const response = await axios.get(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}`,
        {
          params: { contentType },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      const content = response.data.content || ''
      const language = response.data.language || 'python'
      console.log('[sessionContentService] ✅ Content loaded:', { length: content.length, language })
      return { content, language }
    } catch (err: any) {
      console.error('[sessionContentService] ❌ Failed to load content:', err.response?.status, err.message)
      return { content: '', language: 'python' }
    }
  }

  /**
   * Save content for a challenge to the database
   */
  async saveChallengeContent(
    sessionId: string,
    challengeId: number,
    content: string,
    language: string = 'python',
    contentType: string = 'code'
  ): Promise<boolean> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Saving content:', { sessionId, challengeId, contentType, language, contentLength: content.length })

      await axios.post(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}`,
        { content, contentType, language },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      console.log('[sessionContentService] ✅ Content saved successfully')
      return true
    } catch (err: any) {
      console.error('[sessionContentService] ❌ Failed to save content:', err.response?.status, err.message)
      return false
    }
  }
}

export default new SessionContentService()
