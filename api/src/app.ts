import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import authRoutes from './modules/auth/auth.routes'
import challengeRoutes from './modules/challenges/challenge.routes'
import sessionRoutes from './modules/sessions/session.routes'
import executionRoutes from './modules/execution/execution.routes'
import crdtRoutes from './modules/crdt/crdt.routes'
import relayRoutes from './modules/crdt/relay.routes'
import sessionContentRoutes from './modules/session-content/session-content.routes'
import contentPersistRoutes from './modules/session-content/content-persist.routes'
import { AppError } from './utils/errors'

export function createApp(): Express {
  const app = express()

  // Middleware
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ limit: '10mb', extended: true }))

  // Routes
  app.use('/auth', authRoutes)
  app.use('/challenges', challengeRoutes)
  app.use('/sessions', sessionRoutes)
  app.use('/executions', executionRoutes)
  app.use('/crdt', crdtRoutes)
  app.use('/relay', relayRoutes)
  app.use('/session-content', sessionContentRoutes)
  app.use('/content', contentPersistRoutes)

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Route not found' })
  })

  // Error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Error:', err)

    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message })
    } else {
      res.status(500).json({ error: 'Internal server error' })
    }
  })

  return app
}
