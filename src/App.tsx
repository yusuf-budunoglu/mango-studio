import { useEffect, useState } from 'react'
import { parseHash } from './router'
import { Assets } from './screens/Assets'
import { ComingSoon } from './screens/ComingSoon'
import { Editor } from './screens/Editor'
import { Home } from './screens/Home'
import { Templates } from './screens/Templates'
import { Videos } from './screens/Videos'
import { useUiStore } from './store/uiStore'

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash))
      // Arama sayfaya özeldir; başka sayfaya geçince eski arama listeyi gizlice süzmesin.
      useUiStore.getState().setSearch('')
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  switch (route.screen) {
    case 'editor':
      return <Editor key={route.projectId} projectId={route.projectId} />
    case 'videos':
      return <Videos />
    case 'templates':
      return <Templates />
    case 'assets':
      return <Assets />
    case 'soon':
      return <ComingSoon feature={route.feature} />
    default:
      return <Home />
  }
}
