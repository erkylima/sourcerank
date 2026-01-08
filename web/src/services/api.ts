import axios, { AxiosInstance } from 'axios'
import { Challenge, AuthToken, User } from '@/types'

// Detectar automaticamente o hostname (funciona em localhost, rede local, etc)
const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000`

const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Adicionar token a requisições
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export const apiService = {
  // Desafios
  getChallenges: () => axiosInstance.get<{ challenges: Challenge[], total: number, limit: number, offset: number }>('/challenges'),
  updateChallenge: (id: number, data: Partial<Challenge>) =>
    axiosInstance.put<Challenge>(`/challenges/${id}`, data),
  createChallenge: (data: Omit<Challenge, 'id'>) =>
    axiosInstance.post<Challenge>('/challenges', data),

  // Execução de código
  runCode: (language: string, code: string, sessionId: string, challengeId: string) =>
    axiosInstance.post('/executions', { language, code, sessionId, challengeId }),

  // Autenticação
  login: (email: string, password: string) =>
    axiosInstance.post<AuthToken>('/auth/login', { email, password }),
  register: (email: string, password: string, name: string, role: 'interviewer' | 'interviewee') =>
    axiosInstance.post<AuthToken>('/auth/register', { email, password, name, role }),
  me: () =>
    axiosInstance.get<User>('/auth/me'),

  // Sessões de entrevista
  createInterviewSession: () =>
    axiosInstance.post('/sessions/create-interview', {}),
  getSession: (sessionId: string) =>
    axiosInstance.get(`/sessions/${sessionId}`),
  requestSessionAccess: (sessionCode: string) =>
    axiosInstance.post('/sessions/request-access', { sessionCode }),
  acceptInterviewee: (sessionId: string) =>
    axiosInstance.patch(`/sessions/${sessionId}/accept`, {}),
  rejectInterviewee: (sessionId: string) =>
    axiosInstance.patch(`/sessions/${sessionId}/reject`, {}),
  endSession: (sessionId: string) =>
    axiosInstance.patch(`/sessions/${sessionId}/end`, {}),
  updateSessionChallenge: (sessionId: string, challengeId: number) =>
    axiosInstance.patch(`/sessions/${sessionId}/challenge`, { challengeId }),

  // CRDT - Force snapshot to save to DB immediately
  forceSnapshotSave: (sessionId: string, challengeId: string) =>
    axiosInstance.post(`/crdt/snapshot`, { sessionId, challengeId }),

  // Preferred language - Session-wide language preference
  getPreferredLanguage: async (sessionId: string) => {
    const response = await axiosInstance.get<{ language: string }>(`/session-content/sessions/${sessionId}/preferred-language`)
    return response.data.language
  },
  updatePreferredLanguage: (sessionId: string, language: string) =>
    axiosInstance.patch(`/session-content/sessions/${sessionId}/preferred-language`, { language }),

  // Content persistence - Unified endpoint for 3 scenarios (reload, language switch, challenge switch)
  persistContent: (
    sessionId: string,
    challengeId: string,
    currentContent: string,
    currentLanguage: string,
    previousLanguage?: string,
    previousContent?: string
  ) =>
    axiosInstance.post('/content/persist', {
      sessionId,
      challengeId,
      contentType: 'code',
      currentLanguage,
      currentContent,
      previousLanguage: previousLanguage || undefined,
      previousContent: previousContent || undefined,
      forceSnapshot: true
    }),

  // Get content for a challenge in a session and language
  getChallengeContent: (sessionId: string, challengeId: number | string, language: string) =>
    axiosInstance.get(`/session-content/${sessionId}/challenges/${challengeId}`, {
      params: { contentType: 'code', language }
    }),
}
export default apiService
