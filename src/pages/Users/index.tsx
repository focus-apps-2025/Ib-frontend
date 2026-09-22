import { useState, useEffect, useRef } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Tooltip, CircularProgress, Alert,
  Avatar, Pagination
} from '@mui/material'
import { Add, Edit, Delete, LockReset, PersonOff, Person, Security, Check } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi, regionsApi, countriesApi, ibVersionsApi, responsesApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'
import { DataAccessTab, DEFAULT_SCOPE_STATE, type ScopeState } from '../../components/users/DataAccessTab'

const userSchema = z.object({
  username: z.string().min(3, 'Min 3 characters'),
  email: z.string().email('Invalid email'),
  full_name: z.string().min(2, 'Required'),
  password: z.string().min(8, 'Min 8 characters').optional().or(z.literal('')),
  role: z.enum(['admin', 'super_admin']),
})

type UserFormData = z.infer<typeof userSchema>

interface User {
  id: string; username: string; email: string; full_name: string
  role: string; is_active: boolean; last_login?: string; created_at: string
}

type ScopeOption = { id: string; label: string }
type RawCountry = { id: string; name: string; region_id: string }
type ScopeRefData = {
  regions: ScopeOption[]
  allCountries: RawCountry[]
  ibVersions: ScopeOption[]
  brands: ScopeOption[]
  cities: ScopeOption[]
}

const STEPS = [
  { id: 0, label: 'Basic Info', description: 'Account details & role' },
  { id: 1, label: 'Data Access', description: 'Permissions & scope' },
]

