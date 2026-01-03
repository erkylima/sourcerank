import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import apiService from '@/services/api'
import { io, Socket } from 'socket.io-client'
import '@/styles/Login.css'

const WS_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`

export const CreateSession: React.FC = () => {
  const { user, logout, token } = useAuth()
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [candidateNotification, setCandidateNotification] = useState<any>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isAccepted, setIsAccepted] = useState(false)
  const navigate = useNavigate()

  // Conectar ao Socket.IO quando componente monta
  useEffect(() => {
    if (!token || !user?.id) {
      console.log('Not connecting to WebSocket - missing token or user')
      return
    }

    console.log('Connecting to WebSocket with token:', token.substring(0, 20) + '...')
    console.log('WebSocket URL:', WS_URL)
    const newSocket = io(WS_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      console.log('✓ Connected to WebSocket')
      // Fazer join na sala do entrevistador para receber notificações
      const roomName = `interviewer:${user.id}`
      console.log('Joining room:', roomName)
      newSocket.emit('join-room', roomName)
    })

    newSocket.on('candidate-access-request', (data: any) => {
      console.log('✓ Received candidate-access-request:', data)
      setCandidateNotification(data)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket')
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [token, user?.id])

  const handleCreateSession = async () => {
    setLoading(true)
    try {
      const response = await (apiService as any).createInterviewSession()
      setSession(response.data.session)
    } catch (err: any) {
      alert('Erro ao criar sessão: ' + (err.message || 'Unknown error'))
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (session?.session_code) {
      navigator.clipboard.writeText(session.session_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleStartInterview = () => {
    if (session?.id) {
      navigate(`/interview-session/${session.id}`)
    }
  }

  const handleAcceptCandidate = async () => {
    if (!session?.id) return
    
    setIsAccepting(true)
    try {
      await (apiService as any).acceptInterviewee(session.id)
      setIsAccepted(true)
      console.log('[CreateSession] ✓ Candidato aceito com sucesso!')
    } catch (err: any) {
      alert('Erro ao aceitar candidato: ' + (err.message || 'Unknown error'))
      console.error('[CreateSession] Erro ao aceitar:', err)
    } finally {
      setIsAccepting(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card" style={{ maxWidth: '500px' }}>
        <h1>SourceRank</h1>
        <h2>Iniciar Entrevista</h2>

        <div style={{ marginBottom: '24px' }}>
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>
            Bem-vindo, {user?.email}
          </span>
        </div>

        {candidateNotification && (
          <div
            style={{
              background: '#10b981',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              color: '#fff',
              fontSize: '14px',
            }}
          >
            ✓ {candidateNotification.candidateName} solicitou acesso à entrevista!
          </div>
        )}

        {!session ? (
          <>
            <p style={{ color: '#cbd5e1', marginBottom: '24px' }}>
              Clique no botão abaixo para gerar um código de sessão que você pode compartilhar com o candidato.
            </p>
            <button
              onClick={handleCreateSession}
              disabled={loading}
              className="btn-primary"
              style={{ width: '100%' }}
            >
              {loading ? 'Gerando...' : 'Gerar Código de Sessão'}
            </button>
          </>
        ) : (
          <>
            <div
              style={{
                background: '#1e293b',
                padding: '20px',
                borderRadius: '8px',
                marginBottom: '24px',
                textAlign: 'center',
                border: '1px solid #334155',
              }}
            >
              <p style={{ color: '#94a3b8', fontSize: '12px', margin: '0 0 8px 0' }}>
                Código da Sessão
              </p>
              <h3
                style={{
                  margin: '0 0 16px 0',
                  color: '#f1f5f9',
                  fontSize: '32px',
                  fontFamily: 'monospace',
                  letterSpacing: '4px',
                }}
              >
                {session.session_code}
              </h3>
              <button
                onClick={handleCopyCode}
                style={{
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                {copied ? '✓ Copiado!' : 'Copiar Código'}
              </button>
            </div>

            <p style={{ color: '#cbd5e1', marginBottom: '24px', fontSize: '14px' }}>
              Compartilhe este código com o candidato. Ele pode se conectar usando este código na página de Entrar em
              Sessão.
            </p>

            {!isAccepted && candidateNotification && (
              <button
                onClick={handleAcceptCandidate}
                disabled={isAccepting}
                className="btn-primary"
                style={{ width: '100%', marginBottom: '12px', background: '#10b981' }}
              >
                {isAccepting ? '⏳ Aceitando...' : '✓ Aceitar Candidato'}
              </button>
            )}

            <button
              onClick={handleStartInterview}
              disabled={!candidateNotification || !isAccepted}
              className="btn-primary"
              style={{ width: '100%', marginBottom: '12px', opacity: candidateNotification && isAccepted ? 1 : 0.5 }}
            >
              {isAccepted ? '▶ Começar Entrevista' : isAccepted ? '✓ Pronto!' : 'Aguardando Aceitação...'}
            </button>

            <button
              onClick={() => {
                setSession(null)
                setCandidateNotification(null)
                setIsAccepted(false)
              }}
              className="btn-secondary"
              style={{ width: '100%' }}
            >
              Gerar Novo Código
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

export default CreateSession
