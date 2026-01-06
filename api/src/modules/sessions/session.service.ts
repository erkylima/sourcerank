import { v4 as uuidv4 } from 'uuid'
import { query } from '../../config/database'
import { Session } from '../auth/auth.types'

type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export class SessionService {
  async getUserById(userId: string): Promise<any> {
    const result = await query('SELECT id, email, name, role FROM users WHERE id = $1', [userId])
    if (result.rows.length === 0) {
      throw new Error('User not found')
    }
    return result.rows[0]
  }

  async createSession(
    interviewerId: string,
    intervieweeId: string,
    currentChallengeId: string,
  ): Promise<Session> {
    // Validate interviewer exists
    const interviewerExists = await query('SELECT id FROM users WHERE id = $1', [interviewerId])
    if (interviewerExists.rows.length === 0) {
      throw new Error('Interviewer not found')
    }

    // Validate interviewee exists if provided
    if (intervieweeId) {
      const intervieweeExists = await query('SELECT id FROM users WHERE id = $1', [intervieweeId])
      if (intervieweeExists.rows.length === 0) {
        throw new Error('Interviewee not found')
      }
    }

    // Validate challenge exists
    const challengeExists = await query('SELECT id FROM challenges WHERE id = $1', [currentChallengeId])
    if (challengeExists.rows.length === 0) {
      throw new Error('Challenge not found')
    }

    const id = uuidv4()
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    const sessionCode = id.substring(0, 8).toUpperCase()

    try {
      const result = await query(
        `INSERT INTO sessions (id, interviewer_id, interviewee_id, current_challenge_id, status, expires_at, session_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [id, interviewerId, intervieweeId || null, currentChallengeId, 'pending', expiresAt, sessionCode],
      )
      return result.rows[0]
    } catch (error: any) {
      if (error.code === '23503') {
        throw new Error('Foreign key constraint failed - ensure all referenced users and challenges exist')
      }
      throw error
    }
  }

  async getSessionById(id: string): Promise<Session> {
    const result = await query('SELECT * FROM sessions WHERE id = $1', [id])
    if (result.rows.length === 0) {
      throw new Error('Session not found')
    }
    return result.rows[0]
  }

  async getSessionsByUser(userId: string): Promise<Session[]> {
    const result = await query(
      `SELECT * FROM sessions WHERE interviewer_id = $1 OR interviewee_id = $1
       ORDER BY created_at DESC`,
      [userId],
    )
    return result.rows
  }

  async updateSessionStatus(id: string, status: SessionStatus): Promise<Session> {
    const result = await query('UPDATE sessions SET status = $1 WHERE id = $2 RETURNING *', [status, id])
    if (result.rows.length === 0) {
      throw new Error('Session not found')
    }
    return result.rows[0]
  }

  async updateCurrentChallenge(id: string, challengeId: string): Promise<Session> {
    const result = await query(
      'UPDATE sessions SET current_challenge_id = $1 WHERE id = $2 RETURNING *',
      [challengeId, id],
    )
    if (result.rows.length === 0) {
      throw new Error('Session not found')
    }
    return result.rows[0]
  }

  async createSessionForInterviewer(interviewerId: string): Promise<Session> {
    // Validate interviewer exists
    const interviewerExists = await query('SELECT id FROM users WHERE id = $1', [interviewerId])
    if (interviewerExists.rows.length === 0) {
      throw new Error('Interviewer not found')
    }

    const id = uuidv4()
    // Usar os primeiros 8 caracteres do UUID como session_code
    const sessionCode = id.substring(0, 8).toUpperCase()
    
    // Expirar em 30 minutos
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
    
    try {
      const result = await query(
        `INSERT INTO sessions (id, interviewer_id, interviewee_id, status, expires_at, session_code)
         VALUES ($1, $2, NULL, $3, $4, $5) RETURNING *`,
        [id, interviewerId, 'pending', expiresAt, sessionCode],
      )
      return result.rows[0]
    } catch (error: any) {
      if (error.code === '23503') {
        throw new Error('Foreign key constraint failed - interviewer not found')
      }
      throw error
    }
  }

  async requestIntervieweeAccess(sessionCode: string, intervieweeId: string): Promise<Session> {
    // Validate interviewee exists
    const intervieweeExists = await query('SELECT id FROM users WHERE id = $1', [intervieweeId])
    if (intervieweeExists.rows.length === 0) {
      throw new Error('Interviewee not found')
    }

    // Buscar session pelo código (que é na verdade os primeiros 8 chars do ID)
    const idPrefix = sessionCode.toLowerCase()
    
    try {
      const result = await query(
        `UPDATE sessions 
         SET interviewee_id = $1, interviewee_requested_at = NOW()
         WHERE id::text ILIKE $2
         RETURNING *`,
        [intervieweeId, `${idPrefix}%`],
      )
      if (result.rows.length === 0) {
        throw new Error('Session not found or already has an interviewee')
      }
      return result.rows[0]
    } catch (error: any) {
      if (error.code === '23503') {
        throw new Error('Foreign key constraint failed - interviewee not found in system')
      }
      throw error
    }
  }

  async acceptInterviewee(sessionId: string, interviewerId: string): Promise<Session> {
    // Verify that the interviewer owns this session
    const sessionResult = await query('SELECT * FROM sessions WHERE id = $1', [sessionId])
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found')
    }
    const session = sessionResult.rows[0]
    if (session.interviewer_id !== interviewerId) {
      throw new Error('Unauthorized - only the interviewer who created this session can accept')
    }

    const result = await query(
      `UPDATE sessions 
       SET interviewee_accepted = true, status = 'active', started_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sessionId],
    )
    return result.rows[0]
  }

  async rejectInterviewee(sessionId: string, interviewerId: string): Promise<Session> {
    // Verify that the interviewer owns this session
    const sessionResult = await query('SELECT * FROM sessions WHERE id = $1', [sessionId])
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found')
    }
    const session = sessionResult.rows[0]
    if (session.interviewer_id !== interviewerId) {
      throw new Error('Unauthorized - only the interviewer who created this session can reject')
    }

    const result = await query(
      `UPDATE sessions 
       SET interviewee_accepted = false, status = 'pending', updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sessionId],
    )
    return result.rows[0]
  }

  async cleanupExpiredSessions(): Promise<number> {
    // Only cleanup pending sessions that have expired their time limit
    // Active sessions never expire
    const result = await query(
      `UPDATE sessions 
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW() AND status != 'expired'
       RETURNING id`,
    )
    return result.rows.length
  }

  async endSession(sessionId: string, userId: string): Promise<Session> {
    // Verify that user is part of this session
    const sessionResult = await query('SELECT * FROM sessions WHERE id = $1', [sessionId])
    if (sessionResult.rows.length === 0) {
      throw new Error('Session not found')
    }
    const session = sessionResult.rows[0]
    if (session.interviewer_id !== userId && session.interviewee_id !== userId) {
      throw new Error('Unauthorized')
    }

    const result = await query(
      `UPDATE sessions 
       SET status = 'completed', ended_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [sessionId],
    )
    return result.rows[0]
  }
}

export default new SessionService()
