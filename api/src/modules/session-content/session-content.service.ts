import { query } from '../../config/database'

export class SessionContentService {
  /**
   * Get content for a specific challenge in a session
   */
  async getChallengeContent(sessionId: string, challengeId: number, contentType: string = 'code') {
    console.log('[SessionContentService] Getting content for:', { sessionId, challengeId, contentType })
    
    const result = await query(
      `SELECT * FROM session_challenge_content 
       WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3`,
      [sessionId, challengeId, contentType]
    )

    if (result.rows.length === 0) {
      console.log('[SessionContentService] ℹ️ No content found, returning empty')
      return { sessionId, challengeId, contentType, content: '', language: 'python', started: false }
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
  async saveChallengeContent(sessionId: string, challengeId: number, contentType: string, content: string, language: string = 'python') {
    console.log('[SessionContentService] Saving content:', { sessionId, challengeId, contentType, language, contentLength: content.length })
    
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
       VALUES ($1, $2, $3, $4, $5, true, NOW())
       ON CONFLICT (session_id, challenge_id, content_type) 
       DO UPDATE SET content = $4, language = $5, started = true, updated_at = NOW()
       RETURNING *`,
      [sessionId, challengeId, contentType, content, language]
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
