export interface Challenge {
  id: number
  title: string
  description: string
  inputExample: string
  outputExample: string
}

export interface User {
  id?: string
  email: string
  role: 'interviewer' | 'interviewee'
}

export interface AuthToken {
  token?: string
  access_token?: string
  user: User
}

export interface ExecutionResult {
  sessionId: string
  language: string
  stdout: string
  stderr: string
  exitCode?: number
}

export interface Session {
  id: string
  interviewerId: string
  intervieweeId: string
  createdAt: Date
  currentChallengeIndex: number
}
