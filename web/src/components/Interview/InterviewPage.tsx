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

  // Load challenges
  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiService.getChallenges()
        const loadedChallenges = response.data.challenges || []
        setChallenges(loadedChallenges)
        
        // Validate currentChallengeIndex
        if (currentChallengeIndex >= loadedChallenges.length) {
          console.warn('[InterviewPage] Current challenge index out of bounds, resetting to 0')
          setCurrentChallengeIndex(0)
        }
      } catch (err) {
        console.error('Failed to load challenges:', err)
      }
    }
    load()
  }, [])

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

  const currentChallenge = challenges[currentChallengeIndex] || null

  // Handle language change with starter logic
  const handleLanguageChange = useCallback((newLanguage: string) => {
    console.log('[InterviewPage] 🔄 Language change:', { from: language, to: newLanguage })
    
    setLanguage(newLanguage)
    
    // Update language - hook will reload content for this language
    // If no content exists for this language → CodeEditor auto-applies starter
    if (updateLanguageRef.current) {
      updateLanguageRef.current(newLanguage)
    }
    
    // Broadcast to peers
    const socket = executionService.connect()
    if (socket && sessionId) {
      socket.emit(`session-language-changed-${sessionId}`, { language: newLanguage })
    }
  }, [language, sessionId])

  const handleNavigate = (newIndex: number) => {
    if (newIndex < 0 || newIndex >= challenges.length) return

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
