import { Server as SocketIOServer, Socket } from 'socket.io'
import { Server as HTTPServer } from 'http'
import jwt from 'jsonwebtoken'
import executionService from '../modules/execution/execution.service'

interface AuthenticatedSocket extends Socket {
  userId?: string
}

export class ExecutionGateway {
  private io: SocketIOServer

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://192.168.1.12:5173'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      allowEIO3: true,
    })

    // Add authentication middleware
    this.io.use((socket: AuthenticatedSocket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')
      
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
          socket.userId = decoded.id
          console.log(`[Socket.IO Auth] Authenticated user: ${decoded.id}`)
        } catch (err) {
          console.log(`[Socket.IO Auth] Invalid token, allowing connection anyway`)
          // Allow connection even without valid token
        }
      } else {
        console.log(`[Socket.IO Auth] No token provided, allowing connection`)
      }
      
      next()
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`)

      // Join generic room
      socket.on('join-room', (roomName: string) => {
        socket.join(roomName)
        console.log(`[Socket.IO] Client ${socket.id} joined room: ${roomName}`)
      })

      // Leave generic room
      socket.on('leave-room', (roomName: string) => {
        socket.leave(roomName)
        console.log(`Client ${socket.id} left room: ${roomName}`)
      })

      // Join execution room
      socket.on('join-execution', (executionId: string) => {
        socket.join(`execution:${executionId}`)
        console.log(`Client ${socket.id} joined execution: ${executionId}`)
      })

      // Leave execution room
      socket.on('leave-execution', (executionId: string) => {
        socket.leave(`execution:${executionId}`)
        console.log(`Client ${socket.id} left execution: ${executionId}`)
      })

      // Join session room
      socket.on('join-session', (sessionId: string) => {
        socket.join(`session:${sessionId}`)
        const roomName = `session:${sessionId}`
        const clientCount = this.io.sockets.adapter.rooms.get(roomName)?.size || 0
        console.log(`[join-session] ✅ Client ${socket.id} joined session: ${sessionId} (total in room: ${clientCount})`)
        
        // Log all clients in the room
        const clientsInRoom = Array.from(this.io.sockets.adapter.rooms.get(roomName) || new Set())
        console.log(`[join-session] Clients in room: ${clientsInRoom.join(', ')}`)
      })

      // Leave session room
      socket.on('leave-session', (sessionId: string) => {
        socket.leave(`session:${sessionId}`)
        console.log(`Client ${socket.id} left session: ${sessionId}`)
      })

      // Handle session events (code changes, challenge changes, etc.)
      socket.on('session-event', (payload: any) => {
        const { sessionId, event, data } = payload
        if (sessionId) {
          console.log(`[session-event] Received from ${socket.id}: event=${event}, sessionId=${sessionId}`)
          
          // Broadcast event to other clients in the session room
          const roomName = `session:${sessionId}`
          const eventName = `session-${event}-${sessionId}`
          
          this.io.to(roomName).emit(eventName, data)
          console.log(`[session-event] Broadcasted to room "${roomName}" with event "${eventName}"`)
        }
      })

      // Generic event handler for dynamic session events
      socket.onAny((eventName: string, payload: any) => {
        if (eventName.startsWith('session-challenge-changed-')) {
          const sessionId = eventName.replace('session-challenge-changed-', '')
          const roomName = `session:${sessionId}`
          const roomSockets = Array.from(this.io.sockets.adapter.rooms.get(roomName) || new Set())
          const clientCount = roomSockets.length
          const senderInRoom = roomSockets.includes(socket.id)
          
          console.log(`[challenge-changed] ✅ Received from ${socket.id}: sessionId=${sessionId}, index=${payload.index}`)
          console.log(`[challenge-changed] Room "${roomName}" clients:`, clientCount)
          console.log(`[challenge-changed] Socket IDs in room:`, roomSockets.join(', '))
          console.log(`[challenge-changed] Sender in room?`, senderInRoom)
          
          // Broadcast to all clients in the session EXCEPT the sender
          const recipientCount = roomSockets.filter(c => c !== socket.id).length
          console.log(`[challenge-changed] Broadcasting to ${recipientCount} recipients:`, roomSockets.filter(c => c !== socket.id).join(', '))
          this.io.to(roomName).except(socket.id).emit(`session-challenge-changed-${sessionId}`, payload)
          console.log(`[challenge-changed] ✅ Broadcasted to room "${roomName}"`)
        } else if (eventName.startsWith('session-language-changed-')) {
          const sessionId = eventName.replace('session-language-changed-', '')
          const roomName = `session:${sessionId}`
          const roomSockets = Array.from(this.io.sockets.adapter.rooms.get(roomName) || new Set())
          const clientCount = roomSockets.length
          const senderInRoom = roomSockets.includes(socket.id)
          
          console.log(`[language-changed] ✅ Received from ${socket.id}: sessionId=${sessionId}, language=${payload.language}`)
          console.log(`[language-changed] Room "${roomName}" clients:`, clientCount)
          console.log(`[language-changed] Socket IDs in room:`, roomSockets.join(', '))
          console.log(`[language-changed] Sender in room?`, senderInRoom)
          
          // Broadcast to all clients in the session EXCEPT the sender
          const recipientCount = roomSockets.filter(c => c !== socket.id).length
          console.log(`[language-changed] Broadcasting to ${recipientCount} recipients:`, roomSockets.filter(c => c !== socket.id).join(', '))
          this.io.to(roomName).except(socket.id).emit(`session-language-changed-${sessionId}`, payload)
          console.log(`[language-changed] ✅ Broadcasted to room "${roomName}"`)
        }
      })

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`)
      })
    })
  }

  // Broadcast log to execution room
  async broadcastLog(executionId: string, message: string, level: 'info' | 'error' | 'warning'): Promise<void> {
    // Save log to database
    await executionService.addLog(executionId, message, level)

    // Broadcast to connected clients with execution-specific event
    const roomName = `execution:${executionId}`
    const eventName = `execution-log-${executionId}`
    console.log(`[broadcastLog] Broadcasting to room "${roomName}" with event "${eventName}"`)
    console.log(`[broadcastLog] Message: ${message}`)
    
    this.io.to(roomName).emit(eventName, {
      executionId,
      message,
      level,
      timestamp: new Date().toISOString(),
    })
  }

  // Broadcast execution status update
  broadcastExecutionStatus(
    executionId: string,
    status: string,
    stdout?: string,
    stderr?: string,
    exitCode?: number,
  ): void {
    this.io.to(`execution:${executionId}`).emit('execution-status', {
      executionId,
      status,
      stdout,
      stderr,
      exitCode,
      timestamp: new Date().toISOString(),
    })
  }

  // Broadcast to session
  broadcastToSession(sessionId: string, event: string, data: any): void {
    this.io.to(`session:${sessionId}`).emit(event, data)
  }

  // Notify interviewer about candidate access request
  notifyInterviewerOfAccessRequest(interviewerId: string, sessionId: string, candidateName: string): void {
    const roomName = `interviewer:${interviewerId}`
    console.log(`[notifyInterviewerOfAccessRequest] Emitting to room "${roomName}" with event "candidate-access-request"`)
    this.io.to(roomName).emit('candidate-access-request', {
      sessionId,
      candidateName,
      timestamp: new Date().toISOString(),
    })
    console.log(`[notifyInterviewerOfAccessRequest] Notified interviewer ${interviewerId} about access request for session ${sessionId}`)
  }

  getIO(): SocketIOServer {
    return this.io
  }
}
