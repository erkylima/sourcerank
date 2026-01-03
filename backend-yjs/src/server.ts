import express from 'express'
import http from 'http'
import WebSocket, { WebSocketServer } from 'ws'
import fs from 'fs'
import path from 'path'
import Y from 'yjs'
import cors from 'cors'
import bodyParser from 'body-parser'
import axios from 'axios'
import jwt from 'jsonwebtoken'

type ClientMeta = {
  userId: string
  role: string
  canWrite: boolean
}

// Map sessionId -> Map(ws -> meta)
const clientsMetaBySession: Map<string, Map<WebSocket, ClientMeta>> = new Map()

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })

type UpdateBase64 = string

// In-memory maps
const clientsBySession: Map<string, Set<WebSocket>> = new Map()
const updatesBySession: Map<string, UpdateBase64[]> = new Map()

function sessionFile(sessionId: string) {
  return path.join(DATA_DIR, `${sessionId}.updates`)
}

function loadSessionUpdates(sessionId: string) {
  if (updatesBySession.has(sessionId)) return updatesBySession.get(sessionId)!
  const file = sessionFile(sessionId)
  const arr: UpdateBase64[] = []
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8')
    if (content.length > 0) {
      for (const line of content.split('\n')) {
        if (line.trim().length > 0) arr.push(line.trim())
      }
    }
  }
  updatesBySession.set(sessionId, arr)
  return arr
}

function persistUpdate(sessionId: string, updateB64: UpdateBase64) {
  const file = sessionFile(sessionId)
  fs.appendFileSync(file, updateB64 + '\n')
}

// Broadcast a binary update to all other clients in the same session
function broadcastUpdate(sessionId: string, sender: WebSocket, data: Buffer) {
  const set = clientsBySession.get(sessionId)
  if (!set) return
  for (const ws of set) {
    if (ws !== sender && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data)
      } catch (e) {
        console.error('Failed to send update to client', e)
      }
    }
  }
}

async function start() {
  const app = express()
  app.use(cors())
  app.use(bodyParser.json({ limit: '5mb' }))

  const server = http.createServer(app)
  const wss = new WebSocketServer({ server, path: '/yjs' })

  wss.on('connection', (ws: WebSocket, req) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost')
      const sessionId = url.searchParams.get('sessionId')
      const token = url.searchParams.get('token')
      if (!sessionId) {
        ws.close(1008, 'Missing sessionId')
        return
      }

      // Authenticate via JWT token (query param `token`)
      const JWT_SECRET = process.env.JWT_SECRET
      if (!JWT_SECRET) {
        console.error('JWT_SECRET not configured; refusing connections')
        ws.close(1011, 'Server misconfiguration')
        return
      }

      if (!token) {
        ws.close(1008, 'Missing token')
        return
      }

      let payload: any
      try {
        payload = jwt.verify(token, JWT_SECRET)
      } catch (err) {
        ws.close(1008, 'Invalid token')
        return
      }

      const userId = payload.sub || payload.userId || payload.id || 'unknown'
      const role = payload.role || 'viewer'
      const canWrite = role === 'interviewer' || role === 'candidate'

      // register client
      const set = clientsBySession.get(sessionId) ?? new Set()
      set.add(ws)
      clientsBySession.set(sessionId, set)
      // register meta
      const metas = clientsMetaBySession.get(sessionId) ?? new Map()
      metas.set(ws, { userId, role, canWrite })
      clientsMetaBySession.set(sessionId, metas)

      // send initial state (all stored updates) to newly connected client
      const updates = loadSessionUpdates(sessionId)
      for (const b64 of updates) {
        const buf = Buffer.from(b64, 'base64')
        ws.send(buf)
      }

      ws.on('message', (message: WebSocket.RawData) => {
        // Expect binary Yjs updates from clients
        if (typeof message === 'string') {
          // Ignore text messages for now
          return
        }
        // authorization: check client meta
        const metas = clientsMetaBySession.get(sessionId)
        const meta = metas?.get(ws)
        if (!meta || !meta.canWrite) {
          // send text error
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ error: 'forbidden', reason: 'no-write-permission' })) } catch {}
          }
          return
        }
        const data = Buffer.from(message as Buffer)
        const b64 = data.toString('base64')

        // persist
        persistUpdate(sessionId, b64)
        // keep in-memory
        const arr = loadSessionUpdates(sessionId)
        arr.push(b64)

        // broadcast to other clients
        broadcastUpdate(sessionId, ws, data)
      })

      ws.on('close', () => {
        const set = clientsBySession.get(sessionId)
        if (set) {
          set.delete(ws)
          if (set.size === 0) {
            clientsBySession.delete(sessionId)
            // keep updates persisted on disk
          }
        }
        const metas = clientsMetaBySession.get(sessionId)
        if (metas) {
          metas.delete(ws)
          if (metas.size === 0) clientsMetaBySession.delete(sessionId)
        }
      })
    } catch (err) {
      console.error('WS connection error', err)
      try { ws.close(1011, 'Server error') } catch {}
    }
  })

  // HTTP: execute code materialized from CRDT updates
  app.post('/execute-from-session', async (req, res) => {
    const { sessionId, executionId, language } = req.body
    if (!sessionId || !executionId || !language) {
      res.status(400).json({ error: 'Missing required: sessionId, executionId, language' })
      return
    }

    const updates = loadSessionUpdates(sessionId)
    const ydoc = new Y.Doc()
    try {
      for (const b64 of updates) {
        const u = Buffer.from(b64, 'base64')
        Y.applyUpdate(ydoc, new Uint8Array(u))
      }
      const ytext = ydoc.getText('monaco')
      const code = ytext.toString()

      // call Runner API
      const RUNNER_URL = process.env.RUNNER_URL || 'http://localhost:3001'
      await axios.post(`${RUNNER_URL}/execute`, {
        executionId,
        language,
        code,
      }, { timeout: 10000 })

      res.json({ success: true, executionId })
    } catch (err: any) {
      console.error('Execution from session failed', err?.message ?? err)
      res.status(500).json({ error: 'Execution failed', detail: err?.message })
    }
  })

  const PORT = process.env.PORT ? Number(process.env.PORT) : 1234
  server.listen(PORT, () => {
    console.log(`Yjs Relay Server listening on http://0.0.0.0:${PORT}`)
    console.log('WebSocket path: /yjs?sessionId={sessionId}')
  })
}

start().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
