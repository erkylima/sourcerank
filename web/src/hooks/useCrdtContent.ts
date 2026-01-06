import { useEffect, useRef, useState, useCallback } from 'react'
import * as Y from 'yjs'
import authService from '@/services/auth.service'
import sessionContentService from '@/services/session-content.service'

interface UseCrdtContentProps {
  enabled: boolean
  sessionId: string
  challengeId: string
  contentType: string
  onContentChange: (content: string) => void
  starterContent?: string
}

interface CrdtContentRef {
  doc: Y.Doc | null
  content: Y.Text | null
  ws: WebSocket | null
  dbLoadTimeout?: NodeJS.Timeout | null
}

// Simple hook to sync content via Yjs CRDT - NO SNAPSHOTS, just real-time sync
export function useCrdtContent({
  enabled,
  sessionId,
  challengeId,
  contentType,
  onContentChange,
  starterContent = '',
}: UseCrdtContentProps) {
  const contentRef = useRef<CrdtContentRef>({ doc: null, content: null, ws: null })
  const [content, setContent] = useState('')
  const [language, setLanguage] = useState('python')
  const onContentChangeRef = useRef(onContentChange)
  const isMountedRef = useRef(true) // Use ref to persist across effect re-runs

  // Keep the ref updated without triggering effects
  useEffect(() => {
    onContentChangeRef.current = onContentChange
  }, [onContentChange])

  // Set isMounted to true when component mounts
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    const normalizedChallengeId = String(challengeId || '')

    if (!enabled || !sessionId || !normalizedChallengeId || normalizedChallengeId === 'unknown' || !contentType) {
      console.log('[useCrdtContent] CRDT disabled or missing props')
      return
    }

    console.log('[useCrdtContent] ========== INITIALIZING CRDT ==========')
    console.log('[useCrdtContent] Setup for:', { sessionId, challengeId: normalizedChallengeId, contentType })

    let cleanupFn: (() => void) | null = null
    let isMountedLocal = true // Track if effect is still mounted

    const initialize = async () => {
      try {
        // Step 1: Create fresh Yjs doc for this challenge FIRST
        // IMPORTANT: Create a new doc each time to avoid state pollution from previous challenges
        const doc = new Y.Doc()
        contentRef.current.doc = doc

        const ytext = doc.getText('content')
        contentRef.current.content = ytext
        
        // Store the current challenge ID to validate updates belong to this challenge
        const currentChallengeId = normalizedChallengeId
        console.log('[useCrdtContent] 📝 Created new Y.Doc for challenge:', currentChallengeId)

        // Step 2: Setup observer BEFORE connecting to WebSocket
        // This ensures we catch all updates including the initial state from relay
        const handleUpdate = (event: any) => {
          if (!isMountedLocal || !isMountedRef.current) {
            console.log('[useCrdtContent] Observer fired but component unmounted!')
            return
          }
          const newContent = ytext.toString()
          console.log('[useCrdtContent] 📤 Observer fired!', {
            length: newContent.length,
            firstChars: newContent.substring(0, 50) || '(empty)',
            isLocal: event.transaction?.local ? 'YES' : 'NO',
            challengeId: currentChallengeId
          })
          setContent(newContent)
          onContentChangeRef.current(newContent)
        }

        console.log('[useCrdtContent] 👁️ Registering observer on Y.Text for challenge:', currentChallengeId)
        ytext.observe(handleUpdate)
        console.log('[useCrdtContent] ✅ Observer registered')

        // Flag to control when we accept doc updates from the relay
        // We disable this during initialization to prevent sending our DB load as an update
        let isInitializing = true
        let receivedRemoteState = false
        let handleDocUpdate: ((update: Uint8Array) => void) | null = null

        // Prepare cleanup early so we always clean even on early return
        cleanupFn = () => {
          console.log('[useCrdtContent] 🧹 Cleaning up CRDT resources for challenge:', currentChallengeId)
          isMountedLocal = false
          if (contentRef.current.dbLoadTimeout) {
            clearTimeout(contentRef.current.dbLoadTimeout)
            contentRef.current.dbLoadTimeout = null
          }
          try {
            ytext.unobserve(handleUpdate)
          } catch (e) {
            console.warn('[useCrdtContent] Cleanup - unobserve failed:', e)
          }
          try {
            if (handleDocUpdate) {
              doc.off('update', handleDocUpdate)
            }
          } catch (e) {
            // handleDocUpdate may not be registered yet
          }
          try {
            contentRef.current.ws?.close()
          } catch (e) {
            console.warn('[useCrdtContent] Cleanup - ws.close failed:', e)
          }
          console.log('[useCrdtContent] ✅ Cleanup complete for challenge:', currentChallengeId)
        }

        // Step 3: Load from DB FIRST - DB is source of truth
        console.log('[useCrdtContent] 📚 Loading from DB for challenge:', currentChallengeId)
        let dbContent = ''
        let dbLanguage = 'python'

        try {
          const dbResult = await sessionContentService.loadChallengeContent(
            sessionId,
            parseInt(currentChallengeId),
            contentType
          )
          dbContent = dbResult.content
          dbLanguage = dbResult.language
          console.log('[useCrdtContent] ✅ Loaded from DB:', { contentLength: dbContent.length, language: dbLanguage })
        } catch (err) {
          console.error('[useCrdtContent] Error loading from DB:', err)
        }

        setLanguage(dbLanguage)

        // Step 4: Prepare seed from DB (truth) or starter (only if DB empty)
        // Do NOT apply to Y.Text yet; we first wait for relay snapshot. If relay is silent, we apply seed after timeout.
        const seedContent = dbContent.length > 0 ? dbContent : starterContent
        const hasSeed = seedContent.length > 0
        let seedApplied = false
        console.log('[useCrdtContent] 🌱 Prepared seed:', { source: dbContent.length > 0 ? 'DB' : 'starter', length: seedContent.length })

        // Step 5: Always connect to relay - relay is the CRDT authority
        // DB/starter seed may be overwritten by relay snapshot if it exists
        console.log('[useCrdtContent] 🔌 Connecting to relay for challenge:', currentChallengeId)
        const token = authService.getToken() || ''
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
        const protocol = apiUrl.startsWith('https:') ? 'wss:' : 'ws:'
        const host = apiUrl.replace(/^https?:\/\//, '')
        const wsUrl = new URL(`${protocol}//${host}/yjs`)
        
        wsUrl.searchParams.set('sessionId', sessionId)
        wsUrl.searchParams.set('challengeId', currentChallengeId)
        wsUrl.searchParams.set('contentType', contentType)
        wsUrl.searchParams.set('token', token)

        const ws = new WebSocket(wsUrl.toString())
        ws.binaryType = 'arraybuffer'
        contentRef.current.ws = ws

        console.log('[useCrdtContent] 🔌 Connecting to relay for challenge:', currentChallengeId)

        // Send local changes to relay
        // IMPORTANT: Only send if this is still the current challenge being edited
        handleDocUpdate = (update: Uint8Array) => {
          if (!isMountedLocal) {
            console.log('[useCrdtContent] Doc update ignored - component unmounted')
            return
          }
          
          // CRITICAL: Ignore updates during initialization (DB load phase)
          if (isInitializing) {
            console.log('[useCrdtContent] ⚠️ IGNORED doc update during initialization')
            return
          }
          
          // VALIDATION: Only send updates if we're still on the same challenge
          if (currentChallengeId !== normalizedChallengeId) {
            console.log('[useCrdtContent] ⚠️ IGNORED update from old challenge - was:', currentChallengeId, 'now:', normalizedChallengeId)
            return
          }
          
          if (ws.readyState === WebSocket.OPEN) {
            console.log('[useCrdtContent] 📤 Sending to relay for challenge', currentChallengeId, ':', update.byteLength, 'bytes')
            ws.send(update)
          }
        }

        if (handleDocUpdate) {
          doc.on('update', handleDocUpdate)
        }

        // Receive remote changes from relay
        ws.onmessage = (event) => {
          if (!event.data || !isMountedLocal) {
            if (!isMountedLocal) console.log('[useCrdtContent] Message ignored - component unmounted')
            return
          }
          
          // VALIDATION: Only apply updates if we're still on the same challenge
          if (currentChallengeId !== normalizedChallengeId) {
            console.log('[useCrdtContent] ⚠️ IGNORED message from old challenge - was:', currentChallengeId, 'now:', normalizedChallengeId)
            return
          }
          
          try {
            const update = new Uint8Array(event.data as ArrayBuffer)
            console.log('[useCrdtContent] 📥 Received from relay for challenge', currentChallengeId, ':', update.byteLength, 'bytes')
            console.log('[useCrdtContent] Before applyUpdate - content:', ytext.toString().substring(0, 50))
            
            // Mark that we received state from relay
            if (!receivedRemoteState && update.byteLength > 0) {
              receivedRemoteState = true
              console.log('[useCrdtContent] ✅ Received initial state from relay for challenge:', currentChallengeId)
            }
            
            Y.applyUpdate(doc, update)
            if (isInitializing) {
              isInitializing = false
              if (contentRef.current.dbLoadTimeout) {
                clearTimeout(contentRef.current.dbLoadTimeout)
                contentRef.current.dbLoadTimeout = null
              }
              console.log('[useCrdtContent] ✅ Initialization complete - enabling real-time updates')
            }
            console.log('[useCrdtContent] After applyUpdate - content:', ytext.toString().substring(0, 50))
            // Observer should trigger from applyUpdate
          } catch (err) {
            console.error('[useCrdtContent] Failed to apply update:', err)
          }
        }

        ws.onopen = () => {
          console.log('[useCrdtContent] ✅ WebSocket connected for challenge:', currentChallengeId)
          if (!isMountedLocal) {
            console.log('[useCrdtContent] WebSocket opened but component already unmounted')
            ws.close()
            return
          }
          
          // VALIDATION: Ensure this is still the current challenge
          if (currentChallengeId !== normalizedChallengeId) {
            console.log('[useCrdtContent] WebSocket opened for old challenge - closing')
            ws.close()
            return
          }
          
          // Backup timeout 3s: if relay doesn't respond, treat as offline.
          // If no snapshot arrived, push our seed once; otherwise just finish init.
          const backupTimeoutMs = 3000
          
          const backupTimeout = setTimeout(() => {
            if (!isMountedLocal) {
              console.log('[useCrdtContent] Backup timeout fired but component unmounted')
              return
            }
            
            // VALIDATION: Still on same challenge?
            if (currentChallengeId !== normalizedChallengeId) {
              console.log('[useCrdtContent] Backup timeout fired but challenge changed')
              return
            }
            
            if (isInitializing) {
              if (!receivedRemoteState) {
                if (hasSeed && !seedApplied) {
                  try {
                    doc.transact(() => {
                      ytext.insert(0, seedContent)
                    })
                    seedApplied = true
                    console.log('[useCrdtContent] ⏱️ Backup timeout - applied local seed (relay silent), chars:', seedContent.length)
                    if (ws.readyState === WebSocket.OPEN) {
                      try {
                        const bootstrap = Y.encodeStateAsUpdate(doc)
                        if (bootstrap.byteLength > 0) {
                          console.log('[useCrdtContent] ⏱️ Backup timeout - sending seeded state to relay:', bootstrap.byteLength, 'bytes')
                          ws.send(bootstrap)
                        }
                      } catch (encodeErr) {
                        console.error('[useCrdtContent] Failed to send seeded state on timeout:', encodeErr)
                      }
                    }
                  } catch (e) {
                    console.error('[useCrdtContent] Failed to apply seed on timeout:', e)
                  }
                } else {
                  console.log('[useCrdtContent] ⏱️ Backup timeout - no seed to apply (relay silent)')
                }
              }

              isInitializing = false
              if (contentRef.current.dbLoadTimeout) {
                contentRef.current.dbLoadTimeout = null
              }
              console.log('[useCrdtContent] ✅ Initialization complete after timeout (relay silent)')
            }
          }, backupTimeoutMs)
          
          // Store timeout so it can be cleaned up
          contentRef.current.dbLoadTimeout = backupTimeout
        }

        ws.onerror = (err) => {
          console.error('[useCrdtContent] WebSocket error for challenge', currentChallengeId, ':', err)
        }

        ws.onclose = () => {
          console.log('[useCrdtContent] ❌ WebSocket closed for challenge:', currentChallengeId)
        }

        // Setup cleanup function
        cleanupFn = () => {
          console.log('[useCrdtContent] 🧹 Cleaning up CRDT resources for challenge:', currentChallengeId)
          isMountedLocal = false
          
          // Clear DB load timeout if pending
          if (contentRef.current.dbLoadTimeout) {
            clearTimeout(contentRef.current.dbLoadTimeout)
            contentRef.current.dbLoadTimeout = null
          }
          
          try {
            ytext.unobserve(handleUpdate)
          } catch (e) {
            console.warn('[useCrdtContent] Cleanup - unobserve failed:', e)
          }
          try {
            if (handleDocUpdate) {
              doc.off('update', handleDocUpdate)
            }
          } catch (e) {
            console.warn('[useCrdtContent] Cleanup - doc.off failed:', e)
          }
          try {
            ws.close()
          } catch (e) {
            console.warn('[useCrdtContent] Cleanup - ws.close failed:', e)
          }
          console.log('[useCrdtContent] ✅ Cleanup complete for challenge:', currentChallengeId)
        }
      } catch (err) {
        console.error('[useCrdtContent] ❌ Initialization failed:', err)
      }
    }

    // Start initialization and setup cleanup
    initialize().catch((err) => {
      console.error('[useCrdtContent] ❌ Initialization promise rejected:', err)
    })

    return () => {
      cleanupFn?.()
    }
  }, [enabled, sessionId, challengeId, contentType])

  const updateContent = useCallback(
    (newContent: string) => {
      const ytext = contentRef.current.content
      if (!ytext) {
        console.warn('[useCrdtContent] updateContent: Y.Text not available')
        return
      }

      const current = ytext.toString()
      if (current === newContent) {
        return
      }

      console.log('[useCrdtContent] ✏️ updateContent:', { from: current.substring(0, 30), to: newContent.substring(0, 30) })

      const doc = contentRef.current.doc
      if (doc) {
        doc.transact(() => {
          // Find common prefix
          let i = 0
          while (i < current.length && i < newContent.length && current[i] === newContent[i]) {
            i++
          }

          const deleteCount = current.length - i
          if (deleteCount > 0) {
            ytext.delete(i, deleteCount)
          }

          const insertText = newContent.substring(i)
          if (insertText.length > 0) {
            ytext.insert(i, insertText)
          }
        })
      }
    },
    [],
  )

  const updateLanguage = useCallback(
    (newLanguage: string) => {
      console.log('[useCrdtContent] updateLanguage:', newLanguage)
      setLanguage(newLanguage)
      // Language is not persisted in CRDT, handled separately via Socket.IO or DB
    },
    [],
  )

  return {
    content,
    language,
    updateContent,
    updateLanguage,
    contentRef: contentRef.current,
  }
}
