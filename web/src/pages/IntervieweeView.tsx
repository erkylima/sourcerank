import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useSession } from '@/context/SessionContext'
import { Challenge } from '@/types'
import CodeEditor from '@/components/Editor/CodeEditor'
import ExecutionTerminal from '@/components/Terminal/ExecutionTerminal'
import ChallengeView from '@/components/Challenge/ChallengeView'
import apiService from '@/services/api'
import executionService from '@/services/execution.service'
import '@/styles/Interview.css'

const LANGUAGE_STARTERS = {
  python: '# Escreva seu código aqui\nprint("Hello, World!")',
  javascript: '// Escreva seu código aqui\nconsole.log("Hello, World!")',
  typescript: '// Escreva seu código aqui\nconsole.log("Hello, World!")',
  java: `public class Solution {
    public static void main(String[] args) {
        // Escreva seu código aqui
        System.out.println("Hello, World!");
    }
}`,
  go: `import (
\t"fmt"
)

func main() {
\t// Escreva seu código aqui
\tfmt.Println("Hello, World!")
}`,
  csharp: `using System;

public class Solution {
    public static void Main() {
        // Escreva seu código aqui
        Console.WriteLine("Hello, World!");
    }
}`,
}

export const IntervieweeView: React.FC = () => {
  const { user, logout } = useAuth()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { currentChallengeIndex } = useSession()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [syncedChallengeIndex, setSyncedChallengeIndex] = useState(0)
  const [code, setCode] = useState(LANGUAGE_STARTERS.python)
  const [language, setLanguage] = useState('python')
  const [logs, setLogs] = useState('')
  const [isExecuting, setIsExecuting] = useState(false)
  const [currentExecutionId, setCurrentExecutionId] = useState<string | null>(null)
  const navigate = useNavigate()
  const currentExecutionIdRef = useRef<string | null>(null)
  const joinedExecutionIdRef = useRef<string | null>(null)
  const lastBroadcastedCodeRef = useRef<{ code: string; language: string } | null>(null)
  const pendingCodeUpdateRef = useRef<{ code: string; language: string } | null>(null)
  const currentCodeRef = useRef(LANGUAGE_STARTERS.python)
  const currentLanguageRef = useRef('python')

  useEffect(() => {
    loadChallenges()
    
    // Ensure socket is connected
    const socket = executionService.connect()
    console.log(`[IntervieweeView] Socket connected: ${socket?.connected}`)
    
    // Join session room immediately
    if (sessionId && socket) {
      socket.emit('join-session', sessionId)
      console.log(`[IntervieweeView] Joined session: ${sessionId}`)
    }

    // Register session listeners immediately after connecting
    if (!sessionId || !socket) {
      return () => {
        // Don't disconnect on unmount - keep connection alive for multiple executions
      }
    }

    console.log(`[IntervieweeView] Setting up session listeners for ${sessionId}`)

    // Listen for code updates from other users
    const handleCodeUpdate = (payload: any) => {
      console.log(`[IntervieweeView] Received code update:`, payload)
      // Don't reprocess our own broadcasts
      if (lastBroadcastedCodeRef.current?.code === payload.code && 
          lastBroadcastedCodeRef.current?.language === payload.language) {
        console.log(`[IntervieweeView] Ignoring own broadcast`)
        return
      }
      
      // Store both code and language to apply together
      if (payload.code !== undefined && payload.language) {
        pendingCodeUpdateRef.current = { code: payload.code, language: payload.language }
        // Update both atomically
        setCode(payload.code)
        setLanguage(payload.language)
      } else if (payload.code !== undefined) {
        setCode(payload.code)
      } else if (payload.language) {
        setLanguage(payload.language)
      }
    }

    // Listen for challenge navigation from other users
    const handleChallengeChange = (payload: any) => {
      console.log(`[IntervieweeView] Received challenge change:`, payload)
      if (payload.index !== undefined && payload.index >= 0 && payload.index < challenges.length) {
        setSyncedChallengeIndex(payload.index)
        // Reset to starter code for current language when challenge changes
        const starter = LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] || '# Escreva seu código aqui'
        setCode(starter)
        setLogs('')
      }
    }

    // Listen for execution started from other user
    const handleExecutionStarted = (payload: any) => {
      console.log(`[IntervieweeView] Received execution started:`, payload)
      const { executionId } = payload
      if (executionId) {
        // Update state to trigger listener registration in useEffect
        // The useEffect will handle joining the execution room
        currentExecutionIdRef.current = executionId
        setCurrentExecutionId(executionId)
        setIsExecuting(true)
        setLogs('') // Clear logs for new execution
      }
    }

    // Listen for execution completed from other user
    const handleExecutionCompleted = (payload: any) => {
      console.log(`[IntervieweeView] Received execution completed:`, payload)
      setIsExecuting(false)
    }

    // Register all listeners
    socket.on(`session-code-changed-${sessionId}`, handleCodeUpdate)
    socket.on(`session-challenge-changed-${sessionId}`, handleChallengeChange)
    socket.on(`session-execution-started-${sessionId}`, handleExecutionStarted)
    socket.on(`session-execution-completed-${sessionId}`, handleExecutionCompleted)

    console.log(`[IntervieweeView] ✓ Listeners registered for session ${sessionId}`)

    return () => {
      console.log(`[IntervieweeView] Cleaning up listeners for ${sessionId}`)
      socket.off(`session-code-changed-${sessionId}`, handleCodeUpdate)
      socket.off(`session-challenge-changed-${sessionId}`, handleChallengeChange)
      socket.off(`session-execution-started-${sessionId}`, handleExecutionStarted)
      socket.off(`session-execution-completed-${sessionId}`, handleExecutionCompleted)
    }
  }, [sessionId, challenges.length])

  // Reset joinedExecutionIdRef when currentExecutionId changes to a new value
  useEffect(() => {
    if (currentExecutionId === null) {
      joinedExecutionIdRef.current = null
    }
  }, [currentExecutionId])

  // Keep refs in sync with state for reliable access in callbacks
  useEffect(() => {
    currentCodeRef.current = code
  }, [code])

  useEffect(() => {
    currentLanguageRef.current = language
  }, [language])


  // Handle language change - always update to new starter
  const handleLanguageChange = useCallback((newLanguage: string) => {
    console.log(`[IntervieweeView] User changed language to ${newLanguage}`)
    
    // Always update to the new language's starter code
    const newStarter = LANGUAGE_STARTERS[newLanguage as keyof typeof LANGUAGE_STARTERS] || '# Escreva seu código aqui'
    setCode(newStarter)
    setLanguage(newLanguage)
    
    console.log(`[IntervieweeView] Updated to ${newLanguage} starter`)
  }, [])

  // Broadcast code changes to session
  useEffect(() => {
    if (sessionId) {
      const socket = executionService.getSocket()
      if (socket) {
        // Store what we're broadcasting to avoid reprocessing
        lastBroadcastedCodeRef.current = { code, language }
        socket.emit('session-event', {
          sessionId,
          event: 'code-changed',
          data: { code, language },
        })
      }
    }
  }, [code, language, sessionId])

  // Listener para logs de execução
  useEffect(() => {
    if (!isExecuting || !sessionId || !currentExecutionId) return

    const socket = executionService.getSocket()
    if (!socket) return

    // Only join if we haven't joined this execution yet
    if (joinedExecutionIdRef.current !== currentExecutionId) {
      socket.emit('join-execution', currentExecutionId)
      joinedExecutionIdRef.current = currentExecutionId
      console.log(`[IntervieweeView] Joined execution room: ${currentExecutionId}`)
    }

    console.log(`[IntervieweeView] Setting up execution log listeners for ${currentExecutionId}`)

    const handleExecutionLog = (payload: any) => {
      console.log(`[IntervieweeView] Received execution log:`, payload)
      const message = payload.message || payload.data || ''
      setLogs((prev) => prev + message + '\n')
    }

    const handleExecutionCompleted = (payload: any) => {
      console.log(`[IntervieweeView] Execution completed from logs listener:`, payload)
      setIsExecuting(false)
      setCurrentExecutionId(null)
      // Don't reset joinedExecutionIdRef here - it's reset when currentExecutionId changes
    }

    // Register listeners
    socket.on(`execution-log-${currentExecutionId}`, handleExecutionLog)
    socket.on(`execution-completed-${currentExecutionId}`, handleExecutionCompleted)

    console.log(`[IntervieweeView] ✓ Execution log listeners registered for ${currentExecutionId}`)

    return () => {
      console.log(`[IntervieweeView] Cleaning up execution log listeners for ${currentExecutionId}`)
      socket.off(`execution-log-${currentExecutionId}`, handleExecutionLog)
      socket.off(`execution-completed-${currentExecutionId}`, handleExecutionCompleted)
    }
  }, [isExecuting, sessionId, currentExecutionId])

  const loadChallenges = async () => {
    try {
      const response = await apiService.getChallenges()
      setChallenges(response.data.challenges || [])
    } catch (err) {
      console.error('Erro ao carregar desafios:', err)
      setChallenges([])
    }
  }

  const handleRun = async () => {
    setIsExecuting(true)
    setLogs('')
    
    try {
      if (!currentChallenge) {
        setLogs('Erro: Nenhum desafio selecionado\n')
        setIsExecuting(false)
        return
      }
      
      const response = await apiService.runCode(language, code, sessionId, currentChallenge.id)
      const executionId = response.data.execution.id
      
      // Update both ref and state to track current execution
      // This will trigger the execution log listeners useEffect which will join room and register listeners
      currentExecutionIdRef.current = executionId
      setCurrentExecutionId(executionId)
    } catch (err) {
      setLogs(`Erro: ${err}\n`)
      setIsExecuting(false)
    }
  }

  const handleNext = () => {
    if (syncedChallengeIndex < challenges.length - 1) {
      const newIndex = syncedChallengeIndex + 1
      setSyncedChallengeIndex(newIndex)
      const starter = LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] || '# Escreva seu código aqui'
      setCode(starter)
      setLogs('')

      // Broadcast challenge change to session
      if (sessionId) {
        const socket = executionService.getSocket()
        if (socket) {
          socket.emit('session-event', {
            sessionId,
            event: 'challenge-changed',
            data: { index: newIndex, challengeId: challenges[newIndex]?.id },
          })
        }
      }
    }
  }

  const handlePrevious = () => {
    if (syncedChallengeIndex > 0) {
      const newIndex = syncedChallengeIndex - 1
      setSyncedChallengeIndex(newIndex)
      const starter = LANGUAGE_STARTERS[language as keyof typeof LANGUAGE_STARTERS] || '# Escreva seu código aqui'
      setCode(starter)
      setLogs('')

      // Broadcast challenge change to session
      if (sessionId) {
        const socket = executionService.getSocket()
        if (socket) {
          socket.emit('session-event', {
            sessionId,
            event: 'challenge-changed',
            data: { index: newIndex, challengeId: challenges[newIndex]?.id },
          })
        }
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const currentChallenge = challenges[syncedChallengeIndex]

  return (
    <div className="interview-session">
      <div className="session-header">
        <h1>Sessão de Entrevista</h1>
        <div className="header-actions">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-danger">
            Logout
          </button>
        </div>
      </div>

      <div className="session-container-full">
        <div className="challenge-display">
          <ChallengeView challenge={currentChallenge} />
          <div className="navigation-buttons">
            <button onClick={handlePrevious} disabled={syncedChallengeIndex === 0} className="btn-secondary">
              ← Anterior
            </button>
            <span className="challenge-counter">
              Desafio {syncedChallengeIndex + 1} de {challenges.length}
            </span>
            <button
              onClick={handleNext}
              disabled={syncedChallengeIndex === challenges.length - 1}
              className="btn-secondary"
            >
              Próximo →
            </button>
          </div>
        </div>

        <div className="session-editor-full">
          <div className="editor-header">
            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="language-select">
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="go">Go</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="csharp">C#</option>
            </select>
            <button onClick={handleRun} disabled={isExecuting} className="btn-primary">
              {isExecuting ? 'Executando...' : 'Executar'}
            </button>
          </div>
          <div className="editor-and-terminal">
            <CodeEditor code={code} language={language} onChange={setCode} />
            <ExecutionTerminal logs={logs} isExecuting={isExecuting} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default IntervieweeView
