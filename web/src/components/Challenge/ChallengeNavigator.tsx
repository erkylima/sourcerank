import React from 'react'
import { Challenge } from '@/types'
import '@/styles/Challenge.css'

interface ChallengeNavigatorProps {
  challenges: Challenge[]
  currentIndex: number
  onSelect: (index: number) => void
  onNext: () => void
  onPrevious: () => void
  canAdvance?: boolean
}

export const ChallengeNavigator: React.FC<ChallengeNavigatorProps> = ({
  challenges = [],
  currentIndex,
  onSelect,
  onNext,
  onPrevious,
  canAdvance = true,
}) => {
  if (!Array.isArray(challenges)) {
    return <div>Sem desafios disponíveis</div>
  }

  return (
    <div className="challenge-navigator">
      <div className="challenge-list">
        {challenges.map((ch, idx) => (
          <div
            key={ch.id}
            className={`challenge-item ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'completed' : ''}`}
            onClick={() => onSelect(idx)}
          >
            <span className="challenge-index">{idx + 1}</span>
            <span className="challenge-name">{ch.title}</span>
          </div>
        ))}
      </div>
      <div className="navigator-controls">
        <button onClick={onPrevious} disabled={currentIndex === 0} className="btn-control">
          ← Anterior
        </button>
        <button onClick={onNext} disabled={!canAdvance || currentIndex === challenges.length - 1} className="btn-control">
          Próximo →
        </button>
      </div>
    </div>
  )
}

export default ChallengeNavigator
