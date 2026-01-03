import React, { createContext, useContext, useState, useEffect } from 'react'
import { User, AuthToken } from '@/types'
import authService from '@/services/auth.service'
import apiService from '@/services/api.ts'

interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<User>
  register: (email: string, password: string, name: string, role: 'interviewer' | 'interviewee') => Promise<User>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedUser = authService.getUser()
    const storedToken = authService.getToken()
    if (storedUser && authService.isAuthenticated()) {
      setUser(storedUser)
      setToken(storedToken)
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const response = await apiService.login(email, password)
    authService.setAuth(response.data)
    setUser(response.data.user)
    setToken(response.data.token)
    return response.data.user
  }

  const register = async (email: string, password: string, name: string, role: 'interviewer' | 'interviewee') => {
    const response = await apiService.register(email, password, name, role)
    authService.setAuth(response.data)
    setUser(response.data.user)
    setToken(response.data.token)
    return response.data.user
  }

  const logout = () => {
    authService.logout()
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
