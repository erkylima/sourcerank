import { Server as HTTPServer, IncomingMessage } from 'http'
import { WebSocketServer, WebSocket } from 'ws'

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

    console.log(`[YjsProxy] New client connection (state=${clientWs.readyState}), proxying to: ${relayUrlWithQuery.split('?')[0]}?[params]`)

    try {
      const relayWs = new WebSocket(relayUrlWithQuery)
      let relayReady = false

      console.log(`[YjsProxy] Relay URL: ${relayUrlWithQuery}`)
      console.log(`[YjsProxy] Client initial state: ${clientWs.readyState}`)

      relayWs.on('open', () => {
        console.log(`[YjsProxy] ✅ Relay connected (relay.state=${relayWs.readyState}, client.state=${clientWs.readyState})`)
        relayReady = true
      })

      relayWs.on('message', (data: any) => {
        console.log(`[YjsProxy] Relay->Client: ${data.length} bytes, relay.state=${relayWs.readyState}, client.state=${clientWs.readyState}`)
        if (clientWs.readyState === WebSocket.OPEN && relayReady) {
          console.log(`[YjsProxy] ✅ Forwarding to client...`)
          clientWs.send(data)
        } else {
          console.log(`[YjsProxy] ⚠️  CANNOT forward: client.state=${clientWs.readyState} (need OPEN=1), relayReady=${relayReady}`)
        }
      })

      relayWs.on('error', (err: any) => {
        console.error(`[YjsProxy] Relay error:`, err.message)
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close(1011, `Relay error: ${err.message}`)
        }
      })

      relayWs.on('close', (code: any) => {
        console.log(`[YjsProxy] Relay closed (code=${code})`)
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.close()
        }
      })

      clientWs.on('open', () => {
        console.log(`[YjsProxy] ✅ Client ready (state=${clientWs.readyState})`)
      })

      clientWs.on('message', (data: any) => {
        console.log(`[YjsProxy] Client->Relay: ${data.length} bytes`)
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

      clientWs.on('close', (code: any) => {
        console.log(`[YjsProxy] Client closed (code=${code})`)
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
