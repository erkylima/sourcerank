import { query } from '../../config/database'

export class ContentHistoryService {
  /**
   * Save current content to history before language switch
   */
  async saveToHistory(
    sessionId: string,
    challengeId: number,
    contentType: string,
    language: string,
    content: string
  ) {
    console.log('[ContentHistoryService] Saving to history:', { sessionId, challengeId, contentType, language, contentLength: content.length })
    
    const result = await query(
      `INSERT INTO session_challenge_content_history 
       (session_id, challenge_id, content_type, language, content, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [sessionId, challengeId, contentType, language, content]
    )

    if (result.rows.length > 0) {
      console.log('[ContentHistoryService] ✅ Saved to history:', result.rows[0].id)
    }
    return result.rows[0] || null
  }

  /**
   * Load content from history for a specific language
   */
  async loadFromHistory(
    sessionId: string,
    challengeId: number,
    contentType: string,
    language: string
  ) {
    console.log('[ContentHistoryService] Loading from history:', { sessionId, challengeId, contentType, language })
    
    const result = await query(
      `SELECT * FROM session_challenge_content_history 
       WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 AND language = $4
       ORDER BY updated_at DESC LIMIT 1`,
      [sessionId, challengeId, contentType, language]
    )

    if (result.rows.length > 0) {
      const row = result.rows[0]
      console.log('[ContentHistoryService] ✅ Found in history:', { contentLength: row.content.length, updatedAt: row.updated_at })
      return {
        id: row.id,
        sessionId: row.session_id,
        challengeId: row.challenge_id,
        contentType: row.content_type,
        language: row.language,
        content: row.content,
        updatedAt: row.updated_at
      }
    }

    console.log('[ContentHistoryService] ℹ️ No history found for this language')
    return null
  }

  /**
   * Get all history entries for a session/challenge/contentType
   */
  async getHistoryForContent(
    sessionId: string,
    challengeId: number,
    contentType: string
  ) {
    console.log('[ContentHistoryService] Getting history for:', { sessionId, challengeId, contentType })
    
    const result = await query(
      `SELECT DISTINCT language, MAX(updated_at) as updated_at FROM session_challenge_content_history 
       WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3
       GROUP BY language
       ORDER BY updated_at DESC`,
      [sessionId, challengeId, contentType]
    )

    return result.rows || []
  }

  /**
   * Clear history for a session (optional cleanup)
   */
  async clearHistory(sessionId: string) {
    console.log('[ContentHistoryService] Clearing history for session:', sessionId)
    
    const result = await query(
      `DELETE FROM session_challenge_content_history WHERE session_id = $1`,
      [sessionId]
    )

    console.log('[ContentHistoryService] ✅ History cleared')
    return result
  }
}

export default new ContentHistoryService()
