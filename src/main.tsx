import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import './styles/shell.css'
import './styles/studio.css'
import './styles/landing.css'
import './styles/explore.css'
import App from './App.tsx'
import { TEMPLATES } from './project/templates'
import { useEditorStore } from './store/editorStore'
import { useProjectStore, usePlaybackStore } from './store/projectStore'

// Otomatik testler için geliştirme modunda store'lara ve şablonlara erişim (sahne köprüsü: Stage.tsx, `__bridge`).
if (import.meta.env.DEV) Object.assign(window, { __stores: { project: useProjectStore, playback: usePlaybackStore, editor: useEditorStore }, __templates: TEMPLATES })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
