import { execSync } from 'child_process'
import * as path from 'path'

export interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
}

export abstract class BaseExecutor {
  protected abstract getFileExtension(): string
  protected abstract getExecuteCommand(filePath: string): string

  async execute(code: string, tempDir: string, timeout: number, executionId?: string): Promise<ExecutionResult> {
    const filename = `code${this.getFileExtension()}`
    const filePath = path.join(tempDir, filename)

    // Write code to file
    const fs = await import('fs/promises')
    await fs.writeFile(filePath, code)

    // Execute
    return this.executeFile(filePath, tempDir, timeout, executionId)
  }

  protected async executeFile(filePath: string, tempDir: string, timeout: number, _executionId?: string): Promise<ExecutionResult> {
    const command = this.getExecuteCommand(filePath)

    try {
      const stdout = execSync(command, {
        cwd: tempDir,
        timeout,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      return {
        stdout,
        stderr: '',
        exitCode: 0,
      }
    } catch (error: any) {
      return {
        stdout: error.stdout ? error.stdout.toString() : '',
        stderr: error.stderr ? error.stderr.toString() : error.message,
        exitCode: error.status || 1,
      }
    }
  }
}
