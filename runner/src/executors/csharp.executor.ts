import { BaseExecutor, ExecutionResult } from './base.executor'
import * as path from 'path'
import { spawn, execSync } from 'child_process'
import axios from 'axios'

const API_URL = process.env.API_URL || 'http://api:4000'

export class CSharpExecutor extends BaseExecutor {
  protected getFileExtension(): string {
    return '.cs'
  }

  protected getExecuteCommand(filePath: string): string {
    return `mcs "${filePath}" && mono code.exe`
  }

  async execute(code: string, tempDir: string, timeout: number, executionId?: string, input?: string): Promise<ExecutionResult> {
    const filename = `code.cs`
    const filePath = path.join(tempDir, filename)
    const exePath = path.join(tempDir, `code.exe`)

    // Build complete C# code with proper structure
    let csharpCode = code
    
    // Check code characteristics
    const hasClass = /\b(public\s+)?class\s+\w+/.test(code)
    const hasMainMethod = /\b(public\s+)?(static\s+)?(async\s+)?(void|Task|Task<\w+>)\s+Main\s*\(/.test(code)
    const hasAwait = code.includes('await ')
    const hasAsync = code.includes('async ')
    
    // Add System.Threading.Tasks if needed
    if ((hasAwait || code.includes('Task.')) && !code.includes('using System.Threading')) {
      if (code.includes('using System')) {
        csharpCode = code.replace('using System;', 'using System;\nusing System.Threading.Tasks;')
      } else if (code.includes('using ')) {
        csharpCode = code.replace(/using [^;]+;/, (match) => `${match}\nusing System.Threading.Tasks;`)
      } else {
        csharpCode = `using System;\nusing System.Threading.Tasks;\n${code}`
      }
    }
    
    // Add basic using System if missing and needed
    if (!csharpCode.includes('using System') && (code.includes('Console') || code.includes('System.'))) {
      if (code.includes('using ')) {
        // Already has usings, insert after them
        const usingIndex = code.lastIndexOf('using ')
        const endOfLine = code.indexOf('\n', usingIndex)
        const insertPoint = endOfLine + 1
        csharpCode = code.slice(0, insertPoint) + `using System;\n` + code.slice(insertPoint)
      } else {
        csharpCode = `using System;\n${csharpCode}`
      }
    }
    
    // If no class and no main method, wrap everything
    if (!hasClass && !hasMainMethod) {
      // Determine if we need async
      const needsAsync = hasAwait || hasAsync
      const mainSignature = needsAsync ? 'public static async Task Main()' : 'public static void Main()'
      
      csharpCode = `${csharpCode.includes('using') ? csharpCode : `using System;\n${csharpCode}`}

public class Solution {
  ${mainSignature} {
${code.split('\n').map(line => `    ${line}`).join('\n')}
  }
}`
    } 
    // If has class but no main method, add Main
    else if (hasClass && !hasMainMethod) {
      const needsAsync = hasAwait || hasAsync
      const mainSignature = needsAsync ? 'public static async Task Main()' : 'public static void Main()'
      const mainMethod = `\n  ${mainSignature} {\n  }\n`
      
      // Find the last closing brace and insert Main before it
      const lastBraceIndex = csharpCode.lastIndexOf('}')
      csharpCode = csharpCode.slice(0, lastBraceIndex) + mainMethod + csharpCode.slice(lastBraceIndex)
    }
    // If has main method but it's not async and has await, convert to async
    else if (hasMainMethod && hasAwait && !hasAsync) {
      csharpCode = csharpCode
        .replace(/\bvoid\s+Main\s*\(/g, 'async Task Main(')
        .replace(/\bpublic\s+static\s+void\s+Main\s*\(/g, 'public static async Task Main(')
        .replace(/\bstatic\s+void\s+Main\s*\(/g, 'static async Task Main(')
    }

    // Write code to file
    const fsp = await import('fs/promises')
    await fsp.writeFile(filePath, csharpCode)

    try {
      // Compile (synchronous - no output streaming needed)
      execSync(`mcs -out:${exePath} "${filePath}"`, {
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

      const child = spawn('mono', [exePath], {
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
