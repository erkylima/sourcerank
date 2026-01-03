import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import apiService from '@/services/api'
import '@/styles/Login.css'

export const JoinSession: React.FC = () => {
  const { user, logout } = useAuth()
  const [sessionCode, setSessionCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [waitingForApproval, setWaitingForApproval] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const navigate = useNavigate()
  const pollCountRef = useRef(0)

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await (apiService as any).requestSessionAccess(sessionCode)
      const newSessionId = response.data.session.id
      console.log('[JoinSession] Access requested, sessionId:', newSessionId)
      setSessionId(newSessionId)
      setWaitingForApproval(true)
      pollCountRef.current = 0
    } catch (err: any) {
      console.error('[JoinSession] Request error:', err)
      setError(err.message || 'Código inválido ou sessão não disponível')
    } finally {
      setLoading(false)
    }
  }

  // Polling effect - roda quando sessionId ou waitingForApproval mudam
  useEffect(() => {
    if (!waitingForApproval || !sessionId) {
      console.log('[JoinSession] Skipping polling - waitingForApproval:', waitingForApproval, 'sessionId:', sessionId)
      return
    }

    console.log('[JoinSession] Starting polling for sessionId:', sessionId)
    
    const pollSession = async () => {
      try {
        pollCountRef.current++
        console.log('[JoinSession] Poll #' + pollCountRef.current + ' for', sessionId)
        
        const response = await (apiService as any).getSession(sessionId)
        const accepted = response.data.session.interviewee_accepted
        
        console.log('[JoinSession] Poll result - accepted:', accepted)

        if (accepted) {
          console.log('[JoinSession] ✓ ACCEPTED! Navigating to interview...')
          navigate(`/interview-session/${sessionId}`)
        }
      } catch (err: any) {
        console.error('[JoinSession] Poll error:', err.message)
      }
    }

    // Poll imediatamente
    pollSession()

    // Setup interval para polling contínuo
    const interval = setInterval(pollSession, 2000)

    return () => {
      console.log('[JoinSession] Cleaning up polling interval')
      clearInterval(interval)
    }
  }, [waitingForApproval, sessionId, navigate])

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <h1>SourceRank</h1>
        <h2>Entrar em Sessão de Entrevista</h2>

        <div style={{ marginBottom: '24px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>
            Bem-vindo, {user?.email}
          </span>
        </div>

        {!waitingForApproval ? (
          <>
            <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>
              Digite o código de sessão que o entrevistador compartilhou com você.
            </p>

            <form onSubmit={handleRequestAccess}>
              <div className="form-group">
                <label>Código da Sessão</label>
                <input
                  type="text"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
                  placeholder="Ex: ABC12345"
                  maxLength={8}
                  required
                  style={{ textAlign: 'center', fontSize: '18px', letterSpacing: '2px' }}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <button type="submit" disabled={loading || sessionCode.length !== 8} className="btn-primary">
                {loading ? 'Solicitando acesso...' : 'Solicitar Acesso'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div
              style={{
                background: '#1e293b',
                padding: '40px 20px',
                borderRadius: '8px',
                marginBottom: '24px',
                textAlign: 'center',
                border: '1px solid #334155',
              }}
            >
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
              <h3 style={{ color: '#f1f5f9', margin: '0 0 12px 0' }}>Aguardando Aprovação</h3>
              <p style={{ color: '#94a3b8', margin: 0, fontSize: '14px' }}>
                Seu pedido foi enviado. Aguarde a aprovação do entrevistador...
              </p>
            </div>

            <button
              onClick={() => {
                setWaitingForApproval(false)
                setSessionCode('')
              }}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              Cancelar
            </button>
          </>
        )}

        <button
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="toggle-mode"
          style={{ marginTop: '24px' }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default JoinSession
