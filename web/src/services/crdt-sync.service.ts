import * as Y from 'yjs'
import authService from './auth.service'

type UpdateCallback = (content: string, language: string) => void

interface CrdtConnection {
  doc: Y.Doc
  ytext: Y.Text
  ymeta: Y.Map<any>
  ws: WebSocket
  unsubscribe: () => void
}

/**
 * CRDT Sync Service - Transport layer for real-time sync
 * Does NOT manage state, only broadcasts and receives updates
 */
class CrdtSyncService {
  private connections = new Map<string, CrdtConnection>()

  /**
   * Subscribe to CRDT updates for a challenge with specific language
   * Returns unsubscribe function
   */
  subscribe(
    sessionId: string,
    challengeId: string,
    contentType: string,
    language: string,
    onUpdate: UpdateCallback
  ): () => void {
    const key = `${sessionId}:${challengeId}:${contentType}:${language}`
    
    // Reuse existing connection if available
    if (this.connections.has(key)) {
      return this.connections.get(key)!.unsubscribe
    }

    // Create Y.Doc
    const doc = new Y.Doc()
    const ytext = doc.getText('content')
    const ymeta = doc.getMap('meta')

    // Observer for content changes
    const handleContentUpdate = () => {
      const content = ytext.toString()
      const language = (ymeta.get('language') as string) || 'python'
      onUpdate(content, language)
    }

    ytext.observe(handleContentUpdate)
    ymeta.observe(handleContentUpdate)

    // Connect to relay via API proxy
    const token = authService.getToken() || ''
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const protocol = apiUrl.startsWith('https:') ? 'wss:' : 'ws:'
    const host = apiUrl.replace(/^https?:\/\//, '')
    const wsUrl = new URL(`${protocol}//${host}/yjs`)
    
    wsUrl.searchParams.set('sessionId', sessionId)
    wsUrl.searchParams.set('challengeId', challengeId)
    wsUrl.searchParams.set('contentType', contentType)
    wsUrl.searchParams.set('language', language)  // Add language parameter
    wsUrl.searchParams.set('token', token)

    console.log(`[CrdtSyncService] Connecting to: ${wsUrl.toString().split('?')[0]}?[params]`)
    const ws = new WebSocket(wsUrl.toString())
    ws.binaryType = 'arraybuffer'
    console.log(`[CrdtSyncService] WebSocket created (readyState=${ws.readyState})`)

    // Send local changes to relay
    const handleDocUpdate = (update: Uint8Array, origin?: string) => {
      if (origin === 'relay') return // Don't echo relay updates
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(update)
      }
    }

    doc.on('update', handleDocUpdate)

    // Receive remote changes from relay
    ws.onmessage = (event) => {
      console.log(`[CrdtSyncService] Received message: ${event.data?.byteLength || event.data?.length || 'unknown'} bytes`)
      if (!event.data) {
        console.log(`[CrdtSyncService] Empty data, skipping`)
        return
      }
      try {
        console.log(`[CrdtSyncService] Parsing Uint8Array...`)
        const update = new Uint8Array(event.data as ArrayBuffer)
        console.log(`[CrdtSyncService] Applying update: ${update.length} bytes`)
        Y.applyUpdate(doc, update, 'relay')
        console.log(`[CrdtSyncService] ✅ Update applied successfully`)
      } catch (err) {
        console.error('[CrdtSyncService] Failed to apply update:', err)
        console.error('[CrdtSyncService] Error details:', (err as any).message, (err as any).stack)
      }
    }

    ws.onopen = () => {
      console.log(`[CrdtSyncService] ✅ WebSocket OPEN`)
    }

    ws.onerror = (err) => {
      console.error('[CrdtSyncService] WebSocket error:', err)
    }

    ws.onclose = (event) => {
      console.log(`[CrdtSyncService] WebSocket CLOSED (code=${event.code}, reason='${event.reason}')`)
      this.connections.delete(key)
    }

    // Unsubscribe function
    const unsubscribe = () => {
      ytext.unobserve(handleContentUpdate)
      ymeta.unobserve(handleContentUpdate)
      doc.off('update', handleDocUpdate)
      ws.close()
      this.connections.delete(key)
    }

    // Store connection
    const connection: CrdtConnection = { doc, ytext, ymeta, ws, unsubscribe }
    this.connections.set(key, connection)

    return unsubscribe
  }

  /**
   * Publish local changes to CRDT
   */
  publish(
    sessionId: string,
    challengeId: string,
    contentType: string,
    content: string,
    language: string
  ): void {
    const key = `${sessionId}:${challengeId}:${contentType}:${language}`
    const connection = this.connections.get(key)

    if (!connection) {
      return  // No connection, skip
    }

    const { doc, ytext, ymeta } = connection

    // Use 'local' origin to prevent echo
    doc.transact(() => {
      // Update content
      const currentContent = ytext.toString()
      if (currentContent !== content) {
        ytext.delete(0, currentContent.length)
        ytext.insert(0, content)
      }
      
      // Update language
      const currentLanguage = ymeta.get('language')
      if (currentLanguage !== language) {
        ymeta.set('language', language)
      }
    })
  }

  /**
   * Close all connections (cleanup on unmount)
   */
  closeAll(): void {
    this.connections.forEach((conn) => conn.unsubscribe())
    this.connections.clear()
  }
}

export default new CrdtSyncService()
