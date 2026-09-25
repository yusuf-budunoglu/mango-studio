export type Route = { screen: 'home' } | { screen: 'editor'; projectId: string }

export function parseHash(hash: string): Route {
  const match = hash.match(/^#\/p\/([\w-]+)$/)
  return match ? { screen: 'editor', projectId: match[1] } : { screen: 'home' }
}

export function navigate(route: Route) {
  window.location.hash = route.screen === 'editor' ? `/p/${route.projectId}` : '/'
}
