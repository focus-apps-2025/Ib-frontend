import { useState, useEffect } from 'react'
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableHead, TableRow, Button, IconButton, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
  InputLabel, Tooltip, CircularProgress, Alert,
  Avatar, Pagination,
} from '@mui/material'
import { Add, Edit, Delete, LockReset, PersonOff, Person } from '@mui/icons-material'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { usersApi } from '../../lib/api'
import { useThemeColors } from '../../utils/colors'

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

export default function UsersPage() {
  const c = useThemeColors()
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [error, setError] = useState('')

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<UserFormData>({ resolver: zodResolver(userSchema) })

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await usersApi.list({ page, page_size: 25 })
      setUsers(res.data.data || [])
      setTotal(res.data.total_pages || 1)
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [page])

  const openCreate = () => {
    setEditUser(null)
    reset({ username: '', email: '', full_name: '', password: '', role: 'admin' })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (user: User) => {
    setEditUser(user)
    reset({ username: user.username, email: user.email, full_name: user.full_name, role: user.role as 'admin' | 'super_admin', password: '' })
    setError('')
    setDialogOpen(true)
  }

  const onSubmit = async (data: UserFormData) => {
    setError('')
    try {
      if (editUser) {
        const payload = { ...data }
        delete payload.password
        await usersApi.update(editUser.id, payload)
      } else {
        await usersApi.create(data)
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

  return (
    <Box>
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
                      <TableCell>Status</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.map((u, idx) => (
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
                            <Tooltip title="Edit">
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
                    ))}
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        slotProps={{ paper: { sx: { background: c.dialogBg, border: `1px solid ${c.borderStrong}` } } }}>
        <DialogTitle sx={{ color: c.textPrimary, fontWeight: 700 }}>
          {editUser ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <form id="user-form">
            <TextField fullWidth label="Full Name" {...register('full_name')} error={!!errors.full_name} helperText={errors.full_name?.message} sx={{ mt: 1, mb: 2 }} slotProps={{ htmlInput: { id: 'user-fullname' } }} />
            <TextField fullWidth label="Username" {...register('username')} error={!!errors.username} helperText={errors.username?.message} sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-username' } }} />
            <TextField fullWidth label="Email" type="email" {...register('email')} error={!!errors.email} helperText={errors.email?.message} sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-email' } }} />
            <TextField fullWidth label={editUser ? 'New Password (leave blank to keep)' : 'Password'} type="password" {...register('password')} error={!!errors.password} helperText={errors.password?.message} sx={{ mb: 2 }} slotProps={{ htmlInput: { id: 'user-password' } }} />
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
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ color: c.textSecondary }}>Cancel</Button>
          <Button
            id="save-user-btn"
            variant="contained"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            sx={{ background: 'linear-gradient(135deg, #6C63FF, #9A94FF)' }}
          >
            {isSubmitting ? <CircularProgress size={18} color="inherit" /> : editUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
