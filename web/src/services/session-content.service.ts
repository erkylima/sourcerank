import axios from 'axios'
import authService from './auth.service'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export interface ChallengeContent {
  content: string
  language: string
  started: boolean
}

export class SessionContentService {
  /**
   * Get the preferred language for a challenge (most recently used)
   */
  async getPreferredLanguage(sessionId: string, challengeId: number): Promise<string> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Getting preferred language:', { sessionId, challengeId })

      const response = await axios.get(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}/preferred-language`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      console.log('[sessionContentService] Preferred language:', response.data.language)
      return response.data.language
    } catch (err) {
      console.warn('[sessionContentService] Error getting preferred language, defaulting to python:', err)
      return 'python'
    }
  }

  /**
   * Load content for a challenge from the database
   */
  async loadChallengeContent(sessionId: string, challengeId: number, contentType: string = 'code', language: string = 'python'): Promise<ChallengeContent> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Loading content:', { sessionId, challengeId, contentType, language })

      const response = await axios.get(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}`,
        {
          params: { contentType, language },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      const content = response.data.content || ''
      const responseLanguage = response.data.language || 'python'
      const started = response.data.started || false
      console.log('[sessionContentService] ✅ Content loaded:', { length: content.length, language: responseLanguage, started })
      return { content, language: responseLanguage, started }
    } catch (err: any) {
      console.error('[sessionContentService] ❌ Failed to load content:', err.response?.status, err.message)
      return { content: '', language: 'python', started: false }
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
    contentType: string = 'code',
    started?: boolean
  ): Promise<boolean> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Saving content:', { sessionId, challengeId, contentType, language, contentLength: content.length, started })

      await axios.post(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}`,
        { content, contentType, language, started },
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

  /**
   * Change language for a challenge
   * Backend will move current to history and load new language
   */
  async changeLanguage(
    sessionId: string,
    challengeId: number,
    language: string,
    contentType: string = 'code'
  ): Promise<{ success: boolean; content: string; fromHistory: boolean }> {
    try {
      const token = authService.getToken()
      console.log('[sessionContentService] Changing language:', { sessionId, challengeId, language, contentType })

      const response = await axios.post(
        `${API_BASE}/session-content/${sessionId}/challenges/${challengeId}/change-language`,
        { language, contentType },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      console.log('[sessionContentService] ✅ Language changed:', response.data)
      return {
        success: response.data.success,
        content: response.data.content || '',
        fromHistory: response.data.fromHistory || false,
      }
    } catch (err: any) {
      console.error('[sessionContentService] ❌ Failed to change language:', err.response?.status, err.message)
      throw err
    }
  }
}

export default new SessionContentService()
