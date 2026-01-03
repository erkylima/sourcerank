import { io, Socket } from 'socket.io-client'
import authService from './auth.service'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

let socket: Socket | null = null

export const executionService = {
  connect: () => {
    if (socket) {
      if (socket.connected) {
        console.log(`[executionService] Socket already connected`)
        return socket
      } else {
        console.log(`[executionService] Socket exists but disconnected, reconnecting...`)
        socket.connect()
        return socket
      }
    }
    
    const token = authService.getToken()
    console.log(`[executionService] Creating new socket connection to ${API_URL}`)
    console.log(`[executionService] Token available: ${!!token}`)
    
    socket = io(API_URL, {
      auth: { 
        token: token || '' 
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    })
    
    socket.on('connect', () => {
      console.log(`[executionService] ✅ Connected to WebSocket: ${socket?.id}`)
    })
    
    socket.on('disconnect', (reason) => {
      console.log(`[executionService] ❌ Disconnected from WebSocket: ${reason}`)
    })
    
    socket.on('error', (error) => {
      console.error(`[executionService] ⚠️ WebSocket error:`, error)
    })
    
    socket.on('connect_error', (error) => {
      console.error(`[executionService] ⚠️ Connection error:`, error.message)
    })
    
    return socket
  },

  disconnect: () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  },

  getSocket: () => socket,

  onLog: (callback: (data: string) => void) => {
    const s = executionService.connect()
    s.on('log', (payload) => {
      callback(payload.data)
    })
  },

  joinSession: (sessionId: string) => {
    const s = executionService.connect()
    s.emit('join-session', sessionId)
  },

  sendWebRTCOffer: (target: string, sdp: RTCSessionDescriptionInit) => {
    const s = executionService.connect()
    s.emit('webrtc-offer', { target, sdp })
  },

  onWebRTCOffer: (callback: (payload: any) => void) => {
    const s = executionService.connect()
    s.on('webrtc-offer', callback)
  },

  sendWebRTCAnswer: (target: string, sdp: RTCSessionDescriptionInit) => {
    const s = executionService.connect()
    s.emit('webrtc-answer', { target, sdp })
  },

  onWebRTCAnswer: (callback: (payload: any) => void) => {
    const s = executionService.connect()
    s.on('webrtc-answer', callback)
  },

  sendWebRTCCandidate: (target: string, candidate: RTCIceCandidateInit) => {
    const s = executionService.connect()
    s.emit('webrtc-candidate', { target, candidate })
  },

  onWebRTCCandidate: (callback: (payload: any) => void) => {
    const s = executionService.connect()
    s.on('webrtc-candidate', callback)
  },
}

export default executionService
