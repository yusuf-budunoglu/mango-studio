import { useEffect, useState } from 'react'
import { Editor } from './screens/Editor'
import { parseHash } from './router'
import { Home } from './screens/Home'

export default function App() {
  const [route, setRoute] = useState(() => parseHash(window.location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  return route.screen === 'editor' ? <Editor key={route.projectId} projectId={route.projectId} /> : <Home />
}
