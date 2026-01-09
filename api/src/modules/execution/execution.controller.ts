import { Request, Response } from 'express'
import executionService from './execution.service'

export class ExecutionController {
  async submit(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, challengeId, language, code, input } = req.body
      const userId = (req as any).userId || 'anonymous' // From auth middleware, fallback to anonymous

      if (!sessionId || !challengeId || !language || !code) {
        res.status(400).json({ error: 'Missing required fields' })
        return
      }

      const supportedLanguages = ['python', 'javascript', 'typescript', 'java', 'go', 'csharp']
      if (!supportedLanguages.includes(language)) {
        res.status(400).json({ error: 'Unsupported language' })
        return
      }

      const execution = await executionService.submitExecution(
        sessionId,
        challengeId,
        language,
        code,
        userId,
        input // novo parâmetro opcional
      )

      // Broadcast execution started event to session room
      const gateway = (req.app as any).locals?.executionGateway
      if (gateway && sessionId) {
        console.log(`[submit] Broadcasting execution started to session ${sessionId}`)
        gateway.getIO?.()?.to(`session:${sessionId}`).emit(`session-execution-started-${sessionId}`, {
          executionId: execution.id,
          language,
          code,
        })
      }

      res.status(202).json({ execution })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params
      const execution = await executionService.getExecutionById(id)
      res.json({ execution })
    } catch (error: any) {
      res.status(404).json({ error: error.message })
    }
  }

  async getSessionExecutions(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params
      const executions = await executionService.getExecutionsBySession(sessionId)
      res.json({ executions })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  async getLogs(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params
      const logs = await executionService.getExecutionLogs(executionId)
      res.json({ logs })
    } catch (error: any) {
      res.status(500).json({ error: error.message })
    }
  }

  // Called by Runner service to report execution results
  async reportResult(req: Request, res: Response): Promise<void> {
    try {
      const { executionId, status, stdout, stderr, exitCode, executionTime } = req.body

      if (!executionId || !status) {
        res.status(400).json({ error: 'Missing executionId or status' })
        return
      }

      console.log(`[reportResult] Processing execution ${executionId}`)

      const execution = await executionService.updateExecutionStatus(
        executionId,
        status,
        stdout,
        stderr,
        exitCode,
        executionTime,
      )

      // Broadcast completion message AFTER all logs have been sent
      const gateway = (req.app as any).locals?.executionGateway
      
      if (gateway) {
        // Send completion summary log
        const completionMessage = `Execution completed in ${executionTime}ms`
        console.log(`[reportResult] Broadcasting completion: ${completionMessage}`)
        await gateway.broadcastLog(executionId, completionMessage, 'info')
        
        // Emit completion event with execution-specific channel
        console.log(`[reportResult] Emitting completion event for ${executionId}`)
        gateway.getIO?.()?.to(`execution:${executionId}`).emit(`execution-completed-${executionId}`, {
          executionId,
          status,
          exitCode,
        })

        // Also broadcast to session room for synchronization
        const sessionId = execution.session_id
        if (sessionId) {
          console.log(`[reportResult] Emitting completion event to session ${sessionId}`)
          gateway.getIO?.()?.to(`session:${sessionId}`).emit(`session-execution-completed-${sessionId}`, {
            executionId,
            status,
            exitCode,
          })
        }
      }

      res.json({ execution })
    } catch (error: any) {
      console.error(`[reportResult] Error:`, error.message, error.stack)
      res.status(400).json({ error: error.message })
    }
  }

  // Called by Runner service to add logs
  async addLog(req: Request, res: Response): Promise<void> {
    try {
      const { executionId } = req.params
      const { message, level } = req.body

      if (!message || !level) {
        res.status(400).json({ error: 'Missing message or level' })
        return
      }

      const log = await executionService.addLog(executionId, message, level)

      // Broadcast log via WebSocket
      const gateway = (req.app as any).locals?.executionGateway
      if (gateway) {
        await gateway.broadcastLog(executionId, message, level)
      }

      res.status(201).json({ log })
    } catch (error: any) {
      res.status(400).json({ error: error.message })
    }
  }
}

export default new ExecutionController()
