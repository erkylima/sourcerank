import { BaseExecutor, ExecutionResult } from './base.executor'
import * as path from 'path'
import { spawn } from 'child_process'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://api:4000'

export class NodeExecutor extends BaseExecutor {
  protected getFileExtension(): string {
    return '.js'
  }

  protected getExecuteCommand(filePath: string): string {
    return `node "${filePath}"`
  }

  async execute(code: string, tempDir: string, timeout: number, executionId?: string, isTypeScript: boolean = false, input?: string): Promise<ExecutionResult> {
    const filename = isTypeScript ? `code.ts` : `code.js`
    const filePath = path.join(tempDir, filename)

    // Write code to file
    const fsp = await import('fs/promises')
    await fsp.writeFile(filePath, code)

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false

      // For TypeScript, use tsx which is more reliable than ts-node
      let command: string
      let args: string[]
      
      if (isTypeScript) {
        command = 'npx'
        args = ['tsx', filePath]
      } else {
        command = 'node'
        args = [filePath]
      }

      const child = spawn(command, args, {
        cwd: tempDir,
        shell: true,
        env: {
          ...process.env,
          NODE_ENV: 'production',
          NODE_NO_WARNINGS: '1',
        },
      })

      // Se houver input, escreve no stdin
      if (input) {
        child.stdin.write(input)
        child.stdin.end()
      }

      const timeoutId = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        setTimeout(() => child.kill('SIGKILL'), 1000)
      }, timeout)

      child.stdout.on('data', async (data) => {
        const output = data.toString()
        stdout += output
        
        if (executionId) {
          try {
            await axios.post(`${API_URL}/executions/${executionId}/logs`, {
              message: output,
              level: 'info',
            }, { timeout: 1000 })
          } catch (err: any) {
            // Ignore errors
          }
        }
      })

      child.stderr.on('data', async (data) => {
        const output = data.toString()
        stderr += output
        
        if (executionId) {
          try {
            await axios.post(`${API_URL}/executions/${executionId}/logs`, {
              message: output,
              level: 'error',
            }, { timeout: 1000 })
          } catch (err: any) {
            // Ignore errors
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
