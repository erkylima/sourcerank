import { BaseExecutor, ExecutionResult } from './base.executor'
import * as path from 'path'
import { spawn, execSync } from 'child_process'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://api:4000'

export class JavaExecutor extends BaseExecutor {
  protected getFileExtension(): string {
    return '.java'
  }

  protected getExecuteCommand(filePath: string): string {
    return `javac "${filePath}" && java -cp . Code`
  }

  async execute(code: string, tempDir: string, timeout: number, executionId?: string, input?: string): Promise<ExecutionResult> {
    const filename = `Solution.java`
    const filePath = path.join(tempDir, filename)

    // Check code characteristics
    let javaCode = code
    const hasClass = /\b(public\s+)?class\s+\w+/.test(code)
    const hasMainMethod = /\b(public\s+)?(static\s+)?void\s+main\s*\(\s*String\s*\[\s*\]\s*args\s*\)/.test(code)
    
    // If code has a class but different name, rename it to Solution to ensure it runs
    if (hasClass && !code.includes('class Solution')) {
      const classNameMatch = code.match(/\b(public\s+)?class\s+(\w+)/)
      if (classNameMatch) {
        const originalName = classNameMatch[2]
        javaCode = code.replace(new RegExp(`\\b${originalName}\\b`, 'g'), 'Solution')
      }
    }
    
    // If no class, wrap everything
    if (!hasClass) {
      if (!hasMainMethod) {
        // No class, no main - wrap completely
        javaCode = `public class Solution {
  public static void main(String[] args) {
${code.split('\n').map(line => `    ${line}`).join('\n')}
  }
}`
      } else {
        // No class but has main - wrap in class
        javaCode = `public class Solution {
${code}
}`
      }
    }
    // If has class but no main, add main method
    else if (!hasMainMethod) {
      const lastBraceIndex = javaCode.lastIndexOf('}')
      const mainMethod = `\n  public static void main(String[] args) {\n  }\n`
      javaCode = javaCode.slice(0, lastBraceIndex) + mainMethod + javaCode.slice(lastBraceIndex)
    }

    // Write code to file
    const fsp = await import('fs/promises')
    await fsp.writeFile(filePath, javaCode)

    try {
      // Compile (synchronous - no output streaming needed)
      execSync(`javac "${filePath}"`, {
        cwd: tempDir,
        timeout: timeout / 2,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.stderr ? error.stderr.toString() : error.message,
        exitCode: error.status || 1,
      }
    }

    // Execute with spawn for real-time streaming
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timedOut = false

      const child = spawn('java', ['-cp', tempDir, 'Solution'], {
        cwd: tempDir,
        shell: true,
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
      }, timeout / 2)

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
