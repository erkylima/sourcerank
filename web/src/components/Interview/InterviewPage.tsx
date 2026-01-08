import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ExecutionTerminal } from '@/components/Terminal/ExecutionTerminal'
import { CodeEditor } from '@/components/Editor/CodeEditor'
import ChallengeView from '@/components/Challenge/ChallengeView'
import ChallengeNavigator from '@/components/Challenge/ChallengeNavigator'
import { Challenge } from '@/types'
import { useUIStore } from '@/stores/useUIStore'
import apiService from '@/services/api'
import { executionService } from '@/services/execution.service'
import '@/styles/Interview.css'

interface InterviewPageProps {
  role: 'interviewer' | 'interviewee'
  showChallengeNavigator?: boolean
  showExecutionTerminal?: boolean
}

/**
 * Simplified Interview Page with new architecture
 * Uses Zustand for UI state + TanStack Query for server state (via CodeEditor)
 */
export const InterviewPage: React.FC<InterviewPageProps> = ({
  role,
  showChallengeNavigator = true,
  showExecutionTerminal = true,
}) => {
  const { sessionId } = useParams<{ sessionId: string }>()
  
  // UI State from Zustand
  const { currentChallengeIndex, setCurrentChallengeIndex } = useUIStore()
  
  // Refs to control CodeEditor functions
  const updateLanguageRef = useRef<((lang: string) => void) | null>(null)
  const updateContentRef = useRef<((content: string) => void) | null>(null)
  const currentCodeRef = useRef<string>('')
  const currentStartedRef = useRef<boolean>(false)
  
  // Local state
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [language, setLanguage] = useState('python')
  const [logs, setLogs] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)

  // Get current challenge from state
  const currentChallenge = challenges[currentChallengeIndex] || null

  // Load challenges AND recover/initialize current challenge
  useEffect(() => {
    const load = async () => {
      try {
        console.log('[InterviewPage] Loading challenges and current challenge state...')
        
        // 1. Load all challenges
        const challengeResponse = await apiService.getChallenges()
        const loadedChallenges = challengeResponse.data.challenges || []
        setChallenges(loadedChallenges)
        console.log('[InterviewPage] Loaded challenges:', loadedChallenges.length)
        
        if (loadedChallenges.length === 0 || !sessionId) return
        
        // 2. Get current challenge from database
        const sessionResponse = await apiService.getSession(sessionId)
        const dbCurrentChallengeId = sessionResponse.data.session.current_challenge_id
        
        console.log('[InterviewPage] DB response:', sessionResponse.data)
        console.log('[InterviewPage] DB current_challenge_id:', dbCurrentChallengeId)
        
        if (dbCurrentChallengeId) {
          // Has saved challenge - use it
          const challengeIndex = loadedChallenges.findIndex(c => c.id === dbCurrentChallengeId)
          if (challengeIndex !== -1) {
            console.log('[InterviewPage] Using saved challenge, index:', challengeIndex)
            setCurrentChallengeIndex(challengeIndex)
          } else {
            // Saved challenge not found, default to first
            console.log('[InterviewPage] Saved challenge not found, defaulting to 0')
            setCurrentChallengeIndex(0)
          }
        } else {
          // No saved challenge - save first one
          const firstChallenge = loadedChallenges[0]
          console.log('[InterviewPage] No saved challenge, saving first:', firstChallenge.id)
          await apiService.updateSessionChallenge(sessionId, firstChallenge.id)
          setCurrentChallengeIndex(0)
        }
      } catch (err) {
        console.error('[InterviewPage] Error loading challenges:', err)
        setCurrentChallengeIndex(0)
      }
    }
    
    load()
  }, [sessionId])

  // Recover preferred language on mount/sessionId change
  useEffect(() => {
    if (!sessionId) return

    const recoverLanguage = async () => {
      try {
        console.log('[InterviewPage] Recovering preferred language from session...')
        const lang = await apiService.getPreferredLanguage(sessionId)
        console.log('[InterviewPage] ✅ Recovered language:', lang)
        setLanguage(lang)
      } catch (err) {
        console.error('[InterviewPage] Error recovering language:', err)
        // Keep current language as fallback
      }
    }

    recoverLanguage()
  }, [sessionId])

  // When challenge changes, also recover the preferred language for that challenge
  useEffect(() => {
    if (!sessionId || !currentChallenge) return

    const recoverLanguageForChallenge = async () => {
      try {
        console.log('[InterviewPage] Recovering language for challenge:', currentChallenge.id)
        const lang = await apiService.getPreferredLanguage(sessionId)
        console.log('[InterviewPage] ✅ Challenge language:', lang)
        setLanguage(lang)
      } catch (err) {
        console.error('[InterviewPage] Error recovering challenge language:', err)
      }
    }

    recoverLanguageForChallenge()
  }, [sessionId, currentChallenge])

  // Join session room
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    socket.emit('join-session', sessionId)

    return () => {
      socket.emit('leave-session', sessionId)
    }
  }, [sessionId])

  // Listen for challenge navigation from peers
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    const handleChallengeChange = (payload: any) => {
      if (payload.index !== undefined && payload.index < challenges.length) {
        setCurrentChallengeIndex(payload.index)
        setLogs('')
      }
    }

    const handleLanguageChange = (payload: any) => {
      if (payload.language) {
        console.log('[InterviewPage] 📥 Received language change from peer:', payload.language)
        setLanguage(payload.language)
        
        // Update language - hook will reload content for this language
        if (updateLanguageRef.current) {
          updateLanguageRef.current(payload.language)
        }
      }
    }

    socket.on(`session-challenge-changed-${sessionId}`, handleChallengeChange)
    socket.on(`session-language-changed-${sessionId}`, handleLanguageChange)

    return () => {
      socket.off(`session-challenge-changed-${sessionId}`, handleChallengeChange)
      socket.off(`session-language-changed-${sessionId}`, handleLanguageChange)
    }
  }, [sessionId, challenges.length, setCurrentChallengeIndex])

  // Setup execution logging
  useEffect(() => {
    if (!sessionId) return

    const socket = executionService.connect()
    if (!socket) return

    const handleExecutionStarted = (payload: any) => {
      const { executionId } = payload
      socket.emit('join-execution', executionId)

      const handleLog = (logPayload: any) => {
        const message = logPayload.message || logPayload.data || ''
        setLogs((prev) => prev + message + '\n')
      }

      const handleCompleted = () => {
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

  // Handle language change with starter logic
  const handleLanguageChange = useCallback((newLanguage: string) => {
    console.log('[InterviewPage] 🔄 Language change:', { from: language, to: newLanguage })
    
    const previousLanguage = language
    const previousContent = currentCodeRef.current

    setLanguage(newLanguage)
    
    // Recover content for new language from BD (will auto-load starter if not exists)
    if (sessionId && currentChallenge) {
      console.log('[InterviewPage] 📥 Loading content for new language:', newLanguage)
      apiService.getChallengeContent(sessionId, currentChallenge.id, newLanguage)
        .then(response => {
          console.log('[InterviewPage] ✅ Loaded content for language:', { language: newLanguage, length: response.data.content.length })
          // CodeEditor hook will automatically use this when language changes in queryKey
        })
        .catch(err => {
          console.error('[InterviewPage] Failed to load content for new language:', err)
        })
    }

    // Update language - hook will reload content for this language
    // If no content exists for this language → CodeEditor auto-applies starter
    if (updateLanguageRef.current) {
      updateLanguageRef.current(newLanguage)
    }

    // Save preferred language to session
    if (sessionId) {
      apiService.updatePreferredLanguage(sessionId, newLanguage).catch(err => {
        console.error('[InterviewPage] Failed to save preferred language:', err)
      })
    }

    // Persist content with history (language switch scenario)
    // Only persist if user actually wrote something (not just starter)
    if (sessionId && currentChallenge && previousContent && previousContent.trim() !== '' && currentStartedRef.current) {
      console.log('[InterviewPage] 💾 Persisting language switch:', { from: previousLanguage, to: newLanguage })
      apiService.persistContent(
        sessionId,
        String(currentChallenge.id),
        previousContent,  // Save old language content
        previousLanguage, // In old language
      ).catch(err => {
        console.error('[InterviewPage] Failed to persist language change:', err)
      })
    } else {
      console.log('[InterviewPage] ⏭️ Skipping persist (no real content):', { 
        hasContent: !!previousContent, 
        isNotEmpty: previousContent?.trim() !== '', 
        started: currentStartedRef.current 
      })
    }
    
    // Broadcast to peers
    const socket = executionService.connect()
    if (socket && sessionId) {
      socket.emit(`session-language-changed-${sessionId}`, { language: newLanguage })
    }
  }, [language, sessionId, currentChallenge])

  const handleNavigate = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= challenges.length) return

    // Persist current challenge content BEFORE navigating (using current language)
    // Only persist if user actually wrote something (not just starter)
    if (sessionId && currentChallenge && currentCodeRef.current && currentCodeRef.current.trim() !== '' && currentStartedRef.current) {
      console.log('[InterviewPage] 📸 Persisting challenge before navigate:', currentChallenge.id)
      apiService.persistContent(
        sessionId,
        String(currentChallenge.id),
        currentCodeRef.current, // Save current content
        language                // With current language
      ).catch(err => {
        console.error('[InterviewPage] Failed to persist before navigate:', err)
      })
    }

    // Force save current challenge content before navigating
    if (updateContentRef.current && currentCodeRef.current && sessionId && currentChallenge) {
      console.log('[InterviewPage] 💾 Force saving before navigate:', currentChallenge.id)
      updateContentRef.current(currentCodeRef.current)
    }

    // Update current challenge in database for persistence on page reload
    const newChallenge = challenges[newIndex]
    if (newChallenge && sessionId) {
      // Recover preferred language for new challenge
      apiService.getPreferredLanguage(sessionId).then(lang => {
        console.log('[InterviewPage] 🔄 Recovered language for new challenge:', lang)
        setLanguage(lang)
      }).catch(err => {
        console.error('[InterviewPage] Failed to recover language:', err)
      })

      console.log('[InterviewPage] 📌 Updating current challenge in DB:', newChallenge.id)
      apiService.updateSessionChallenge(sessionId, newChallenge.id).catch(err => {
        console.error('[InterviewPage] Failed to update session challenge:', err)
      })
    }

    setCurrentChallengeIndex(newIndex)
    setLogs('')

    // Broadcast to peers
    const socket = executionService.connect()
    if (socket && sessionId) {
      socket.emit(`session-challenge-changed-${sessionId}`, { index: newIndex })
    }
  }

  const handleExecute = async () => {
    if (!sessionId || !currentChallenge) return

    setIsExecuting(true)
    setLogs('')

    try {
      const response = await apiService.runCode(
        language,
        currentCodeRef.current, // Use code from ref
        sessionId,
        String(currentChallenge.id)
      )
      const executionId = response.data.execution.id

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
  }

  return (
    <div className="interview-page">
      {showChallengeNavigator && (
        <div className="sidebar">
          <ChallengeNavigator
            challenges={challenges}
            currentIndex={currentChallengeIndex}
            onNext={() => handleNavigate(currentChallengeIndex + 1)}
            onPrevious={() => handleNavigate(currentChallengeIndex - 1)}
            onSelect={handleNavigate}
            canAdvance={true}
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
            <button onClick={() => handleNavigate(currentChallengeIndex - 1)} disabled={currentChallengeIndex === 0}>
              ← Anterior
            </button>
            <span className="progress">{currentChallengeIndex + 1} / {challenges.length}</span>
            <button onClick={() => handleNavigate(currentChallengeIndex + 1)} disabled={currentChallengeIndex === challenges.length - 1}>
              Próximo →
            </button>
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
          {currentChallenge ? (
            <CodeEditor
              sessionId={sessionId}
              challengeId={currentChallenge.id}
              language={language}
              onLanguageChange={setLanguage}
              onUpdateLanguageRef={(fn) => { updateLanguageRef.current = fn }}
              onUpdateContentRef={(fn) => { updateContentRef.current = fn }}
              onContentChange={(content) => { currentCodeRef.current = content }}
              onStartedChange={(started) => { currentStartedRef.current = started }}
            />
          ) : (
            <div className="editor-loading">Loading challenge...</div>
          )}
          {showExecutionTerminal && <ExecutionTerminal logs={logs} isExecuting={isExecuting} />}
        </div>
      </div>
    </div>
  )
}

export default InterviewPage
