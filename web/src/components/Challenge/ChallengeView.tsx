import React, { useState } from 'react'
import evaluationService from '@/services/evaluation.service'
import { Challenge } from '@/types'
import '@/styles/Challenge.css'

interface ChallengeViewProps {
  challenge: Challenge | null
  sessionId?: string
  isInterviewer?: boolean
  onEdit?: (challenge: Challenge) => void
}

export const ChallengeView: React.FC<ChallengeViewProps> = ({ challenge, sessionId, isInterviewer = false, onEdit }) => {
  const [evaluation, setEvaluation] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!challenge) {
    return <div className="challenge-view">Nenhum desafio disponível</div>
  }

  const handleEvaluate = async () => {
    if (!sessionId) {
      setError('SessionId não encontrado')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await evaluationService.evaluateChallenge(challenge.id, sessionId)
      setEvaluation(result.evaluation)
    } catch (err: any) {
      setError(err.message || 'Erro ao avaliar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="challenge-view">
      <div className="challenge-header">
        <h2>{challenge.title}</h2>
        {isInterviewer && onEdit && (
          <button className="btn-secondary" onClick={() => onEdit(challenge)}>
            Editar
          </button>
        )}
      </div>
      <p className="challenge-description">{challenge.description}</p>
      <div className="challenge-examples">
        <div className="example">
          <h4>Entrada:</h4>
          <pre>{challenge.inputExample}</pre>
        </div>
        <div className="example">
          <h4>Saída:</h4>
          <pre>{challenge.outputExample}</pre>
        </div>
      </div>
      <button className="btn-primary" onClick={handleEvaluate} disabled={loading} style={{marginTop: 16}}>
        {loading ? 'Avaliando...' : 'Avaliar'}
      </button>
      {error && <div className="error-message">{error}</div>}
      {evaluation && (
        <div className="evaluation-result" style={{marginTop: 16}}>
          <h4>Resultado da Avaliação</h4>
          <ul>
            {evaluation.map((ev: any, idx: number) => (
              <li key={idx} style={{color: ev.passed ? 'green' : 'red'}}>
                <strong>Input:</strong> <pre style={{display:'inline'}}>{ev.input}</pre> | <strong>Esperado:</strong> <pre style={{display:'inline'}}>{ev.expected}</pre> | <strong>Obtido:</strong> <pre style={{display:'inline'}}>{ev.actual}</pre> | <strong>{ev.passed ? '✔️' : '❌'}</strong>
              </li>
            ))}
          </ul>
          <div><strong>Score:</strong> {evaluation.filter((ev: any) => ev.passed).length} / {evaluation.length}</div>
        </div>
      )}
    </div>
  )
}

export default ChallengeView
