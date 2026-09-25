import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import './styles/shell.css'
import App from './App.tsx'
import { useEditorStore } from './store/editorStore'
import { useProjectStore, usePlaybackStore } from './store/projectStore'

// Otomatik testler için geliştirme modunda store'lara erişim.
if (import.meta.env.DEV) Object.assign(window, { __stores: { project: useProjectStore, playback: usePlaybackStore, editor: useEditorStore } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
