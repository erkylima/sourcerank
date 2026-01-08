import { query } from '../../config/database'
import contentHistoryService from './content-history.service'
import relayController from '../crdt/relay.controller'

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
   * Returns starter if:
   * 1. Challenge never started (started=false), OR
   * 2. Challenge started but no content for this language (means language just switched)
   * Falls back to history if current content not found
   */
  async getChallengeContent(sessionId: string, challengeId: number, contentType: string = 'code', language: string = 'python') {
    console.log('[SessionContentService] Getting content for:', { sessionId, challengeId, contentType, language })
    
    const result = await query(
      `SELECT * FROM session_challenge_content 
       WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 AND language = $4`,
      [sessionId, challengeId, contentType, language]
    )

    // Check if record exists in current content
    if (result.rows.length === 0) {
      console.log('[SessionContentService] ℹ️ No content found for language in main table, checking history:', language)
      
      // Try to find in history (for languages that were switched away)
      const historyResult = await query(
        `SELECT * FROM session_challenge_content_history 
         WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 AND language = $4
         ORDER BY updated_at DESC LIMIT 1`,
        [sessionId, challengeId, contentType, language]
      )

      if (historyResult.rows.length > 0) {
        const historyRow = historyResult.rows[0]
        console.log('[SessionContentService] ✅ Found in history:', { contentLength: historyRow.content.length, language })
        return {
          sessionId: historyRow.session_id,
          challengeId: historyRow.challenge_id,
          contentType: historyRow.content_type,
          content: historyRow.content,
          language: historyRow.language,
          started: true,
          isStarter: false,
          updatedAt: historyRow.updated_at,
          fromHistory: true
        }
      }

      // Not in history either - return starter
      console.log('[SessionContentService] ℹ️ Not in history either, returning starter:', language)
      const starter = await this.getStarterCode(challengeId, language)
      return { 
        sessionId, 
        challengeId, 
        contentType, 
        content: starter,
        language, 
        started: false,
        isStarter: true
      }
    }

    const row = result.rows[0]
    
    // Case 3: If challenge started but content empty (just switched language), return starter
    if (row.started && (!row.content || row.content.trim() === '')) {
      console.log('[SessionContentService] ℹ️ Challenge started but no content for language, returning starter:', { language })
      const starter = await this.getStarterCode(challengeId, language)
      return {
        id: row.id,
        sessionId: row.session_id,
        challengeId: row.challenge_id,
        contentType: row.content_type,
        content: starter,
        language: row.language,
        started: row.started,
        isStarter: true,
        updatedAt: row.updated_at
      }
    }

    // Case 4: Challenge has content, return it
    console.log('[SessionContentService] ✅ Content loaded:', { id: row.id, contentLength: row.content.length, language: row.language, started: row.started })
    return {
      id: row.id,
      sessionId: row.session_id,
      challengeId: row.challenge_id,
      contentType: row.content_type,
      content: row.content,
      language: row.language,
      started: row.started || false,
      isStarter: false,
      updatedAt: row.updated_at
    }
  }

  /**
   * Get starter code for a challenge and language from database
   */
  private async getStarterCode(challengeId: number, language: string): Promise<string> {
    try {
      const result = await query(
        `SELECT content FROM starter_codes 
         WHERE challenge_id = $1 AND language = $2`,
        [challengeId, language]
      )
      
      if (result.rows.length > 0) {
        console.log('[SessionContentService] ✅ Starter code found for:', { challengeId, language })
        return result.rows[0].content
      }
      
      console.log('[SessionContentService] ⚠️ No starter code found, returning empty:', { challengeId, language })
      return ''
    } catch (error) {
      console.error('[SessionContentService] Error fetching starter code:', error)
      return ''
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
       ON CONFLICT (session_id, challenge_id, content_type) 
       DO UPDATE SET content = $4, language = $5, started = $6, updated_at = NOW()
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

  /**
   * Get preferred language for entire session (from sessions table, not per-challenge)
   */
  async getSessionPreferredLanguage(sessionId: string): Promise<string> {
    console.log('[SessionContentService] Getting session preferred language:', { sessionId })
    
    const result = await query(
      'SELECT preferred_language FROM sessions WHERE id = $1',
      [sessionId]
    )

    const language = result.rows.length > 0 ? result.rows[0].preferred_language : 'python'
    console.log('[SessionContentService] ℹ️ Session preferred language:', language)
    return language
  }

  /**
   * Update preferred language for entire session
   */
  async updateSessionPreferredLanguage(sessionId: string, language: string): Promise<{ success: boolean; preferred_language: string }> {
    console.log('[SessionContentService] Updating session preferred language:', { sessionId, language })
    
    const result = await query(
      'UPDATE sessions SET preferred_language = $1 WHERE id = $2 RETURNING preferred_language',
      [language, sessionId]
    )

    if (result.rows.length === 0) {
      throw new Error('Session not found')
    }

    console.log('[SessionContentService] ✅ Session preferred language updated')
    return { 
      success: true, 
      preferred_language: result.rows[0].preferred_language 
    }
  }

  /**
   * Save content with optional history tracking
   * Used by /content/persist endpoint to handle:
   * - Language switches (with history of previous language)
   * - Challenge switches (save previous content)
   * - Reload/recovery (sync current content to DB)
   */
  async saveWithHistory(
    sessionId: string,
    challengeId: number,
    contentType: string,
    currentLanguage: string,
    currentContent: string,
    options?: {
      previousLanguage?: string
      previousContent?: string
      forceSnapshot?: boolean
      started?: boolean
    }
  ): Promise<{ success: boolean; saved: boolean }> {
    try {
      const {
        previousLanguage,
        previousContent,
        forceSnapshot = true,
        started = true
      } = options || {}

      console.log('[SessionContentService] saveWithHistory:', {
        sessionId,
        challengeId,
        currentLanguage,
        previousLanguage,
        hasPreviousContent: !!previousContent,
        forceSnapshot
      })

      // Step 1: Save history if applicable
      if (previousLanguage && previousLanguage !== currentLanguage && previousContent) {
        console.log('[SessionContentService] 📚 Saving previous language to history:', previousLanguage)
        await contentHistoryService.saveToHistory(
          sessionId,
          challengeId,
          contentType,
          previousLanguage,
          previousContent
        )
      }

      // Step 2: Save current content
      console.log('[SessionContentService] 💾 Saving current content:', currentLanguage)
      await this.saveChallengeContent(
        sessionId,
        challengeId,
        contentType,
        currentContent,
        currentLanguage,
        started
      )

      // Step 3: Force snapshot if requested
      if (forceSnapshot) {
        console.log('[SessionContentService] 📸 Forcing relay snapshot')
        try {
          const snapshotResult = await relayController.forceSnapshot(
            sessionId,
            challengeId,
            contentType,
            currentLanguage
          )

          if (!snapshotResult.success) {
            console.warn('[SessionContentService] ⚠️ Snapshot force failed, but content saved to DB:', snapshotResult.error)
          }
        } catch (err: any) {
          console.warn('[SessionContentService] ⚠️ Failed to force snapshot (content still saved in DB):', err.message)
        }
      }

      console.log('[SessionContentService] ✅ Content persisted successfully')
      return { success: true, saved: true }
    } catch (err: any) {
      console.error('[SessionContentService] ❌ Error in saveWithHistory:', err)
      return { success: false, saved: false }
    }
  }

  /**
   * Unified method to persist content and handle language/challenge switches
   * This method:
   * 1. Saves previous content to history if language/challenge changed
   * 2. Saves current content to session_challenge_content
   * 3. Forces relay to persist the snapshot
   * 4. Returns success
   */
  async persistAndSwitchContent(
    sessionId: string,
    challengeId: number,
    contentType: string,
    currentLanguage: string,
    currentContent: string,
    previousLanguage?: string,
    previousContent?: string
  ): Promise<{ success: boolean; saved: boolean; message?: string }> {
    try {
      console.log('[SessionContentService] Persisting and switching content:', {
        sessionId,
        challengeId,
        currentLanguage,
        previousLanguage,
        currentContentLength: currentContent.length,
        previousContentLength: previousContent?.length || 0
      })

      // Step 1: If previous language is different, save old content to history
      if (previousLanguage && previousLanguage !== currentLanguage && previousContent) {
        console.log('[SessionContentService] 📚 Saving previous language to history:', previousLanguage)
        await contentHistoryService.saveToHistory(
          sessionId,
          challengeId,
          contentType,
          previousLanguage,
          previousContent
        )
      }

      // Step 2: Save current content to session_challenge_content
      console.log('[SessionContentService] 💾 Saving current content:', currentLanguage)
      await this.saveChallengeContent(
        sessionId,
        challengeId,
        contentType,
        currentContent,
        currentLanguage,
        true // started = true
      )

      // Step 3: Force relay to persist the snapshot
      console.log('[SessionContentService] 📸 Forcing relay snapshot')
      try {
        const snapshotResult = await relayController.forceSnapshot(
          sessionId,
          challengeId,
          contentType,
          currentLanguage
        )

        if (!snapshotResult.success) {
          console.warn('[SessionContentService] ⚠️ Snapshot force failed, but content saved:', snapshotResult.error)
        }
      } catch (err: any) {
        console.warn('[SessionContentService] ⚠️ Failed to force snapshot (content still in DB):', err.message)
      }

      console.log('[SessionContentService] ✅ Content persisted and switched successfully')
      return {
        success: true,
        saved: true,
        message: `Content persisted for ${currentLanguage}`
      }
    } catch (err: any) {
      console.error('[SessionContentService] ❌ Error persisting and switching content:', err)
      return {
        success: false,
        saved: false,
        message: err.message
      }
    }
  }
}

export default new SessionContentService()
