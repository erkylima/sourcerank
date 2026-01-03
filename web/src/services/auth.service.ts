import { User, AuthToken } from '@/types'

const TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

export const authService = {
  setToken: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setUser: (user: User) => localStorage.setItem(USER_KEY, JSON.stringify(user)),
  getUser: (): User | null => {
    const user = localStorage.getItem(USER_KEY)
    return user ? JSON.parse(user) : null
  },
  isAuthenticated: () => !!localStorage.getItem(TOKEN_KEY),
  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  },
  setAuth: (auth: AuthToken) => {
    const token = auth.token || auth.access_token
    if (token) {
      authService.setToken(token)
    }
    authService.setUser(auth.user)
  },
}

export default authService
