import express from 'express'
import http from 'http'
import cors from 'cors'
import bodyParser from 'body-parser'
import WebSocket, { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'
import * as Y from 'yjs'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'

const PORT = process.env.PORT ? Number(process.env.PORT) : 1234
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret'
const ENABLE_S3_SNAPSHOT = process.env.ENABLE_S3_SNAPSHOT === 'true'
const S3_BUCKET = process.env.S3_BUCKET || ''
const S3_PREFIX = process.env.S3_PREFIX || 'yjs/'
const S3_REGION = process.env.S3_REGION || 'us-east-1'
const SNAPSHOT_INTERVAL = Number(process.env.SNAPSHOT_INTERVAL || 5)

// Local snapshot directory for development (when S3 is not available)
const LOCAL_SNAPSHOT_DIR = process.env.SNAPSHOT_DIR || '/tmp/yjs-snapshots'

const s3Client = ENABLE_S3_SNAPSHOT ? new S3Client({ region: S3_REGION }) : null

// Ensure local snapshot directory exists
if (!ENABLE_S3_SNAPSHOT && !fs.existsSync(LOCAL_SNAPSHOT_DIR)) {
  fs.mkdirSync(LOCAL_SNAPSHOT_DIR, { recursive: true })
  console.log(`[yjs-relay] Created local snapshot directory: ${LOCAL_SNAPSHOT_DIR}`)
}

// Per-session/challenge in-memory state
// Key format: `${sessionId}:${challengeId}:${contentType}`
// Each combination gets its own Y.Doc with a Y.Map containing content keys
const sessions = new Map() // key -> { doc: Y.Doc, clients: Set<ws>, updatesSinceSnapshot: number }

function getSessionKey(sessionId, challengeId, contentType = 'default') {
  return `${sessionId}:${challengeId}:${contentType}`
}

async function loadSnapshotFromS3(sessionKey) {
  if (ENABLE_S3_SNAPSHOT && s3Client && S3_BUCKET) {
    try {
      const s3Key = `${S3_PREFIX}${sessionKey.replace(/:/g, '_')}.bin`
      console.log(`[yjs-relay] Attempting to load snapshot from S3: ${s3Key}`)
      
      const result = await s3Client.send(new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
      }))
      
      const chunks = []
      for await (const chunk of result.Body) {
        chunks.push(chunk)
      }
      const buffer = Buffer.concat(chunks)
      console.log(`[yjs-relay] ✅ Loaded snapshot from S3: ${s3Key} (${buffer.length} bytes)`)
      return buffer
    } catch (err) {
      // S3 key not found is expected for new sessions
      if (err.name !== 'NoSuchKey') {
        console.error('[yjs-relay] Failed to load snapshot from S3', err?.message || err)
      }
      return null
    }
  } else {
    // Load from local filesystem
    try {
      const filename = `${sessionKey.replace(/:/g, '_')}.bin`
      const filepath = path.join(LOCAL_SNAPSHOT_DIR, filename)
      
      if (fs.existsSync(filepath)) {
        const buffer = fs.readFileSync(filepath)
        console.log(`[yjs-relay] ✅ Loaded snapshot from local: ${filepath} (${buffer.length} bytes)`)
        return buffer
      } else {
        console.log(`[yjs-relay] No local snapshot found: ${filepath}`)
        return null
      }
    } catch (err) {
      console.error('[yjs-relay] Failed to load snapshot from local filesystem', err?.message || err)
      return null
    }
  }
}

function getSession(sessionId, challengeId, contentType = 'default') {
  const key = getSessionKey(sessionId, challengeId, contentType)
  if (!sessions.has(key)) {
    const doc = new Y.Doc()
    // DO NOT pre-create Y.Text here - let clients establish structure via their updates
    // This avoids client ID conflicts when multiple docs pre-create the same object
    console.log(`[yjs-relay] Created new session: ${key}`)
    sessions.set(key, { doc, clients: new Set(), updatesSinceSnapshot: 0, key })
  }
  return sessions.get(key)
}

async function getSessionWithSnapshot(sessionId, challengeId, contentType = 'default') {
  const key = getSessionKey(sessionId, challengeId, contentType)
  
  if (!sessions.has(key)) {
    const doc = new Y.Doc()
    console.log(`[yjs-relay] 🔄 Creating new session: ${key}`)
    
    // Try to load snapshot from local or S3
    const snapshotBuffer = await loadSnapshotFromS3(key)
    if (snapshotBuffer) {
      try {
        Y.applyUpdate(doc, new Uint8Array(snapshotBuffer))
        console.log(`[yjs-relay] ✅ RESTORED doc state from snapshot (${snapshotBuffer.length} bytes) for key: ${key}`)
      } catch (err) {
        console.error('[yjs-relay] Failed to apply snapshot', err)
      }
    } else {
      console.log(`[yjs-relay] 🚀 No snapshot found - starting fresh for: ${key}`)
    }
    
    sessions.set(key, { doc, clients: new Set(), updatesSinceSnapshot: 0, key })
  }
  return sessions.get(key)
}

async function persistSnapshot(sessionKey, doc) {
  try {
    const update = Y.encodeStateAsUpdate(doc)
    
    if (ENABLE_S3_SNAPSHOT && s3Client && S3_BUCKET) {
      // Save to S3
      const s3Key = `${S3_PREFIX}${sessionKey.replace(/:/g, '_')}.bin`
      await s3Client.send(new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: Buffer.from(update),
        ContentType: 'application/octet-stream',
      }))
      console.log(`[yjs-relay] Snapshot persisted to S3: ${s3Key}`)
    } else {
      // Save to local filesystem
      const filename = `${sessionKey.replace(/:/g, '_')}.bin`
      const filepath = path.join(LOCAL_SNAPSHOT_DIR, filename)
      fs.writeFileSync(filepath, Buffer.from(update))
      console.log(`[yjs-relay] Snapshot persisted locally: ${filepath}`)
    }
  } catch (err) {
    console.error('[yjs-relay] Failed to persist snapshot', err?.message || err)
  }
}

function authFromToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return { userId: payload.sub || payload.userId || payload.id || 'unknown', role: payload.role || 'viewer', canWrite: payload.role === 'interviewer' || payload.role === 'interviewee' }
  } catch (err) {
    return null
  }
}

function startServer() {
  const app = express()
  app.use(cors())
  app.use(bodyParser.json({ limit: '2mb' }))

  const server = http.createServer(app)

  // HTTP endpoint to force save snapshot (called when switching challenges)
  app.post('/snapshot', async (req, res) => {
    try {
      const { sessionId, challengeId, contentType } = req.body
      if (!sessionId || !challengeId) {
        return res.status(400).json({ error: 'Missing sessionId or challengeId' })
      }
      
      const key = getSessionKey(sessionId, challengeId, contentType || 'default')
      const session = sessions.get(key)
      
      if (!session) {
        console.log(`[yjs-relay] Force save requested but session not found: ${key}`)
        return res.status(404).json({ error: 'Session not found' })
      }
      
      console.log(`[yjs-relay] Force saving snapshot for: ${key}`)
      await persistSnapshot(key, session.doc)
      res.json({ success: true, key })
    } catch (err) {
      console.error('[yjs-relay] Error force saving snapshot:', err)
      res.status(500).json({ error: err.message })
    }
  })

  const wss = new WebSocketServer({ server, path: '/yjs' })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    const challengeId = url.searchParams.get('challengeId') || 'default'
    const contentType = url.searchParams.get('contentType') || 'default'
    const token = url.searchParams.get('token') || ''
    
    console.log('[yjs-relay] New WebSocket connection attempt:', { sessionId, challengeId, contentType, hasToken: !!token })
    
    if (!sessionId) {
      console.log('[yjs-relay] ❌ Connection rejected: Missing sessionId')
      ws.close(1008, 'Missing sessionId')
      return
    }
    if (!token) {
      console.log('[yjs-relay] ❌ Connection rejected: Missing token')
      ws.close(1008, 'Missing token')
      return
    }
    const meta = authFromToken(token)
    if (!meta) {
      console.log('[yjs-relay] ❌ Connection rejected: Invalid token')
      ws.close(1008, 'Invalid token')
      return
    }

    console.log('[yjs-relay] ✅ Connection accepted for:', { sessionId, challengeId, contentType, userId: meta.userId })

    // Get or create session with S3 snapshot recovery
    getSessionWithSnapshot(sessionId, challengeId, contentType).then((session) => {
      const wasEmpty = session.doc.getArray('_isFirstClient') === undefined // Check if doc has content
      const docState = Y.encodeStateAsUpdate(session.doc)
      
      session.clients.add(ws)

      // If doc has content from other clients, send it to the new client
      // This prevents duplicates when multiple clients connect sequentially
      if (docState.length > 0) {
        console.log('[yjs-relay] ℹ️ Client connected - sending existing state:', docState.length, 'bytes')
        ws.send(docState)
      } else {
        console.log('[yjs-relay] ℹ️ Client connected - waiting for their initial state')
      }
      
      // When they send their first update, it will be propagated to other peers


      ws.on('message', async (data) => {
        if (!meta.canWrite) {
          console.log('[yjs-relay] Message ignored: user cannot write', { userId: meta.userId })
          return
        }
        if (!(data instanceof Buffer)) {
          console.log('[yjs-relay] Message ignored: not a Buffer', { type: typeof data })
          return
        }
        try {
          console.log('[yjs-relay] 📥 Received update from', meta.userId, '- update size:', data.length, 'bytes for key:', session.key)
          Y.applyUpdate(session.doc, new Uint8Array(data))
          console.log('[yjs-relay] ✅ Applied update to doc')
          session.updatesSinceSnapshot += 1

          // broadcast to peers
          let broadcastCount = 0
          session.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              try {
                console.log('[yjs-relay] 📤 Broadcasting update to peer, size:', data.length, 'bytes')
                client.send(data)
                broadcastCount++
              } catch (e) {
                console.error('[yjs-relay] broadcast error', e)
              }
            }
          })
          console.log('[yjs-relay] ✅ Broadcasted to', broadcastCount, 'peers')

          if (session.updatesSinceSnapshot >= SNAPSHOT_INTERVAL) {
            console.log('[yjs-relay] 💾 Saving snapshot after', session.updatesSinceSnapshot, 'updates for key:', session.key)
            session.updatesSinceSnapshot = 0
            await persistSnapshot(session.key, session.doc)
          }
        } catch (err) {
          console.error('[yjs-relay] Failed to apply update', err)
        }
      })

      ws.on('close', () => {
        session.clients.delete(ws)
        if (session.clients.size === 0) {
          // keep doc in memory for quick reconnect; could prune later
        }
      })
    }).catch((err) => {
      console.error('[yjs-relay] Failed to get session with snapshot:', err)
      ws.close(1011, 'Failed to get session')
    })
  })

  server.listen(PORT, () => {
    console.log(`[yjs-relay] Listening on http://0.0.0.0:${PORT}`)
    console.log('[yjs-relay] WS path: /yjs?sessionId={id}&token={jwt}')
    console.log(`[yjs-relay] S3 snapshots: ${ENABLE_S3_SNAPSHOT ? 'enabled' : 'disabled'}`)
  })
}

startServer()
