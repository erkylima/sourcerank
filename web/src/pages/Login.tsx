import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import '@/styles/Login.css'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<'interviewer' | 'interviewee'>('interviewee')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      let user
      if (isSignUp) {
        const response = await register(email, password, name, role)
        user = response
      } else {
        const response = await login(email, password)
        user = response
      }
      // Redirecionar baseado no role do usuário
      if (user?.role === 'interviewer') {
        navigate('/create-session')
      } else {
        navigate('/join-session')
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao autenticar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>SourceRank</h1>
        <h2>{isSignUp ? 'Cadastro' : 'Login'}</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="seu@email.com"
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label>Nome</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Seu Nome"
              />
            </div>
          )}

          <div className="form-group">
            <label>Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>

          {isSignUp && (
            <div className="form-group">
              <label>Perfil</label>
              <select value={role} onChange={(e) => setRole(e.target.value as any)}>
                <option value="interviewee">Candidato</option>
                <option value="interviewer">Entrevistador</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Aguarde...' : isSignUp ? 'Cadastrar' : 'Entrar'}
          </button>
        </form>

        <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-mode">
          {isSignUp ? 'Já tem conta? Faça login' : 'Não tem conta? Cadastre-se'}
        </button>
      </div>
    </div>
  )
}

export default Login
