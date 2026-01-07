import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SessionProvider } from '@/context/SessionContext'
import Login from '@/pages/Login'
import InterviewerDashboard from '@/pages/InterviewerDashboard'
import InterviewSession from '@/pages/InterviewSession'
import IntervieweeView from '@/pages/IntervieweeView'
import CreateSession from '@/pages/CreateSession'
import JoinSession from '@/pages/JoinSession'
import '@/styles/global.css'

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // CRDT keeps data fresh
      refetchOnWindowFocus: false,
      retry: 2,
    },
  },
})

const ProtectedRoute: React.FC<{ children: React.ReactNode; role?: 'interviewer' | 'interviewee' }> = ({
  children,
  role,
}) => {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) return <div>Carregando...</div>

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (role && user?.role !== role) return <Navigate to="/login" replace />

  return <>{children}</>
}

// Componente que renderiza a tela de entrevista correta baseado no role
const InterviewSessionRouter: React.FC = () => {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) return <div>Carregando...</div>

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (user?.role === 'interviewer') {
    return <InterviewSession />
  } else if (user?.role === 'interviewee') {
    return <IntervieweeView />
  } else {
    return <Navigate to="/login" replace />
  }
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/interviewer-dashboard"
        element={
          <ProtectedRoute role="interviewer">
            <InterviewerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-session"
        element={
          <ProtectedRoute role="interviewer">
            <CreateSession />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interview-session/:sessionId"
        element={<InterviewSessionRouter />}
      />
      <Route
        path="/join-session"
        element={
          <ProtectedRoute role="interviewee">
            <JoinSession />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SessionProvider>
            <AppRoutes />
          </SessionProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}
