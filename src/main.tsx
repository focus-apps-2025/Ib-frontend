import React from 'react'
import ReactDOM from 'react-dom/client'
import { ModuleRegistry, AllCommunityModule, InfiniteRowModelModule } from 'ag-grid-community'
import App from './App.tsx'
import { LAYOUT_CONFIG } from './config/layout'
import './index.css'

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule, InfiniteRowModelModule])

const zoomScale = LAYOUT_CONFIG.zoomScale || 0.8
document.documentElement.style.zoom = String(zoomScale)
document.documentElement.style.setProperty('--zoom-scale', String(zoomScale))

// Apply theme CSS variables before render to prevent flash
const stored = localStorage.getItem('theme-storage')
let mode: 'dark' | 'light' = 'dark'
try {
  if (stored) {
    const parsed = JSON.parse(stored)
    if (parsed?.state?.mode === 'light' || parsed?.state?.mode === 'dark') {
      mode = parsed.state.mode
    }
  }
} catch { /* ignore */ }

const isDark = mode === 'dark'
const root = document.documentElement
root.style.setProperty('--app-bg', isDark ? '#0A0A1A' : '#F4F4FA')
root.style.setProperty('--app-text', isDark ? '#E8E8FF' : '#1A1A2E')
root.style.setProperty('--scrollbar-track', isDark ? 'rgba(108,99,255,0.05)' : 'rgba(108,99,255,0.05)')
root.style.setProperty('--scrollbar-thumb', isDark ? 'rgba(108,99,255,0.3)' : 'rgba(108,99,255,0.25)')
root.style.setProperty('--scrollbar-thumb-hover', isDark ? 'rgba(108,99,255,0.5)' : 'rgba(108,99,255,0.4)')
document.body.style.background = isDark ? '#0A0A1A' : '#F4F4FA'
document.body.style.color = isDark ? '#E8E8FF' : '#1A1A2E'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)