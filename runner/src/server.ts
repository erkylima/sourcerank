import express, { Request, Response } from 'express'
import axios from 'axios'
import * as fs from 'fs'
import * as path from 'path'
import { PythonExecutor } from './executors/python.executor'
import { JavaExecutor } from './executors/java.executor'
import { GoExecutor } from './executors/go.executor'
import { NodeExecutor } from './executors/node.executor'
import { CSharpExecutor } from './executors/csharp.executor'

const app = express()
const PORT = process.env.PORT || 3001
const API_URL = process.env.API_URL || 'http://localhost:4000'

// Middleware
app.use(express.json({ limit: '10mb' }))

// Executors registry
const executors = {
  python: new PythonExecutor(),
  javascript: new NodeExecutor(),
  typescript: new NodeExecutor(),
  java: new JavaExecutor(),
  go: new GoExecutor(),
  csharp: new CSharpExecutor(),
}

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
})

// Execute endpoint
app.post('/execute', async (req: Request, res: Response): Promise<void> => {
  const { executionId, language, code, timeout = 30000 } = req.body

  if (!executionId || !language || !code) {
    res.status(400).json({ error: 'Missing required fields: executionId, language, code' })
    return
  }

  if (!executors[language as keyof typeof executors]) {
    res.status(400).json({ error: `Unsupported language: ${language}` })
    return
  }

  // Execute asynchronously (no initial log)
  executeCode(executionId, language, code, timeout).catch((error) => {
    console.error(`Execution failed for ${executionId}:`, error)
  })

  // Return accepted
  res.status(202).json({
    executionId,
    status: 'accepted',
    message: 'Code execution started',
  })
})

// Main execution function
async function executeCode(executionId: string, language: string, code: string, timeout: number) {
  const executor = executors[language as keyof typeof executors]
  const tempDir = path.join('/tmp/executions', executionId)

  try {
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    // Execute (pass executionId for real-time logging)
    const startTime = Date.now()
    let result
    
    // Special handling for TypeScript - pass isTypeScript flag to NodeExecutor
    if (language === 'typescript' && executor instanceof NodeExecutor) {
      result = await executor.execute(code, tempDir, timeout, executionId, true)
    } else {
      result = await executor.execute(code, tempDir, timeout, executionId)
    }
    
    const executionTime = Date.now() - startTime

    // Report result to API
    await reportResult(executionId, 'completed', result.stdout, result.stderr, result.exitCode, executionTime)
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    console.error(`Execution error for ${executionId}:`, errorMessage)

    await reportResult(executionId, 'failed', '', errorMessage, 1)
  } finally {
    // Cleanup temp directory
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch (error) {
      console.error(`Failed to cleanup ${tempDir}:`, error)
    }
  }
}



// Report result to API
async function reportResult(
  executionId: string,
  status: string,
  stdout: string,
  stderr: string,
  exitCode: number,
  executionTime?: number,
) {
  try {
    const payload = {
      executionId,
      status,
      stdout,
      stderr,
      exitCode,
      executionTime,
    }

    console.log(`Reporting result for ${executionId}:`, payload)

    await axios.post(`${API_URL}/executions/${executionId}/report`, payload, {
      timeout: 5000,
    })
  } catch (error: any) {
    console.error(`Failed to report result for ${executionId}:`, error.message)
  }
}

// Start server
const server = app.listen(parseInt(PORT as string), '0.0.0.0', () => {
  console.log(`\n╔════════════════════════════════════════╗`)
  console.log(`║   Code Execution Runner Started        ║`)
  console.log(`╚════════════════════════════════════════╝\n`)
  console.log(`Server running on http://0.0.0.0:${PORT}`)
  console.log(`API endpoint: ${API_URL}`)
  console.log(`\nSupported languages:`)
  console.log(`  - Python 3.12`)
  console.log(`  - JavaScript (Node.js 20)`)
  console.log(`  - TypeScript (ts-node)`)
  console.log(`  - Java 21`)
  console.log(`  - Go 1.25.5`)
  console.log(`  - C# (Mono)`)
  console.log(`\n`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\nSIGTERM received, shutting down...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down...')
  server.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default app
