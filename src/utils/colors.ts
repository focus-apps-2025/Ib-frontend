import { useTheme } from '@mui/material'
import { useMemo } from 'react'

/**
 * Theme-aware color palette.
 * Returns a set of semantic color tokens that adapt to the current theme mode.
 * Light mode: Cream/off-white backgrounds with #007FFF primary
 * Dark mode: Deep purple/bluish dark backgrounds with #6C63FF primary
 */
export function useThemeColors() {
    const theme = useTheme()

    return useMemo(() => {
        const isDark = theme.palette.mode === 'dark'

        // Primary color based on theme mode
        const primary = isDark ? '#6C63FF' : '#007FFF'
        const primaryLight = isDark ? '#9A94FF' : '#3399FF'
        const primaryBg = isDark ? 'rgba(108, 99, 255, 0.1)' : 'rgba(0, 127, 255, 0.08)'

        // Helper for consistent opacity with primary color
        const primaryWithOpacity = (opacity: number) => {
            if (isDark) {
                return `rgba(108, 99, 255, ${opacity})`
            }
            return `rgba(0, 127, 255, ${opacity})`
        }

        return {
            isDarkTheme: isDark,

            // Backgrounds - Light mode uses cream/off-white
            background: isDark ? '#0A0A1A' : '#FBFBF7', // Warm cream
            paper: isDark ? '#12122A' : '#FFFFFF', // Pure white for cards
            sidebar: isDark ? '#0D0D25' : '#F8F8F4', // Slightly darker cream
            headerCell: isDark ? '#1A1A3A' : '#F0F4FA', // Light blue-tinted cream
            tableHover: isDark
                ? 'rgba(108,99,255,0.05)'
                : 'rgba(0, 127, 255, 0.04)',
            agGridBg: isDark ? '#0D0D25' : '#FBFBF7',
            agGridOddRow: isDark ? '#0A0A20' : '#F7F8F3',
            agGridHeader: isDark ? '#1A1A3A' : '#F0F4FA',
            accordionBg: isDark ? '#12122A' : '#FFFFFF',

            // Text - Adjusted for cream background
            textPrimary: isDark ? '#E8E8FF' : '#1A1A2E',
            textSecondary: isDark ? '#9090C0' : '#5A5A7A',
            textMuted: isDark ? '#6060A0' : '#9A9AA8',
            textActive: isDark ? '#9A94FF' : '#007FFF',

            // Accent colors
            primary: primary,
            primaryLight: primaryLight,
            primaryBg: primaryBg,
            secondary: isDark ? '#FF6584' : '#FF6B8A',
            success: isDark ? '#4ECCA3' : '#2E9E7C',
            warning: isDark ? '#FFD93D' : '#D9B400',
            error: isDark ? '#FF6B6B' : '#E85C5C',
            info: isDark ? '#26C6DA' : '#00A8CC',

            // Borders & overlays - Using primary color
            border: primaryWithOpacity(0.15),
            borderStrong: primaryWithOpacity(0.3),
            borderMuted: primaryWithOpacity(0.08),
            cardBg: isDark
                ? 'rgba(108,99,255,0.08)'
                : 'rgba(0, 127, 255, 0.05)',

            // Gradient backgrounds
            sidebarLogoBg: isDark
                ? 'linear-gradient(135deg, rgba(108,99,255,0.15), rgba(255,101,132,0.05))'
                : 'linear-gradient(135deg, rgba(0, 127, 255, 0.08), rgba(255,107,138,0.04))',
            appBarBg: isDark
                ? 'rgba(13, 13, 37, 0.95)'
                : 'rgba(251, 251, 247, 0.95)', // Cream with opacity
            loginBg: isDark
                ? 'linear-gradient(135deg, #0A0A1A 0%, #1A0A2E 40%, #0A1A2E 100%)'
                : 'linear-gradient(135deg, #FBFBF7 0%, #F0F4FA 40%, #EBF0FF 100%)', // Cream to light blue
            loginCardBg: isDark
                ? 'rgba(18, 18, 42, 0.8)'
                : 'rgba(255, 255, 255, 0.9)',
            loginShadow: isDark
                ? '0 24px 64px rgba(0,0,0,0.4)'
                : '0 24px 64px rgba(0, 127, 255, 0.12)',

            // Dialogs
            dialogBg: isDark ? '#12122A' : '#FFFFFF',
            menuBg: isDark ? '#12122A' : '#FFFFFF',

            // Chip
            chipWhiteBg: isDark
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(26,26,46,0.04)',

            // Charts
            chartTooltipBg: isDark ? '#12122A' : '#FFFFFF',
            chartGrid: isDark
                ? 'rgba(108,99,255,0.1)'
                : 'rgba(0, 127, 255, 0.12)',
            chartTick: isDark ? '#9090C0' : '#5A5A7A',

            // AG Grid
            agBorder: isDark
                ? 'rgba(108,99,255,0.1)'
                : 'rgba(0, 127, 255, 0.15)',
            agRowHover: isDark
                ? 'rgba(108,99,255,0.08)'
                : 'rgba(0, 127, 255, 0.04)',
            agSelectedRow: isDark
                ? 'rgba(108,99,255,0.15)'
                : 'rgba(0, 127, 255, 0.08)',
        }
    }, [theme.palette.mode])
}

export type ThemeColors = ReturnType<typeof useThemeColors>