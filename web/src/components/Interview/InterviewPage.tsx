import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { ExecutionTerminal } from '@/components/Terminal/ExecutionTerminal'
import { CodeEditor } from '@/components/Editor/CodeEditor'
import ChallengeView from '@/components/Challenge/ChallengeView'
import ChallengeNavigator from '@/components/Challenge/ChallengeNavigator'
import { Challenge } from '@/types'
import { useSession } from '@/context/SessionContext'
import { LANGUAGE_STARTERS } from '@/constants/languages'
import apiService from '@/services/api'
import sessionContentService from '@/services/session-content.service'
import { executionService } from '@/services/execution.service'
import crdtService from '@/services/crdt.service'
import '@/styles/Interview.css'

interface InterviewPageProps {
  role: 'interviewer' | 'interviewee'
  showChallengeNavigator?: boolean
  showExecutionTerminal?: boolean
}

/**
 * Unified Interview Page Component
 * Used by both InterviewSession (interviewer) and IntervieweeView (interviewee)
 * Implements Open/Closed Principle: extensible without modification
 */
export const InterviewPage: React.FC<InterviewPageProps> = ({
  role,
  showChallengeNavigator = true,
  showExecutionTerminal = true,
}) => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { currentChallengeIndex } = useSession()
  const enableCrdt = import.meta.env.VITE_ENABLE_CRDT === 'true'
  const updateContentRef = useRef<((content: string) => void) | null>(null)
  const updateLanguageRef = useRef<((language: string) => void) | null>(null)

  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [code, setCode] = useState(LANGUAGE_STARTERS.python)
  const [language, setLanguage] = useState('python')
  const [logs, setLogs] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  // Load challenges
  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiService.getChallenges()
        setChallenges(response.data.challenges || [])
        console.log('[InterviewPage] Loaded challenges:', response.data.challenges?.length || 0)
      } catch (err) {
        console.error('Failed to load challenges:', err)
      }
    }
    load()
  }, [])

  // Join session room for Socket.IO events
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    socket.emit('join-session', sessionId)
    console.log('[InterviewPage] Joined session room:', sessionId)

    return () => {
      socket.emit('leave-session', sessionId)
    }
  }, [sessionId])

  // Derived state for current challenge
  const currentChallenge = challenges[currentIndex] || null

  // When CRDT is enabled and currentIndex changes, show starter code
  // (Socket.io listeners don't fire when CRDT is enabled)
  useEffect(() => {
    if (!enableCrdt || !challenges[currentIndex]) return
    
    const starter = LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] || LANGUAGE_STARTERS.python
    setCode(starter)
    console.log('[InterviewPage] CRDT mode: showing starter for challenge', { index: currentIndex, language })
  }, [currentIndex, language, enableCrdt, challenges.length])

  // Setup socket listeners for challenge navigation (for both CRDT and Socket.io modes)
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    const handleChallengeChange = (payload: any) => {
      if (payload.index !== undefined && payload.index < challenges.length) {
        console.log('[InterviewPage] 📥 Challenge changed via socket:', payload)
        setCurrentIndex(payload.index)
        const starter = LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] || LANGUAGE_STARTERS.python
        setCode(starter)
        setLogs('')
      } else {
        console.warn('[InterviewPage] ⚠️ Invalid challenge payload:', payload)
      }
    }

    const handleLanguageChange = (payload: any) => {
      if (payload.language) {
        console.log('[InterviewPage] 📥 Language changed via socket:', payload.language)
        setLanguage(payload.language)
        const starter = LANGUAGE_STARTERS[payload.language as keyof typeof LANGUAGE_STARTERS] || LANGUAGE_STARTERS.python
        setCode(starter)
      }
    }

    socket.on(`session-challenge-changed-${sessionId}`, handleChallengeChange)
    socket.on(`session-language-changed-${sessionId}`, handleLanguageChange)

    console.log('[InterviewPage] 📥 Registered listeners:', {
      challengeListener: `session-challenge-changed-${sessionId}`,
      languageListener: `session-language-changed-${sessionId}`
    })

    return () => {
      socket.off(`session-challenge-changed-${sessionId}`, handleChallengeChange)
      socket.off(`session-language-changed-${sessionId}`, handleLanguageChange)
    }
  }, [sessionId, challenges.length, language])

  // Broadcast code changes to other users (Socket.io, only when CRDT disabled)
  useEffect(() => {
    if (!sessionId || enableCrdt) return

    const socket = executionService.getSocket()
    if (!socket) return

    socket.emit('session-event', {
      sessionId,
      event: 'code-changed',
      data: { code, language },
    })
  }, [code, language, sessionId, enableCrdt])

  // Setup execution logging listeners - both clients should receive logs
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    // When another client starts execution, join that execution room and setup log listeners
    const handleExecutionStarted = (payload: any) => {
      const { executionId } = payload
      console.log('[InterviewPage] Execution started, joining execution room:', executionId)
      
      socket.emit('join-execution', executionId)

      const handleLog = (logPayload: any) => {
        const message = logPayload.message || logPayload.data || ''
        console.log('[InterviewPage] Received log from execution:', message.substring(0, 50))
        setLogs((prev) => prev + message + '\n')
      }

      const handleCompleted = () => {
        console.log('[InterviewPage] Execution completed')
        setIsExecuting(false)
        socket.off(`execution-log-${executionId}`, handleLog)
        socket.off(`execution-completed-${executionId}`, handleCompleted)
        socket.emit('leave-execution', executionId)
      }

      socket.on(`execution-log-${executionId}`, handleLog)
      socket.on(`execution-completed-${executionId}`, handleCompleted)
    }

    socket.on(`session-execution-started-${sessionId}`, handleExecutionStarted)

    return () => {
      socket.off(`session-execution-started-${sessionId}`, handleExecutionStarted)
    }
  }, [sessionId])

  const handleCodeUpdate = useCallback((newCode: string) => {
    // Always update local state for display
    setCode(newCode)
    console.log('[InterviewPage] Code updated (useCrdt:', enableCrdt, '): ', newCode.substring(0, 50))
  }, [enableCrdt])

  const handleLanguageChange = useCallback((newLanguage: string) => {
    console.log('[InterviewPage] 🔄 Changing language:', { from: language, to: newLanguage, note: 'Previous code is preserved in DB' })
    const starter = LANGUAGE_STARTERS[newLanguage as keyof typeof LANGUAGE_STARTERS] || LANGUAGE_STARTERS.python
    setCode(starter)
    setLanguage(newLanguage)
    
    // If CRDT is enabled, update language via CRDT
    if (enableCrdt && updateLanguageRef.current) {
      console.log('[InterviewPage] 📡 Updating language via CRDT:', newLanguage)
      updateLanguageRef.current(newLanguage)
    } else {
      // Otherwise broadcast language change to other users via Socket.IO
      const socket = executionService.connect()
      if (socket && sessionId) {
        socket.emit(`session-language-changed-${sessionId}`, { language: newLanguage })
        console.log('[InterviewPage] 📡 Broadcasted language change to peers:', newLanguage)
      }
    }
  }, [sessionId, enableCrdt, language])

  const handleExecute = useCallback(async () => {
    if (!sessionId || !challenges[currentIndex]) return

    setIsExecuting(true)
    setLogs('')

    try {
      const response = await apiService.runCode(
        language,
        code,
        sessionId,
        challenges[currentIndex].id
      )
      const executionId = response.data.execution.id

      // Setup execution log listener
      const socket = executionService.connect()
      if (socket) {
        socket.emit('join-execution', executionId)

        const handleLog = (payload: any) => {
          const message = payload.message || payload.data || ''
          setLogs((prev) => prev + message + '\n')
        }

        const handleCompleted = () => {
          setIsExecuting(false)
          socket.off(`execution-log-${executionId}`, handleLog)
          socket.off(`execution-completed-${executionId}`, handleCompleted)
        }

        socket.on(`execution-log-${executionId}`, handleLog)
        socket.on(`execution-completed-${executionId}`, handleCompleted)
      }
    } catch (err) {
      setLogs(`Erro: ${err}\n`)
      setIsExecuting(false)
    }
  }, [sessionId, challenges, currentIndex, language, code])

  const canNavigate = true // Both interviewer and interviewee can navigate

  // Log current state for debugging
  useEffect(() => {
    if (currentChallenge) {
      console.log('[InterviewPage] Current challenge:', { 
        id: currentChallenge.id, 
        title: currentChallenge.title,
        index: currentIndex,
        role,
        sessionId
      })
    }
  }, [currentIndex, currentChallenge, role, sessionId])

  return (
    <div className="interview-page">
      {console.log('[InterviewPage] RENDER - canNavigate:', canNavigate, 'currentIndex:', currentIndex, 'challenges.length:', challenges.length)}
      {showChallengeNavigator && (
        <div className="sidebar">
          <ChallengeNavigator
            challenges={challenges}
            currentIndex={currentIndex}
            onNext={() => {}}
            onPrevious={() => {}}
            onSelect={(idx) => {
              console.log('[InterviewPage] 🟠 onSelect handler called with:', { idx, currentIndex, canNavigate })
              if (canNavigate) {
                // Save current challenge state before switching
                console.log('[InterviewPage] onSelect called for index:', idx, 'currentIndex:', currentIndex)
                if (enableCrdt && sessionId && currentChallenge?.id) {
                  console.log('[InterviewPage] Saving snapshot before navigate to:', idx)
                  // Call async function without awaiting (fire and forget)
                  crdtService.forceSnapshotSave(sessionId, String(currentChallenge.id), 'code')
                    .then(() => {
                      console.log('[InterviewPage] ✅ Snapshot saved successfully for challenge:', currentChallenge.id)
                      setCurrentIndex(idx)
                    })
                    .catch((err) => {
                      console.error('[InterviewPage] Snapshot save failed:', err)
                      // Navigate anyway
                      setCurrentIndex(idx)
                    })
                } else {
                  setCurrentIndex(idx)
                }
              } else {
                console.log('[InterviewPage] ❌ Cannot navigate - canNavigate is false')
              }
            }}
            canAdvance={canNavigate}
          />
          {currentChallenge && <ChallengeView challenge={currentChallenge} />}
        </div>
      )}

      <div className="main-content">
        <div className="header">
          <div className="role-info">
            <h1>{role === 'interviewer' ? 'Entrevistador' : 'Candidato'}</h1>
          </div>

          <div className="controls">
            {canNavigate && (
              <>
                <button onClick={async () => {
                  console.log('[BUTTON CLICK] Anterior clicked - currentIndex:', currentIndex)
                  if (currentIndex > 0) {
                    console.log('[BUTTON CLICK] Navigating backwards from', currentIndex)
                    // Save current challenge content to database
                    if (sessionId && currentChallenge?.id) {
                      console.log('[BUTTON CLICK] Saving content for challenge:', currentChallenge.id, 'language:', language)
                      try {
                        await sessionContentService.saveChallengeContent(sessionId, currentChallenge.id, code, language, 'code')
                        console.log('[BUTTON CLICK] ✅ Content saved to DB')
                      } catch (err) {
                        console.error('[BUTTON CLICK] Content save failed:', err)
                      }
                    }
                    const newIndex = currentIndex - 1
                    setCurrentIndex(newIndex)
                    // Broadcast to other users
                    const socket = executionService.connect()
                    if (socket && sessionId) {
                      const eventName = `session-challenge-changed-${sessionId}`
                      console.log('[BUTTON CLICK] 📡 Emitting event:', eventName, 'payload:', { index: newIndex })
                      socket.emit(eventName, { index: newIndex })
                      console.log('[BUTTON CLICK] 📡 Broadcasted challenge change to peers:', newIndex)
                    } else {
                      console.error('[BUTTON CLICK] ❌ Socket not available or no sessionId', { hasSocket: !!socket, hasSessionId: !!sessionId })
                    }
                  }
                }} disabled={currentIndex === 0}>
                  ← Anterior
                </button>
                <span className="progress">{currentIndex + 1} / {challenges.length}</span>
                <button onClick={async () => {
                  console.log('[BUTTON CLICK] Próximo clicked - currentIndex:', currentIndex)
                  if (currentIndex < challenges.length - 1) {
                    console.log('[BUTTON CLICK] Navigating forward from', currentIndex)
                    // Save current challenge content to database
                    if (sessionId && currentChallenge?.id) {
                      console.log('[BUTTON CLICK] Saving content for challenge:', currentChallenge.id, 'language:', language)
                      try {
                        await sessionContentService.saveChallengeContent(sessionId, currentChallenge.id, code, language, 'code')
                        console.log('[BUTTON CLICK] ✅ Content saved to DB')
                      } catch (err) {
                        console.error('[BUTTON CLICK] Content save failed:', err)
                      }
                    }
                    const newIndex = currentIndex + 1
                    setCurrentIndex(newIndex)
                    // Broadcast to other users
                    const socket = executionService.connect()
                    if (socket && sessionId) {
                      const eventName = `session-challenge-changed-${sessionId}`
                      console.log('[BUTTON CLICK] 📡 Emitting event:', eventName, 'payload:', { index: newIndex })
                      socket.emit(eventName, { index: newIndex })
                      console.log('[BUTTON CLICK] 📡 Broadcasted challenge change to peers:', newIndex)
                    } else {
                      console.error('[BUTTON CLICK] ❌ Socket not available or no sessionId', { hasSocket: !!socket, hasSessionId: !!sessionId })
                    }
                  }
                }} disabled={currentIndex === challenges.length - 1}>
                  Próximo →
                </button>
              </>
            )}
          </div>

          <div className="language-selector">
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="csharp">C#</option>
            </select>
          </div>

          {showExecutionTerminal && (
            <button onClick={handleExecute} disabled={isExecuting} className="btn-execute">
              {isExecuting ? 'Executando...' : 'Executar'}
            </button>
          )}
        </div>

        <div className="editor-section">
          <CodeEditor
            code={code}
            language={language}
            onChange={handleCodeUpdate}
            onLanguageChange={handleLanguageChange}
            useCrdt={enableCrdt}
            sessionId={sessionId}
            challengeId={currentChallenge?.id}
            onUpdateContentRef={(updateFn) => {
              updateContentRef.current = updateFn
            }}
            onUpdateLanguageRef={(updateFn) => {
              updateLanguageRef.current = updateFn
            }}
          />
          {showExecutionTerminal && <ExecutionTerminal logs={logs} isExecuting={isExecuting} />}
        </div>
      </div>
    </div>
  )
}

export default InterviewPage
