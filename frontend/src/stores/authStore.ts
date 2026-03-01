import { create } from 'zustand'
import { api } from '../lib/api'

interface User {
  id: string
  email: string
  display_name: string
  tier: string
  language_preference: string
  is_active: boolean
  created_at: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  loading: boolean
  error: string | null
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  clearError: () => void
  checkAuth: () => Promise<void>
  refreshAccessToken: () => Promise<boolean>
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  token: localStorage.getItem('qb_token'),
  refreshToken: localStorage.getItem('qb_refresh'),
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null })
    try {
      const res = await api.auth.login(email, password)
      localStorage.setItem('qb_token', res.access_token)
      localStorage.setItem('qb_refresh', res.refresh_token)
      set({ token: res.access_token, refreshToken: res.refresh_token })
      await get().checkAuth()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      set({ error: message, loading: false })
      throw err
    }
  },

  register: async (email, password, displayName) => {
    set({ loading: true, error: null })
    try {
      const res = await api.auth.register(email, password, displayName)
      localStorage.setItem('qb_token', res.access_token)
      localStorage.setItem('qb_refresh', res.refresh_token)
      set({ token: res.access_token, refreshToken: res.refresh_token })
      await get().checkAuth()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      set({ error: message, loading: false })
      throw err
    }
  },

  logout: () => {
    localStorage.removeItem('qb_token')
    localStorage.removeItem('qb_refresh')
    set({ user: null, token: null, refreshToken: null, error: null })
  },

  clearError: () => {
    set({ error: null })
  },

  checkAuth: async () => {
    const token = get().token
    if (!token) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const user = await api.auth.me()
      set({ user, loading: false })
    } catch {
      const refreshed = await get().refreshAccessToken()
      if (refreshed) {
        try {
          const user = await api.auth.me()
          set({ user, loading: false })
        } catch {
          get().logout()
          set({ loading: false })
        }
      } else {
        get().logout()
        set({ loading: false })
      }
    }
  },

  refreshAccessToken: async () => {
    const refresh = get().refreshToken
    if (!refresh) return false
    try {
      const res = await api.auth.refresh(refresh)
      localStorage.setItem('qb_token', res.access_token)
      localStorage.setItem('qb_refresh', res.refresh_token)
      set({ token: res.access_token, refreshToken: res.refresh_token })
      return true
    } catch {
      get().logout()
      return false
    }
  },
}))
