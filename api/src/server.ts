import http from 'http'
import config from './config/env'
import { initializeDatabase } from './config/database'
import { createApp } from './app'
import { ExecutionGateway } from './websocket/execution.gateway'
import { YjsProxyGateway } from './websocket/yjs-proxy.gateway'
import sessionService from './modules/sessions/session.service'
import pollingService from './modules/crdt/polling.service'

async function startServer() {
  try {
    // Initialize database
    console.log('Initializing database...')
    await initializeDatabase()
    console.log('Database initialized successfully')

    // Create Express app
    const app = createApp()

    // Create HTTP server
    const server = http.createServer(app)

    // Initialize Yjs proxy gateway FIRST (separate WebSocket for CRDT)
    new YjsProxyGateway(server, 'ws://yjs-relay:1234')
    console.log('Yjs proxy gateway initialized')

    // Initialize WebSocket gateway (Socket.IO for executions)
    const executionGateway = new ExecutionGateway(server)
    console.log('WebSocket gateway initialized')

    // Store gateway in app for use in routes
    app.locals.executionGateway = executionGateway

    // Start polling service (syncs relay snapshots to database every 5 seconds)
    pollingService.startPolling()
    console.log('Polling service started')

    // Setup cleanup interval for expired sessions (every 5 minutes)
    setInterval(async () => {
      try {
        const cleaned = await sessionService.cleanupExpiredSessions()
        if (cleaned > 0) {
          console.log(`[Session Cleanup] Marked ${cleaned} sessions as expired`)
        }
      } catch (error: any) {
        console.error('[Session Cleanup Error]', error.message)
      }
    }, 5 * 60 * 1000) // 5 minutes

    // Start server
    server.listen(config.port, '0.0.0.0', () => {
      console.log(`\n╔════════════════════════════════════════╗`)
      console.log(`║   Interview Platform API Started       ║`)
      console.log(`╚════════════════════════════════════════╝`)
      console.log(`\nServer running on http://0.0.0.0:${config.port}`)
      console.log(`WebSocket available for connections`)
      console.log(`Database: ${config.database.url}`)
      console.log(`\nEndpoints:`)
      console.log(`  POST   /auth/register`)
      console.log(`  POST   /auth/login`)
      console.log(`  GET    /auth/me`)
      console.log(`  GET    /challenges`)
      console.log(`  POST   /challenges (interviewer only)`)
      console.log(`  GET    /sessions`)
      console.log(`  POST   /sessions (interviewer only)`)
      console.log(`  POST   /executions (submit code)`)
      console.log(`  WS     (WebSocket for real-time logs)`)
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
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
