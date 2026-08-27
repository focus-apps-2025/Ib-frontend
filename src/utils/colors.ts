import { useTheme } from '@mui/material'

/**
 * Theme-aware color palette.
 * Returns a set of semantic color tokens that adapt to the current theme mode.
 */
export function useThemeColors() {
    const theme = useTheme()
    const isDark = theme.palette.mode === 'dark'

    return {
        isDarkTheme: isDark,

        // Backgrounds
        background: isDark ? '#0A0A1A' : '#F4F4FA',
        paper: isDark ? '#12122A' : '#FFFFFF',
        sidebar: isDark ? '#0D0D25' : '#FFFFFF',
        headerCell: isDark ? '#1A1A3A' : '#EDEBFA',
        tableHover: isDark ? 'rgba(108,99,255,0.05)' : 'rgba(108,99,255,0.04)',
        agGridBg: isDark ? '#0D0D25' : '#FFFFFF',
        agGridOddRow: isDark ? '#0A0A20' : '#F8F7FF',
        agGridHeader: isDark ? '#1A1A3A' : '#EDEBFA',
        accordionBg: isDark ? '#12122A' : '#FFFFFF',

        // Text
        textPrimary: isDark ? '#E8E8FF' : '#1A1A2E',
        textSecondary: isDark ? '#9090C0' : '#6B6B8D',
        textMuted: isDark ? '#6060A0' : '#9A9AB0',
        textActive: isDark ? '#9A94FF' : '#5548E8',

        // Accent colors (largely same in both modes, but adjusted for contrast)
        primary: '#6C63FF',
        primaryLight: isDark ? '#9A94FF' : '#8F86FF',
        secondary: '#FF6584',
        success: isDark ? '#4ECCA3' : '#2E9E7C',
        warning: isDark ? '#FFD93D' : '#D9B400',
        error: isDark ? '#FF6B6B' : '#E85C5C',
        info: '#26C6DA',

        // Borders & overlays
        border: 'rgba(108, 99, 255, 0.15)',
        borderStrong: 'rgba(108, 99, 255, 0.3)',
        borderMuted: 'rgba(108, 99, 255, 0.1)',
        cardBg: isDark ? `${'#6C63FF'}18` : `${'#6C63FF'}0D`,

        // Gradient backgrounds
        sidebarLogoBg: isDark
            ? 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(255,101,132,0.05))'
            : 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(255,101,132,0.04))',
        appBarBg: isDark
            ? 'rgba(13, 13, 37, 0.95)'
            : 'rgba(255, 255, 255, 0.95)',
        loginBg: isDark
            ? 'linear-gradient(135deg, #0A0A1A 0%, #1A0A2E 40%, #0A1A2E 100%)'
            : 'linear-gradient(135deg, #F4F4FA 0%, #EDE9FF 40%, #E8F0FF 100%)',
        loginCardBg: isDark
            ? 'rgba(18, 18, 42, 0.8)'
            : 'rgba(255, 255, 255, 0.85)',
        loginShadow: isDark
            ? '0 24px 64px rgba(0,0,0,0.4)'
            : '0 24px 64px rgba(108, 99, 255, 0.15)',

        // Dialogs
        dialogBg: isDark ? '#12122A' : '#FFFFFF',
        menuBg: isDark ? '#12122A' : '#FFFFFF',

        // Chip
        chipWhiteBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(26,26,46,0.05)',

        // Charts
        chartTooltipBg: isDark ? '#12122A' : '#FFFFFF',
        chartGrid: isDark ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.15)',
        chartTick: isDark ? '#9090C0' : '#6B6B8D',

        // AG Grid
        agBorder: isDark ? 'rgba(108,99,255,0.1)' : 'rgba(108,99,255,0.2)',
        agRowHover: isDark ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.05)',
        agSelectedRow: isDark ? 'rgba(108,99,255,0.15)' : 'rgba(108,99,255,0.1)',
    }
}

export type ThemeColors = ReturnType<typeof useThemeColors>