import { BaseExecutor, ExecutionResult } from './base.executor'
import * as path from 'path'
import { spawn } from 'child_process'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://api:4000'

export class PythonExecutor extends BaseExecutor {
  protected getFileExtension(): string {
    return '.py'
  }

  protected getExecuteCommand(filePath: string): string {
    return `python3 -u "${filePath}"`
  }

  async execute(code: string, tempDir: string, timeout: number, executionId?: string, input?: string): Promise<ExecutionResult> {
    const filename = `code.py`
    const filePath = path.join(tempDir, filename)

    // Write code to file
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, code)

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false

      const child = spawn('python3', ['-u', filePath], {
        cwd: tempDir,
        timeout,
      })

      // Se houver input, escreve no stdin
      if (input && input.trim() !== '') {
        child.stdin.write(input)
        child.stdin.end()
      } else {
        // Se input for vazio, envie 'null' para evitar travamento
        child.stdin.write('null')
        child.stdin.end()
      }

      const timeoutId = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        setTimeout(() => child.kill('SIGKILL'), 1000)
      }, timeout)

      // Send stdout in real-time via WebSocket
      child.stdout.on('data', async (data) => {
        const output = data.toString()
        stdout += output
        
        // Send log to API immediately
        if (executionId) {
          console.log(`[PythonExecutor] Sending real-time log for ${executionId}: ${output.trim()}`)
          try {
            await axios.post(`${API_URL}/executions/${executionId}/logs`, {
              message: output,
              level: 'info',
            }, { timeout: 1000 })
            console.log(`[PythonExecutor] Log sent successfully`)
          } catch (err: any) {
            console.error(`[PythonExecutor] Failed to send log:`, err.message)
          }
        }
      })

      child.stderr.on('data', async (data) => {
        const output = data.toString()
        stderr += output
        
        // Send stderr to API immediately
        if (executionId) {
          console.log(`[PythonExecutor] Sending real-time stderr for ${executionId}: ${output.trim()}`)
          try {
            await axios.post(`${API_URL}/executions/${executionId}/logs`, {
              message: output,
              level: 'error',
            }, { timeout: 1000 })
            console.log(`[PythonExecutor] Stderr sent successfully`)
          } catch (err: any) {
            console.error(`[PythonExecutor] Failed to send stderr:`, err.message)
          }
        }
      })

      child.on('close', (code) => {
        clearTimeout(timeoutId)
        
        if (timedOut) {
          resolve({
            stdout,
            stderr: stderr + '\nExecution timed out',
            exitCode: 124,
          })
        } else {
          resolve({
            stdout,
            stderr,
            exitCode: code || 0,
          })
        }
      })

      child.on('error', (error) => {
        clearTimeout(timeoutId)
        resolve({
          stdout,
          stderr: error.message,
          exitCode: 1,
        })
      })
    })
  }
}
