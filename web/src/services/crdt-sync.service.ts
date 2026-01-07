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
   * Subscribe to CRDT updates for a challenge
   * Returns unsubscribe function
   */
  subscribe(
    sessionId: string,
    challengeId: string,
    contentType: string,
    onUpdate: UpdateCallback
  ): () => void {
    const key = `${sessionId}:${challengeId}:${contentType}`
    
    // Reuse existing connection if available
    if (this.connections.has(key)) {
      console.log('[CrdtSyncService] Reusing existing connection:', key)
      return this.connections.get(key)!.unsubscribe
    }

    console.log('[CrdtSyncService] Creating new CRDT connection:', key)

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
    wsUrl.searchParams.set('token', token)

    const ws = new WebSocket(wsUrl.toString())
    ws.binaryType = 'arraybuffer'

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
      if (!event.data) return
      try {
        const update = new Uint8Array(event.data as ArrayBuffer)
        Y.applyUpdate(doc, update, 'relay')
      } catch (err) {
        console.error('[CrdtSyncService] Failed to apply update:', err)
      }
    }

    ws.onopen = () => {
      console.log('[CrdtSyncService] ✅ WebSocket connected:', key)
    }

    ws.onerror = (err) => {
      console.error('[CrdtSyncService] WebSocket error:', err)
    }

    ws.onclose = () => {
      console.log('[CrdtSyncService] WebSocket closed:', key)
      this.connections.delete(key)
    }

    // Unsubscribe function
    const unsubscribe = () => {
      console.log('[CrdtSyncService] Unsubscribing:', key)
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
    const key = `${sessionId}:${challengeId}:${contentType}`
    const connection = this.connections.get(key)

    if (!connection) {
      console.warn('[CrdtSyncService] No connection found for:', key)
      return
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
    console.log('[CrdtSyncService] Closing all connections')
    this.connections.forEach((conn) => conn.unsubscribe())
    this.connections.clear()
  }
}

export default new CrdtSyncService()
