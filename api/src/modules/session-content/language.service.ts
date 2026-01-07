import { query } from '../../config/database'
import sessionContentService from './session-content.service'
import contentHistoryService from './content-history.service'

export class LanguageService {
  /**
   * Change language for a challenge
   * 1. Moves current state to history
   * 2. Loads new language from history or creates starter
   * 3. Updates session_challenge_content
   */
  async changeLanguage(
    sessionId: string,
    challengeId: number,
    newLanguage: string,
    contentType: string = 'code'
  ) {
    console.log('[LanguageService] Changing language:', { sessionId, challengeId, contentType, newLanguage })

    try {
      // 1. Get current content
      const currentResult = await query(
        `SELECT language, content FROM session_challenge_content 
         WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3`,
        [sessionId, challengeId, contentType]
      )

      const currentRow = currentResult.rows[0]

      if (currentRow) {
        const oldLanguage = currentRow.language
        const oldContent = currentRow.content

        console.log('[LanguageService] Found current content in:', oldLanguage)

        // 2. Only move to history if language is actually different
        if (oldLanguage !== newLanguage && oldContent) {
          console.log('[LanguageService] Saving old language to history')
          await contentHistoryService.saveToHistory(
            sessionId,
            challengeId,
            contentType,
            oldLanguage,
            oldContent
          )
        }
      }

      // 3. Try to load new language from history
      const historyContent = await contentHistoryService.loadFromHistory(
        sessionId,
        challengeId,
        contentType,
        newLanguage
      )

      let newContent: string
      if (historyContent) {
        console.log('[LanguageService] Loaded from history')
        newContent = historyContent.content
      } else {
        console.log('[LanguageService] No history found, creating starter')
        // Create starter code - for now, return empty (frontend can apply starter)
        newContent = ''
      }

      // 4. Update session_challenge_content with new language
      await sessionContentService.saveChallengeContent(
        sessionId,
        challengeId,
        contentType,
        newContent,
        newLanguage,
        newContent === ''  // started = false if starter, true if had history
      )

      console.log('[LanguageService] ✅ Language changed successfully')

      return {
        success: true,
        language: newLanguage,
        content: newContent,
        fromHistory: !!historyContent
      }
    } catch (err) {
      console.error('[LanguageService] Error changing language:', err)
      throw err
    }
  }

  /**
   * Get all languages that have been used for a challenge
   */
  async getLanguageHistory(
    sessionId: string,
    challengeId: number,
    contentType: string = 'code'
  ) {
    console.log('[LanguageService] Getting language history:', { sessionId, challengeId, contentType })

    try {
      // Get from both current and history tables
      const currentResult = await query(
        `SELECT DISTINCT language FROM session_challenge_content 
         WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3
         UNION
         SELECT DISTINCT language FROM session_challenge_content_history 
         WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3`,
        [sessionId, challengeId, contentType]
      )

      const languages = currentResult.rows.map(row => row.language)
      console.log('[LanguageService] Languages found:', languages)
      return languages
    } catch (err) {
      console.error('[LanguageService] Error getting language history:', err)
      return []
    }
  }
}

export default new LanguageService()
