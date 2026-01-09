import { v4 as uuidv4 } from 'uuid'
import { query } from '../../config/database'
import { Execution, ExecutionLog } from '../auth/auth.types'
import axios from 'axios'
import config from '../../config/env'

type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'error'

export class ExecutionService {
  async submitExecution(
    sessionId: string,
    challengeId: string,
    language: string,
    code: string,
    userId: string,
    input?: string // novo parâmetro opcional
  ): Promise<Execution> {
    const id = uuidv4()

    // Check if session exists, if not create it
    const sessionCheckResult = await query('SELECT id FROM sessions WHERE id = $1', [sessionId])
    if (sessionCheckResult.rows.length === 0) {
      // Create a new session for this user
      await query(
        `INSERT INTO sessions (id, interviewer_id, interviewee_id, current_challenge_id, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [sessionId, userId, userId, challengeId, 'pending'],
      )
    }

    // Se input não vier, busca o primeiro input_example do challenge
    let inputToSend: string | undefined = input
    if (inputToSend === undefined || inputToSend === null || inputToSend === '') {
      const evalRes = await query('SELECT input_example FROM challenges_evaluations WHERE challenge_id = $1 LIMIT 1', [challengeId])
      if (evalRes.rows.length > 0) {
        inputToSend = evalRes.rows[0].input_example
      }
    }

    // Create execution record
    const result = await query(
      `INSERT INTO executions (id, session_id, language, code, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, sessionId, language, code, 'pending'],
    )

    const execution = result.rows[0]

    // Monta payload para runner
    const payload: any = {
      executionId: execution.id,
      language,
      code,
      timeout: 30000, // 30 seconds
    }
    if (inputToSend !== undefined && inputToSend !== null && inputToSend !== '') {
      payload.input = inputToSend
    }

    // Send to runner
    try {
      await axios.post(`${config.runner.url}/execute`, payload)
    } catch (error) {
      // Update status to failed
      await query('UPDATE executions SET status = $1 WHERE id = $2', ['failed', id])
      throw error
    }

    return execution
  }

  async getExecutionById(id: string): Promise<Execution> {
    const result = await query('SELECT * FROM executions WHERE id = $1', [id])
    if (result.rows.length === 0) {
      throw new Error('Execution not found')
    }
    return result.rows[0]
  }

  async getExecutionsBySession(sessionId: string): Promise<Execution[]> {
    const result = await query('SELECT * FROM executions WHERE session_id = $1 ORDER BY created_at DESC', [
      sessionId,
    ])
    return result.rows
  }

  async updateExecutionStatus(
    id: string,
    status: ExecutionStatus,
    stdout?: string,
    stderr?: string,
    _exitCode?: number,
    executionTime?: number,
  ): Promise<Execution> {
    console.log(`[updateExecutionStatus] id=${id} status=${status} stdout=${stdout} stderr=${stderr} executionTime=${executionTime}`)
    const result = await query(
      `UPDATE executions SET status = $1, output = $2, error = $3, execution_time_ms = $4, updated_at = NOW()
       WHERE id = $5 RETURNING *`,
      [status, stdout, stderr, executionTime, id],
    )

    if (result.rows.length === 0) {
      console.error(`[updateExecutionStatus] Execution not found for id=${id}`)
      throw new Error('Execution not found')
    }

    return result.rows[0]
  }

  async addLog(executionId: string, message: string, level: 'info' | 'error' | 'warning'): Promise<ExecutionLog> {
    const id = uuidv4()
    const result = await query(
      `INSERT INTO logs (id, execution_id, message, level) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, executionId, message, level],
    )
    return result.rows[0]
  }

  async getExecutionLogs(executionId: string): Promise<ExecutionLog[]> {
    const result = await query('SELECT * FROM logs WHERE execution_id = $1 ORDER BY created_at ASC', [
      executionId,
    ])
    return result.rows
  }
}

export default new ExecutionService()
