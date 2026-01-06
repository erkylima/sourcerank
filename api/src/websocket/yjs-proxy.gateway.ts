import { Server as HTTPServer, IncomingMessage } from 'http'
import { WebSocketServer } from 'ws'

/**
 * Proxy WebSocket gateway that relays connections to the internal Yjs relay server
 */
export class YjsProxyGateway {
  private relayUrl: string

  constructor(server: HTTPServer, relayUrl: string = 'ws://yjs-relay:1234') {
    this.relayUrl = relayUrl
    
    // Listen only for upgrade events to /yjs path
    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      if (request.url?.startsWith('/yjs')) {
        this.handleUpgrade(request, socket, head)
      }
    })

    console.log(`[YjsProxy] Listening for upgrades to /yjs, proxying to ${relayUrl}`)
  }

  private handleUpgrade(request: IncomingMessage, socket: any, head: Buffer) {
    const wss = new WebSocketServer({ noServer: true })

    wss.handleUpgrade(request, socket, head, (clientWs: any) => {
      this.handleClientConnection(clientWs, request)
    })
  }

  private async handleClientConnection(clientWs: any, req: IncomingMessage) {
    const clientUrl = req.url || ''
    const relayUrlWithQuery = `${this.relayUrl}${clientUrl}`

    console.log(`[YjsProxy] New client connection, proxying to: ${relayUrlWithQuery.split('?')[0]}`)

    try {
      // Dynamic import of ws to create relay connection
      const WebSocket = require('ws')
      const relayWs = new WebSocket(relayUrlWithQuery)

      relayWs.on('open', () => {
        console.log(`[YjsProxy] ✅ Connected to relay`)
      })

      relayWs.on('message', (data: any) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(data)
        }
      })

      relayWs.on('error', (err: any) => {
        console.error(`[YjsProxy] Relay error:`, err.message)
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, `Relay error: ${err.message}`)
        }
      })

      relayWs.on('close', () => {
        console.log(`[YjsProxy] Relay connection closed`)
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1000, 'Relay closed')
        }
      })

      clientWs.on('message', (data: any) => {
        if (relayWs.readyState === WebSocket.OPEN) {
          relayWs.send(data)
        }
      })

      clientWs.on('error', (err: any) => {
        console.error(`[YjsProxy] Client error:`, err.message)
        if (relayWs.readyState === WebSocket.OPEN) {
          relayWs.close()
        }
      })

      clientWs.on('close', () => {
        console.log(`[YjsProxy] Client disconnected`)
        if (relayWs.readyState === WebSocket.OPEN) {
          relayWs.close()
        }
      })
    } catch (err: any) {
      console.error(`[YjsProxy] Failed to connect to relay:`, err.message)
      clientWs.close(1011, `Failed to connect to relay: ${err.message}`)
    }
  }
}
