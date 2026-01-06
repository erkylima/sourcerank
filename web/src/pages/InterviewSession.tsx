import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import InterviewPage from '@/components/Interview/InterviewPage'
import '@/styles/Interview.css'

/**
 * Interview Session Page (Interviewer View)
 * Uses the unified InterviewPage component
 * Open/Closed Principle: extensible without modification
 */
export const InterviewSession: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="interview-container">
      <header className="interview-header">
        <h1>Entrevista</h1>
        <div className="header-right">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Sair
          </button>
        </div>
      </header>
      <InterviewPage role="interviewer" showChallengeNavigator={true} showExecutionTerminal={true} />
    </div>
  )
}

export default InterviewSession
