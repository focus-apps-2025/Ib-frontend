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
export interface FilterState {
  regionId: string[]
  countryId: string[]
  ibVersionId: string[]
  brandModel: string[]
  surveyLocation: string[]
  dateFrom: string
  dateTo: string
  search: string
  setFilter: (key: keyof Omit<FilterState, 'setFilter' | 'resetFilters'>, value: string | string[]) => void
  resetFilters: () => void
}

/**
 * Converts a multi-select filter value into the backend query-param format.
 * Returns `undefined` for empty values (so the param is omitted entirely) and a
 * comma-joined string otherwise, e.g. `?region_id=r1,r2`.
 * Plain strings (used by some shared components, e.g. the Comparison page's own
 * single-select filters) are passed through untouched.
 *
 * ⚠️ BACKEND NOTE: The FastAPI routes currently type these filters as
 * `Optional[str]` and pass them straight into `PydanticObjectId(...)` (see
 * backend/app/routes/responses.py, dashboard_controller.py, issue_controller.py).
 * A comma-separated multi-value like `region_id=r1,r2` will therefore NOT work
 * until the backend is adjusted to split the string on "," and use `$in` for
 * file/record filtering. If/when you update the backend, the frontend change is
 * contained here: it will already be sending `region_id=r1,r2`.
 */
export const toParam = (v: string | string[] | undefined): string | undefined => {
  if (!v) return undefined
  if (Array.isArray(v)) return v.length > 0 ? v.join(',') : undefined
  return v
}

export const useFilterStore = create<FilterState>((set) => ({
  regionId: [],
  countryId: [],
  ibVersionId: [],
  brandModel: [],
  surveyLocation: [],
  dateFrom: '',
  dateTo: '',
  search: '',
  setFilter: (key, value) => set((state) => ({ ...state, [key]: value })),
  resetFilters: () =>
    set({
      regionId: [],
      countryId: [],
      ibVersionId: [],
      brandModel: [],
      surveyLocation: [],
      dateFrom: '',
      dateTo: '',
      search: '',
    }),
}))
