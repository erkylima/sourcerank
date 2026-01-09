const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export const evaluationService = {
  async evaluateChallenge(challengeId: number, sessionId: string) {
    const res = await fetch(`${API_URL}/challenges/${challengeId}/evaluate?sessionId=${sessionId}`)
    if (!res.ok) throw new Error('Erro ao avaliar desafio')
    return await res.json()
  }
}

export default evaluationService
