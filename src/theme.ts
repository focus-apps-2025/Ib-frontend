import { createTheme, type Theme } from '@mui/material'

// ─── Dark Theme (current default) ────────────────────────────────────────────
export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#6C63FF', light: '#9A94FF', dark: '#4B44CC' },
        secondary: { main: '#FF6584', light: '#FF8FA3', dark: '#CC4D68' },
        background: {
            default: '#0A0A1A',
            paper: '#12122A',
        },
        success: { main: '#4ECCA3' },
        warning: { main: '#FFD93D' },
        error: { main: '#FF6B6B' },
        text: {
            primary: '#E8E8FF',
            secondary: '#9090C0',
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
        h4: { fontWeight: 700 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(108, 99, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#1A1A3A',
                    fontWeight: 700,
                    color: '#9090C0',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: '0.08em',
                },
            },
        },
    },
})

// ─── Light Theme ─────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#6C63FF', light: '#8F86FF', dark: '#5548E8' },
        secondary: { main: '#FF6584', light: '#FF8FA3', dark: '#CC4D68' },
        background: {
            default: '#F4F4FA',
            paper: '#FFFFFF',
        },
        success: { main: '#2E9E7C' },
        warning: { main: '#D9B400' },
        error: { main: '#E85C5C' },
        text: {
            primary: '#1A1A2E',
            secondary: '#6B6B8D',
        },
    },
    typography: {
        fontFamily: '"Inter", "Roboto", "Helvetica", sans-serif',
        h4: { fontWeight: 700 },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    border: '1px solid rgba(108, 99, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 2px 12px rgba(26, 26, 46, 0.06)',
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    fontWeight: 600,
                    borderRadius: 8,
                },
            },
        },
        MuiTableCell: {
            styleOverrides: {
                head: {
                    backgroundColor: '#EDEBFA',
                    fontWeight: 700,
                    color: '#6B6B8D',
                    textTransform: 'uppercase',
                    fontSize: '0.7rem',
                    letterSpacing: '0.08em',
                },
            },
        },
    },
})

export type ThemeMode = 'dark' | 'light'
export const themes: Record<ThemeMode, Theme> = {
    dark: darkTheme,
    light: lightTheme,
}