export type UserRole = 'interviewer' | 'interviewee'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
export type SessionStatus = 'pending' | 'active' | 'completed' | 'cancelled'

export interface User {
  id: string
  email: string
  password_hash: string
  role: UserRole
  name?: string
  created_at: Date
  updated_at: Date
}

export interface Challenge {
  id: string
  title: string
  description: string
  difficulty: Difficulty
  examples: string
  created_by: string
  created_at: Date
  updated_at: Date
}

export interface Session {
  id: string
  interviewer_id: string
  interviewee_id: string
  current_challenge_id: string
  status: SessionStatus
  created_at: Date
  updated_at: Date
}

export interface Execution {
  id: string
  session_id: string
  challenge_id: string
  language: string
  code: string
  status: ExecutionStatus
  stdout?: string
  stderr?: string
  exit_code?: number
  execution_time?: number
  created_at: Date
  updated_at: Date
}

export interface ExecutionLog {
  id: string
  execution_id: string
  message: string
  level: 'info' | 'warning' | 'error'
  created_at: Date
}
