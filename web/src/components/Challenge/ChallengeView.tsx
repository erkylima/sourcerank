import React from 'react'
import { Challenge } from '@/types'
import '@/styles/Challenge.css'

interface ChallengeViewProps {
  challenge: Challenge | null
  isInterviewer?: boolean
  onEdit?: (challenge: Challenge) => void
}

export const ChallengeView: React.FC<ChallengeViewProps> = ({ challenge, isInterviewer = false, onEdit }) => {
  if (!challenge) {
    return <div className="challenge-view">Nenhum desafio disponível</div>
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
          <h4>Saída esperada:</h4>
          <pre>{challenge.outputExample}</pre>
        </div>
      </div>
    </div>
  )
}

export default ChallengeView
