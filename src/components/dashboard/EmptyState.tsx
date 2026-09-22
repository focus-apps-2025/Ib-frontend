import React from 'react'
import { Box, Typography } from '@mui/material'
import { InboxOutlined } from '@mui/icons-material'
import { useThemeColors } from '../../utils/colors'

interface EmptyStateProps {
  title?: string
  message?: string
  minHeight?: string | number
}

export default function EmptyState({ 
  title = "No data found", 
  message = "Try adjusting your filters or uploading new survey data.",
  minHeight = 400
}: EmptyStateProps) {
  const c = useThemeColors()
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight,
        p: 4,
        textAlign: 'center',
        background: `linear-gradient(135deg, ${c.paper} 0%, ${c.background} 100%)`,
        borderRadius: 3,
        border: `1px dashed ${c.border}`,
        width: '100%',
        mt: 2
      }}
    >
      <Box sx={{ p: 3, borderRadius: '50%', background: `${c.border}40`, mb: 3 }}>
        <InboxOutlined sx={{ fontSize: 64, color: c.textSecondary }} />
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, color: c.textPrimary, mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body1" sx={{ color: c.textSecondary, maxWidth: 400 }}>
        {message}
      </Typography>
    </Box>
  )
}
