export type Page = 'home' | 'videos' | 'templates' | 'assets'

/** Henüz yapılmamış araçlar; menüde "yakında" etiketiyle görünür. */
export const COMING_SOON = ['music', 'voiceover', 'sound-effects'] as const
export type ComingSoonFeature = (typeof COMING_SOON)[number]

export type Route =
  | { screen: 'home' }
  | { screen: 'videos' }
  | { screen: 'templates' }
  | { screen: 'assets' }
  | { screen: 'soon'; feature: ComingSoonFeature }
  | { screen: 'editor'; projectId: string }

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '')
  const editor = path.match(/^\/p\/([\w-]+)$/)
  if (editor) return { screen: 'editor', projectId: editor[1] }
  if (path === '/videos') return { screen: 'videos' }
  if (path === '/templates') return { screen: 'templates' }
  if (path === '/assets') return { screen: 'assets' }
  const soon = path.match(/^\/soon\/([\w-]+)$/)
  if (soon && (COMING_SOON as readonly string[]).includes(soon[1])) return { screen: 'soon', feature: soon[1] as ComingSoonFeature }
  return { screen: 'home' }
}

export function routeToHash(route: Route): string {
  switch (route.screen) {
    case 'editor':
      return `#/p/${route.projectId}`
    case 'soon':
      return `#/soon/${route.feature}`
    case 'home':
      return '#/'
    default:
      return `#/${route.screen}`
  }
}

export function navigate(route: Route) {
  window.location.hash = routeToHash(route).slice(1)
}
