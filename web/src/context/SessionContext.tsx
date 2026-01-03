import React, { createContext, useContext, useState } from 'react'
import { Session } from '@/types'

interface SessionContextType {
  session: Session | null
  currentChallengeIndex: number
  setSession: (session: Session) => void
  nextChallenge: () => void
  previousChallenge: () => void
}

const SessionContext = createContext<SessionContextType | undefined>(undefined)

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0)

  const nextChallenge = () => {
    setCurrentChallengeIndex((prev) => prev + 1)
  }

  const previousChallenge = () => {
    setCurrentChallengeIndex((prev) => Math.max(0, prev - 1))
  }

  return (
    <SessionContext.Provider
      value={{
        session,
        currentChallengeIndex,
        setSession,
        nextChallenge,
        previousChallenge,
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export const useSession = () => {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error('useSession must be used within SessionProvider')
  }
  return context
}
