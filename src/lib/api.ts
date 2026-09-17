import axios from 'axios'

const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : 'https://ibbackend.focusengineeringapp.com/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor: handle 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh-token', {
            refresh_token: refreshToken,
          })
          const { access_token, refresh_token } = res.data
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          original.headers.Authorization = `Bearer ${access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      } else {
        localStorage.clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data: { username: string; password: string }) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refreshToken: (refresh_token: string) => api.post('/auth/refresh-token', { refresh_token }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', data),
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: object) => api.get('/users', { params }),
  create: (data: object) => api.post('/users', data),
  get: (id: string) => api.get(`/users/${id}`),
  update: (id: string, data: object) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
  toggleStatus: (id: string) => api.put(`/users/${id}/toggle-status`),
  resetPassword: (id: string, new_password: string) =>
    api.post(`/users/${id}/reset-password`, { new_password }),
}

// ─── Regions ─────────────────────────────────────────────────────────────────
export const regionsApi = {
  list: () => api.get('/regions'),
  create: (data: object) => api.post('/regions', data),
  update: (id: string, data: object) => api.put(`/regions/${id}`, data),
  delete: (id: string) => api.delete(`/regions/${id}`),
  reorder: (ids: string[]) => api.patch('/regions/reorder', { ids }),
}

// ─── Countries ───────────────────────────────────────────────────────────────
export const countriesApi = {
  list: (region_id?: string) => api.get('/countries', { params: { region_id } }),
  byRegion: (region_id: string) => api.get(`/countries/region/${region_id}`),
  create: (data: object) => api.post('/countries', data),
  update: (id: string, data: object) => api.put(`/countries/${id}`, data),
  delete: (id: string) => api.delete(`/countries/${id}`),
}

// ─── IB Versions ─────────────────────────────────────────────────────────────
export const ibVersionsApi = {
  list: () => api.get('/ib-versions'),
  create: (data: object) => api.post('/ib-versions', data),
  update: (id: string, data: object) => api.put(`/ib-versions/${id}`, data),
  delete: (id: string) => api.delete(`/ib-versions/${id}`),
  reorder: (ids: string[]) => api.patch('/ib-versions/reorder', { ids }),
}

// ─── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  upload: (formData: FormData) =>
    api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list: (params?: object) => api.get('/upload', { params }),
  delete: (id: string) => api.delete(`/upload/${id}`),
}

// ─── Responses ───────────────────────────────────────────────────────────────
export const responsesApi = {
  list: (params?: object) => api.get('/responses', { params }),
  get: (id: string) => api.get(`/responses/${id}`),
  stats: (params?: object) => api.get('/responses/stats', { params }),
  filterOptions: () => api.get('/responses/filter-options'),
  exportCsv: (params?: object) =>
    api.get('/responses/export/csv', { params, responseType: 'blob' }),
}

// ─── Issues ──────────────────────────────────────────────────────────────────
export const issuesApi = {
  list: () => api.get('/issues'),
  analysis: (params?: object) => api.get('/issues/analysis', { params }),
  top: (params?: object) => api.get('/issues/top', { params }),
  trend: (params?: object) => api.get('/issues/trend', { params }),
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: (params?: object) => api.get('/dashboard/stats', { params }),
  brandDistribution: () => api.get('/dashboard/charts/brand-distribution'),
  npsDistribution: () => api.get('/dashboard/charts/nps-distribution'),
  locationIssues: () => api.get('/dashboard/charts/location-issues'),
  brandComparison: (params?: object) => api.get('/dashboard/brand-comparison', { params }),
  passiveTopics: (params?: object) => api.get('/dashboard/passive-topics', { params }),
  brandTopics: (params?: object) => api.get('/dashboard/brand-topics', { params }),
  analytics: (params?: object) => api.get('/dashboard/analytics', { params }),
  ageDistribution: (params?: object) => api.get('/dashboard/age-distribution', { params }),
  ageCityBrand: (params?: object) => api.get('/dashboard/age-city-brand', { params }),
  purchaseOwnership: (params?: object) => api.get('/dashboard/purchase-ownership', { params }),
  professionDistribution: (params?: object) => api.get('/dashboard/profession-distribution', { params }),
  npsData: (params?: object) => api.get('/dashboard/nps', { params }),
  topIssuesByNps: (params?: object) => api.get('/dashboard/top-issues-by-nps', { params }),
  topPassiveTopicsByNps: (params?: object) => api.get('/dashboard/top-passive-topics-by-nps', { params }),
  brandNpsFeedback: (params?: object) => api.get('/dashboard/brand-nps-feedback', { params }),
  serviceFrequency: (params?: object) => api.get('/dashboard/service-frequency', { params }),
  serviceNps: (params?: object) => api.get('/dashboard/service-nps', { params }),
  serviceBenefitsBetterments: (params?: object) => api.get('/dashboard/service-benefits-betterments', { params }),
  serviceSatisfaction: (params?: object) => api.get('/dashboard/service-satisfaction', { params }),
  ibSummaryTable: (params?: object) => api.get('/dashboard/ib-summary-table', { params }),
}

// ─── Comparison ──────────────────────────────────────────────────────────────
export const comparisonApi = {
  brandPassiveIssues: (params?: object) => api.get('/comparison/brand-passive-issues', { params }),
  brandTopics: (params?: object) => api.get('/comparison/brand-topics', { params }),
}

// ─── Activity Logs ────────────────────────────────────────────────────────────
export const activityLogsApi = {
  list: (params?: object) => api.get('/activity-logs', { params }),
}

// ─── Market Feedback ─────────────────────────────────────────────────────────
export const marketFeedbackApi = {
  getAll: () => api.get('/market-feedback'),
  saveRemark: (data: { remark_key: string; remark: string; issue_name?: string; sub_issue_title?: string }) =>
    api.post('/market-feedback/remark', data),
  uploadPhoto: (formData: FormData) =>
    api.post('/market-feedback/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deletePhoto: (remark_key: string, photo_id: string) =>
    api.delete(`/market-feedback/photo/${encodeURIComponent(remark_key)}/${encodeURIComponent(photo_id)}`),
}

