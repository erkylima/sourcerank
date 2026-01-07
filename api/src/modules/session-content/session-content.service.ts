import { query } from '../../config/database'

export class SessionContentService {
  /**
   * Get preferred language for a challenge (most recently used)
   */
  async getPreferredLanguage(sessionId: string, challengeId: number): Promise<string> {
    console.log('[SessionContentService] Getting preferred language for:', { sessionId, challengeId })
    
    // Prioritize records with started: true (actual code), only use started: false if no alternative
    const result = await query(
      `SELECT language FROM session_challenge_content 
       WHERE session_id = $1 AND challenge_id = $2 
       ORDER BY started DESC, updated_at DESC LIMIT 1`,
      [sessionId, challengeId]
    )

    const language = result.rows.length > 0 ? result.rows[0].language : 'python'
    console.log('[SessionContentService] ℹ️ Preferred language:', language)
    return language
  }

  /**
   * Get content for a specific challenge in a session and language
   */
  async getChallengeContent(sessionId: string, challengeId: number, contentType: string = 'code', language: string = 'python') {
    console.log('[SessionContentService] Getting content for:', { sessionId, challengeId, contentType, language })
    
    const result = await query(
      `SELECT * FROM session_challenge_content 
       WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 AND language = $4`,
      [sessionId, challengeId, contentType, language]
    )

    if (result.rows.length === 0) {
      console.log('[SessionContentService] ℹ️ No content found for language:', language)
      return { sessionId, challengeId, contentType, content: '', language, started: false }
    }

    const row = result.rows[0]
    console.log('[SessionContentService] ✅ Content loaded:', { id: row.id, contentLength: row.content.length, language: row.language, started: row.started })
    return {
      id: row.id,
      sessionId: row.session_id,
      challengeId: row.challenge_id,
      contentType: row.content_type,
      content: row.content,
      language: row.language,
      started: row.started || false,
      updatedAt: row.updated_at
    }
  }

  /**
   * Save/update content for a specific challenge in a session
   */
  async saveChallengeContent(sessionId: string, challengeId: number, contentType: string, content: string, language: string = 'python', started: boolean = true) {
    console.log('[SessionContentService] Saving content:', { sessionId, challengeId, contentType, language, contentLength: content.length, started })
    
    // First, verify session exists
    const sessionCheck = await query(
      `SELECT id FROM sessions WHERE id = $1 LIMIT 1`,
      [sessionId]
    )
    
    if (sessionCheck.rows.length === 0) {
      console.warn('[SessionContentService] ⚠️ Session not found:', sessionId)
      // Don't throw error, just return early - session may not exist yet
      return {
        id: null,
        sessionId,
        challengeId,
        contentType,
        content,
        language,
        started: false,
        updatedAt: new Date().toISOString()
      }
    }
    
    const result = await query(
      `INSERT INTO session_challenge_content (session_id, challenge_id, content_type, content, language, started, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (session_id, challenge_id, content_type, language) 
       DO UPDATE SET content = $4, started = $6, updated_at = NOW()
       RETURNING *`,
      [sessionId, challengeId, contentType, content, language, started]
    )

    const row = result.rows[0]
    console.log('[SessionContentService] ✅ Content saved:', { id: row.id, language: row.language, contentLength: row.content.length, started: row.started })
    return {
      id: row.id,
      sessionId: row.session_id,
      challengeId: row.challenge_id,
      contentType: row.content_type,
      content: row.content,
      language: row.language,
      started: row.started,
      updatedAt: row.updated_at
    }
  }

  /**
   * Clear all content for a session (optional - for cleanup)
   */
  async clearSessionContent(sessionId: string) {
    console.log('[SessionContentService] Clearing all content for session:', sessionId)
    
    const result = await query(
      `DELETE FROM session_challenge_content WHERE session_id = $1 RETURNING COUNT(*) as count`,
      [sessionId]
    )

    console.log('[SessionContentService] ✅ Content cleared')
    return result
  }
}

export default new SessionContentService()
