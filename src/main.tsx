import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useProjectStore, usePlaybackStore } from './store/projectStore'

// Otomatik testler için geliştirme modunda store'lara erişim.
if (import.meta.env.DEV) Object.assign(window, { __stores: { project: useProjectStore, playback: usePlaybackStore } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