export default function UsersPage() {

  const [scopeMounted, setScopeMounted] = useState(false)
  const [refData, setRefData] = useState<ScopeRefData | null>(null)
  const refPromise = useRef<Promise<ScopeRefData> | null>(null)
  const refCache = useRef<ScopeRefData | null>(null)
  const c = useThemeColors()
  const [users, setUsers] = useState<User[]>([])
  const [userScopes, setUserScopes] = useState<Record<string, any>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [scopeState, setScopeState] = useState<ScopeState>(DEFAULT_SCOPE_STATE)
  const [error, setError] = useState('')


  const [regionsMap, setRegionsMap] = useState<Record<string, string>>({})
  const [countriesMap, setCountriesMap] = useState<Record<string, string>>({})
  const [ibMap, setIbMap] = useState<Record<string, string>>({})

  const { register, handleSubmit, reset, control, trigger, formState: { errors, isSubmitting } } =
    useForm<UserFormData>({ resolver: zodResolver(userSchema) })

  // -------- data loaders (unchanged) --------
  const loadReferenceMaps = async () => {
    try {
      const [rRes, cRes, ibRes] = await Promise.all([
        regionsApi.list(), countriesApi.list(), ibVersionsApi.list(),
      ])
      const rm: Record<string, string> = {}
        ; (rRes.data.data || []).forEach((r: any) => { rm[r.id] = r.name })
      setRegionsMap(rm)
      const cm: Record<string, string> = {}
        ; (cRes.data.data || []).forEach((c: any) => { cm[c.id] = c.name })
      setCountriesMap(cm)
      const ibm: Record<string, string> = {}
        ; (ibRes.data.data || []).forEach((v: any) => { ibm[v.id] = v.name })
      setIbMap(ibm)
    } catch { /* ignore */ }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ page, page_size: 25 })
      const uList = res.data.data || []
      setUsers(uList)
      setTotal(res.data.total_pages || 1)
      const scopesDict: Record<string, any> = {}
      await Promise.all(
        uList.map(async (u: User) => {
          if (u.role !== 'super_admin') {
            try {
              const sRes = await usersApi.getScope(u.id)
              scopesDict[u.id] = sRes.data
            } catch { /* ignore */ }
          }
        })
      )
      setUserScopes(scopesDict)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadReferenceMaps() }, [])
  useEffect(() => { loadUsers() }, [page])

  const openCreate = () => {
    setEditUser(null)
    setActiveStep(0)
    setScopeState(DEFAULT_SCOPE_STATE)
    reset({ username: '', email: '', full_name: '', password: '', role: 'admin' })
    setError('')
    setDialogOpen(true)
  }

  // Inline loader — fetches once per session, caches in refCache
  const loadScopeRefData = (): Promise<ScopeRefData> => {
    if (refCache.current) return Promise.resolve(refCache.current)
    if (refPromise.current) return refPromise.current

    refPromise.current = Promise.all([
      regionsApi.list(),
      countriesApi.list(),
      ibVersionsApi.list(),
      responsesApi.filterOptions(),
    ])
      .then(([regRes, countRes, ibRes, filterRes]) => {
        const data: ScopeRefData = {
          regions: (regRes.data.data || []).map((r: any) => ({ id: r.id, label: r.name })),
          allCountries: (countRes.data.data || []).map((c: any) => ({
            id: c.id, name: c.name, region_id: c.region_id,
          })),
          ibVersions: (ibRes.data.data || []).map((v: any) => ({ id: v.id, label: v.name })),
          brands: (filterRes.data.brands || []).map((b: string) => ({ id: b, label: b })),
          cities: (filterRes.data.locations || []).map((c: string) => ({ id: c, label: c })),
        }
        refCache.current = data
        return data
      })
      .catch(err => {
        refPromise.current = null
        throw err
      })

    return refPromise.current
  }

  useEffect(() => {
    if (!dialogOpen) return
    if (refCache.current) { setRefData(refCache.current); return }

    let cancelled = false
    loadScopeRefData()
      .then(data => { if (!cancelled) setRefData(data) })
      .catch(() => { /* silent — DataAccessTab will show error if needed */ })

    return () => { cancelled = true }
  }, [dialogOpen])

  useEffect(() => {
    if (activeStep === 1) setScopeMounted(true)
  }, [activeStep])

  const openEdit = async (user: User) => {
    setEditUser(user)
    setActiveStep(0)
    reset({
      username: user.username, email: user.email, full_name: user.full_name,
      role: user.role as 'admin' | 'super_admin', password: '',
    })
    setError('')

    if (user.role !== 'super_admin') {
      try {
        const sRes = await usersApi.getScope(user.id)
        if (sRes.data) {
          setScopeState({
            all_regions: sRes.data.all_regions ?? true,
            region_ids: sRes.data.region_ids || [],
            all_countries: sRes.data.all_countries ?? true,
            country_ids: sRes.data.country_ids || [],
            all_ib_versions: sRes.data.all_ib_versions ?? true,
            ib_version_ids: sRes.data.ib_version_ids || [],
            all_brands: sRes.data.all_brands ?? true,
            brand_models: sRes.data.brand_models || [],
            all_cities: sRes.data.all_cities ?? true,
            survey_locations: sRes.data.survey_locations || [],
          })
        } else setScopeState(DEFAULT_SCOPE_STATE)
      } catch { setScopeState(DEFAULT_SCOPE_STATE) }
    } else setScopeState(DEFAULT_SCOPE_STATE)

    setDialogOpen(true)
  }

  const onSubmit = async (data: UserFormData) => {
    setError('')
    try {
      let createdOrUpdatedUserId = editUser?.id
      if (editUser) {
        const payload = { ...data, scope: scopeState }
        delete payload.password
        await usersApi.update(editUser.id, payload)
      } else {
        const res = await usersApi.create({ ...data, scope: scopeState })
        createdOrUpdatedUserId = res.data.id
      }
      if (createdOrUpdatedUserId && data.role !== 'super_admin') {
        await usersApi.updateScope(createdOrUpdatedUserId, scopeState)
      }
      setDialogOpen(false)
      loadUsers()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } } }
      setError(e.response?.data?.detail || 'An error occurred')
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return
    await usersApi.delete(id)
    loadUsers()
  }

  const handleToggle = async (id: string) => {
    await usersApi.toggleStatus(id)
    loadUsers()
  }

  const handleResetPassword = async (id: string) => {
    const pwd = window.prompt('Enter new password (min 8 chars):')
    if (!pwd || pwd.length < 8) return
    await usersApi.resetPassword(id, pwd)
    alert('Password reset successfully')
  }

  // -------- wizard navigation --------
  const goNext = async () => {
    // validate Basic Info fields before advancing
    const ok = await trigger(['full_name', 'username', 'email', 'password', 'role'])
    if (!ok) return
    setActiveStep(1)
  }

  const goBack = () => setActiveStep(0)

  // -------- scope summary (unchanged) --------
  const formatScopeSummary = (user: User) => {
    if (user.role === 'super_admin') return 'Full access'
    const scope = userScopes[user.id]
    if (!scope) return 'Unrestricted'
    const isUnrestricted =
      scope.all_regions && scope.all_countries && scope.all_ib_versions &&
      scope.all_brands && scope.all_cities
    if (isUnrestricted) return 'Unrestricted'

    const parts: string[] = []
    if (scope.all_regions) parts.push('All Regions')
    else if (scope.region_ids.length > 0) {
      const names = scope.region_ids.map((id: string) => regionsMap[id] || id)
      parts.push(names.slice(0, 2).join(',') + (names.length > 2 ? `+${names.length - 2}` : ''))
    } else parts.push('No Regions')

    if (scope.all_countries) parts.push('All Countries')
    else if (scope.country_ids.length > 0) {
      const names = scope.country_ids.map((id: string) => countriesMap[id] || id)
      parts.push(names.slice(0, 2).join(',') + (names.length > 2 ? `+${names.length - 2}` : ''))
    } else parts.push('No Countries')

    if (scope.all_ib_versions) parts.push('All IBs')
    else if (scope.ib_version_ids.length > 0) {
      const names = scope.ib_version_ids.map((id: string) => ibMap[id] || id)
      parts.push(names.join(','))
    } else parts.push('No IBs')

    if (scope.all_brands) parts.push('All Brands')
    else if (scope.brand_models.length > 0)
      parts.push(scope.brand_models.slice(0, 2).join(',') + (scope.brand_models.length > 2 ? `+${scope.brand_models.length - 2}` : ''))
    else parts.push('No Brands')

    if (scope.all_cities) parts.push('All Cities')
    else if (scope.survey_locations.length > 0)
      parts.push(scope.survey_locations.slice(0, 2).join(',') + (scope.survey_locations.length > 2 ? `+${scope.survey_locations.length - 2}` : ''))
    else parts.push('No Cities')

    return parts.join(' · ')
  }

  // -------- stepper component --------
  const StepperHeader = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: 3 }}>
      {STEPS.map((step, idx) => {
        const isActive = activeStep === step.id
        const isComplete = activeStep > step.id
        const isClickable = step.id === 0 || editUser !== null || isComplete

        return (
          <Box key={step.id} sx={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : 'none' }}>
            {/* Step node */}
            <Box
              onClick={() => isClickable && setActiveStep(step.id)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                cursor: isClickable ? 'pointer' : 'not-allowed',
                opacity: isClickable ? 1 : 0.5,
                userSelect: 'none',
              }}
            >
              <Box
                sx={{
                  width: 36, height: 36, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.9rem',
                  transition: 'all 0.2s ease',
                  background: isActive || isComplete
                    ? 'linear-gradient(135deg, #6C63FF, #9A94FF)'
                    : 'transparent',
                  color: isActive || isComplete ? '#fff' : c.textMuted,
                  border: isActive || isComplete
                    ? 'none'
                    : `2px solid ${c.borderStrong}`,
                  boxShadow: isActive ? '0 4px 12px rgba(108,99,255,0.35)' : 'none',
                }}
              >
                {isComplete ? <Check sx={{ fontSize: 18 }} /> : step.id + 1}
              </Box>
              <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 700,
                    color: isActive ? c.textPrimary : isComplete ? c.primaryLight : c.textMuted,
                    lineHeight: 1.2,
                  }}
                >
                  Step {step.id + 1} · {step.label}
                </Typography>
                <Typography variant="caption" sx={{ color: c.textMuted }}>
                  {step.description}
                </Typography>
              </Box>
            </Box>

            {/* Connector line */}
            {idx < STEPS.length - 1 && (
              <Box
                sx={{
                  flex: 1, height: 2, mx: 2,
                  background: isComplete
                    ? 'linear-gradient(90deg, #6C63FF, #9A94FF)'
                    : c.borderStrong,
                  borderRadius: 1,
                  transition: 'background 0.3s ease',
                }}
              />
            )}
          </Box>
        )
      })}
    </Box>
  )

  return (
    <Box>
      {/* ---------- PAGE HEADER ---------- */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary }}>
          👥 User Management
        </Typography>
        <Button
          id="create-user-btn"
          variant="contained"
          startIcon={<Add />}
          onClick={openCreate}
          sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
        >
          Add User
        </Button>
      </Box>

      {/* ---------- USERS TABLE ---------- */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: c.primary }} />
            </Box>
          ) : (
            <>
              <Box sx={{ overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>User</TableCell>
                      <TableCell>Email</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Data Access Scope</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u, idx) => {
                      const summary = formatScopeSummary(u)
                      const isFull = summary === 'Full access'
                      const isUnrestricted = summary === 'Unrestricted'
                      return (
                        <TableRow key={u.id} sx={{ '&:hover': { background: c.tableHover } }}>
                          <TableCell>{(page - 1) * 25 + idx + 1}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 32, height: 32, background: 'linear-gradient(135deg, #6C63FF, #FF6584)', fontSize: '0.8rem' }}>
                                {u.full_name?.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: c.textPrimary }}>{u.full_name}</Typography>
                                <Typography variant="caption" sx={{ color: c.textMuted }}>@{u.username}</Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ color: c.textSecondary, fontSize: '0.85rem' }}>{u.email}</TableCell>
                          <TableCell>
                            <Chip
                              label={u.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                              size="small"
                              sx={{
                                background: u.role === 'super_admin' ? 'rgba(255,101,132,0.2)' : 'rgba(108,99,255,0.2)',
                                color: u.role === 'super_admin' ? c.secondary : c.primaryLight,
                                fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={summary}
                              size="small"
                              icon={<Security style={{ fontSize: 14 }} />}
                              sx={{
                                background: isFull ? 'rgba(255,101,132,0.15)' : isUnrestricted ? 'rgba(78,204,163,0.15)' : 'rgba(108,99,255,0.15)',
                                color: isFull ? c.secondary : isUnrestricted ? c.success : c.primaryLight,
                                fontSize: '0.75rem', fontWeight: 600, maxWidth: 220,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.is_active ? 'Active' : 'Inactive'}
                              size="small"
                              sx={{
                                background: u.is_active ? 'rgba(78,204,163,0.2)' : 'rgba(144,144,192,0.1)',
                                color: u.is_active ? c.success : c.textSecondary,
                                fontSize: '0.7rem',
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: c.textMuted, fontSize: '0.8rem' }}>
                            {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Edit User & Data Access Scope">
                                <IconButton id={`edit-user-${u.id}`} size="small" onClick={() => openEdit(u)} sx={{ color: c.primaryLight }}>
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={u.is_active ? 'Deactivate' : 'Activate'}>
                                <IconButton id={`toggle-user-${u.id}`} size="small" onClick={() => handleToggle(u.id)} sx={{ color: c.warning }}>
                                  {u.is_active ? <PersonOff fontSize="small" /> : <Person fontSize="small" />}
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Reset Password">
                                <IconButton id={`reset-pwd-${u.id}`} size="small" onClick={() => handleResetPassword(u.id)} sx={{ color: c.success }}>
                                  <LockReset fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {u.role !== 'super_admin' && (
                                <Tooltip title="Delete">
                                  <IconButton id={`delete-user-${u.id}`} size="small" onClick={() => handleDelete(u.id)} sx={{ color: c.error }}>
                                    <Delete fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <Pagination count={total} page={page} onChange={(_, v) => setPage(v)} color="primary" />
              </Box>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- CREATE / EDIT WIZARD DIALOG ---------- */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { background: c.dialogBg, border: `1px solid ${c.borderStrong}` } } }}
      >
        <DialogTitle sx={{ color: c.textPrimary, fontWeight: 700, pb: 2 }}>
          {editUser ? `Edit User — ${editUser.full_name}` : 'Create New User'}
        </DialogTitle>

        <DialogContent sx={{ pb: 1 }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <StepperHeader />

          {/* ---------- STEP 1 : BASIC INFO ---------- */}
          <Box sx={{ display: activeStep === 0 ? 'block' : 'none' }}>
            <form id="user-form">
              <TextField
                fullWidth label="Full Name" {...register('full_name')}
                error={!!errors.full_name} helperText={errors.full_name?.message}
                sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-fullname' } }}
              />
              <TextField
                fullWidth label="Username" {...register('username')}
                error={!!errors.username} helperText={errors.username?.message}
                sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-username' } }}
              />
              <TextField
                fullWidth label="Email" type="email" {...register('email')}
                error={!!errors.email} helperText={errors.email?.message}
                sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-email' } }}
              />
              <TextField
                fullWidth
                label={editUser ? 'New Password (leave blank to keep)' : 'Password'}
                type="password" {...register('password')}
                error={!!errors.password} helperText={errors.password?.message}
                sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-password' } }}
              />
              <Controller
                name="role"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select {...field} label="Role" id="user-role">
                      <MenuItem value="admin">Admin</MenuItem>
                      <MenuItem value="super_admin">Super Admin</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </form>
          </Box>


          {/* ---------- STEP 2 : DATA ACCESS ---------- */}
          {scopeMounted && (
            <Box sx={{ display: activeStep === 1 ? 'block' : 'none' }}>
              <DataAccessTab
                scopeState={scopeState}
                onChange={setScopeState}
                referenceData={refData}       // 👈 the prefetched data
              />
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 1 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: c.textSecondary }}>
            Cancel
          </Button>

          {activeStep === 1 && (
            <Button onClick={goBack} sx={{ color: c.textSecondary }}>
              ← Back
            </Button>
          )}

          {activeStep === 0 && (
            <Button
              variant="outlined"
              onClick={goNext}
              sx={{ borderColor: c.primaryLight, color: c.primaryLight }}
            >
              Next →
            </Button>
          )}

          {activeStep === 1 && (
            <Button
              id="save-user-btn"
              variant="contained"
              onClick={handleSubmit(onSubmit)}
              disabled={isSubmitting}
              sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
            >
              {isSubmitting
                ? <CircularProgress size={18} color="inherit" />
                : editUser ? 'Update User' : 'Create User'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  )
}