import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  username: string
  email: string
  full_name: string
  role: 'super_admin' | 'admin'
  is_active: boolean
  preferences?: Record<string, unknown>
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  clearAuth: () => void
  updateUser: (user: Partial<User>) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken)
        localStorage.setItem('refresh_token', refreshToken)
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },
      clearAuth: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },
      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Filter store for dashboard
interface FilterState {
  regionId: string
  countryId: string
  ibVersionId: string
  brandModel: string
  surveyLocation: string
  dateFrom: string
  dateTo: string
  search: string
  setFilter: (key: keyof Omit<FilterState, 'setFilter' | 'resetFilters'>, value: string) => void
  resetFilters: () => void
}

export const useFilterStore = create<FilterState>((set) => ({
  regionId: '',
  countryId: '',
  ibVersionId: '',
  brandModel: '',
  surveyLocation: '',
  dateFrom: '',
  dateTo: '',
  search: '',
  setFilter: (key, value) => set((state) => ({ ...state, [key]: value })),
  resetFilters: () =>
    set({
      regionId: '',
      countryId: '',
      ibVersionId: '',
      brandModel: '',
      surveyLocation: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    }),
}))
