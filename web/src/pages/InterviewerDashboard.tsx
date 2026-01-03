import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Challenge } from '@/types'
import apiService from '@/services/api'
import '@/styles/Dashboard.css'

export const InterviewerDashboard: React.FC = () => {
  const { user, logout } = useAuth()
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<Partial<Challenge>>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadChallenges()
  }, [])

  const loadChallenges = async () => {
    try {
      const response = await apiService.getChallenges()
      setChallenges(response.data.challenges || [])
    } catch (err) {
      console.error('Erro ao carregar desafios:', err)
      setChallenges([])
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (challenge: Challenge) => {
    setEditingId(challenge.id)
    setEditForm({ ...challenge })
  }

  const handleSave = async () => {
    if (editingId && editForm) {
      try {
        const response = await apiService.updateChallenge(editingId, editForm)
        setChallenges(challenges.map((c) => (c.id === editingId ? response.data : c)))
        setEditingId(null)
      } catch (err) {
        console.error('Erro ao salvar desafio:', err)
      }
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (loading) return <div>Carregando...</div>

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard do Entrevistador</h1>
        <div className="header-actions">
          <span>{user?.email}</span>
          <button onClick={handleLogout} className="btn-danger">
            Logout
          </button>
        </div>
      </div>

      <div className="challenges-management">
        <h2>Gerenciar Desafios</h2>
        <div className="challenges-grid">
          {challenges.map((ch) => (
            <div key={ch.id} className="challenge-card">
              {editingId === ch.id ? (
                <div className="edit-form">
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    placeholder="Título"
                  />
                  <textarea
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="Descrição"
                  />
                  <div className="form-row">
                    <input
                      type="text"
                      value={editForm.inputExample || ''}
                      onChange={(e) => setEditForm({ ...editForm, inputExample: e.target.value })}
                      placeholder="Entrada"
                    />
                    <input
                      type="text"
                      value={editForm.outputExample || ''}
                      onChange={(e) => setEditForm({ ...editForm, outputExample: e.target.value })}
                      placeholder="Saída"
                    />
                  </div>
                  <div className="button-group">
                    <button onClick={handleSave} className="btn-primary">
                      Salvar
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-secondary">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h3>{ch.title}</h3>
                  <p>{ch.description}</p>
                  <button onClick={() => handleEdit(ch)} className="btn-secondary">
                    Editar
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default InterviewerDashboard
