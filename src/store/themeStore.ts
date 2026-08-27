import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode } from '../theme'

interface ThemeState {
    mode: ThemeMode
    toggleTheme: () => void
    setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set) => ({
            mode: 'dark', // Default is dark (current theme)
            toggleTheme: () =>
                set((state) => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
            setMode: (mode) => set({ mode }),
        }),
        {
            name: 'theme-storage',
        }
    )
)