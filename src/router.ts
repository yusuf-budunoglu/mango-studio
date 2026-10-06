/** Henüz yapılmamış araçlar; menüde "yakında" etiketiyle görünür. */
export const COMING_SOON = ['text-to-video', 'audio', 'music', 'voiceover', 'sound-effects', 'auto-video'] as const
export type ComingSoonFeature = (typeof COMING_SOON)[number]

/** Studio'nun bölümleri: Tümü (boş), videolar, görseller (tasarımlar), sesler, kullanıcının şablonları. */
export const STUDIO_VIEWS = ['videos', 'images', 'sounds', 'templates'] as const
export type StudioView = (typeof STUDIO_VIEWS)[number]

export type Route =
  | { screen: 'home' }
  /** Hesabı/alışkanlığı olmayan ziyaretçi için tanıtım ve fiyat sayfası */
  | { screen: 'welcome' }
  /** Kullanıcının projeleri; `view` bir bölüm, `folderId` bir klasör; ikisi de yoksa "Tümü" */
  | { screen: 'studio'; folderId?: string; view?: StudioView }
  /** Bağlantıyla paylaşılan proje (üye olmayan da açar) */
  | { screen: 'shared'; shareId: string }
  /** Yeni proje başlatma (hareket / tasarım); oluşturulan proje `folderId` klasörüne girer */
  | { screen: 'new'; folderId?: string }
  | { screen: 'templates' }
  /** Şablon önizleme sayfası */
  | { screen: 'template'; templateId: string }
  /** Prompt kütüphanesi; `promptId` varsa o prompt'un penceresi açık */
  | { screen: 'prompts'; promptId?: string }
  | { screen: 'assets' }
  | { screen: 'credits' }
  /** Gizlilik politikası ve kullanım koşulları (herkese açık) */
  | { screen: 'privacy' }
  | { screen: 'terms' }
  | { screen: 'pricing' }
  /** Hesap: e-posta, plan, kredi, çıkış (girişsizken giriş daveti) */
  | { screen: 'profile' }
  /** Yönetici ekranı: üyeler ve yeni üye bildirimi (yalnızca `profiles.is_admin`) */
  | { screen: 'members' }
  /** Üye olma sayfası (sağ üstteki "Üye ol") */
  | { screen: 'signup' }
  /** Claude Code (MCP) bağlanırken açılan onay sayfası; istek kimliği adresteki `?authorization_id=` */
  | { screen: 'oauth' }
  /** Yeni parola belirleme: e-postadaki sıfırlama bağlantısı buraya getirir */
  | { screen: 'reset' }
  | { screen: 'soon'; feature: ComingSoonFeature }
  /** Claude Code'a bağlama (MCP) sayfası. `/mcp` yolu MCP sunucusunun (Worker) olduğu için sayfa `/claude`'da. */
  | { screen: 'claude' }
  | { screen: 'editor'; projectId: string }

/** Supabase Auth'un (OAuth sunucusu) kullanıcıyı onay için gönderdiği yol; panelindeki "Authorization Path" ile aynı olmalı. */
export const OAUTH_CONSENT_PATH = '/oauth/consent'
/** Parola sıfırlama e-postasındaki bağlantının açtığı yol. */
export const RESET_PASSWORD_PATH = '/reset-password'

/** Adres yolu (`/templates`, `/t/crystal`) → sayfa. Sondaki eğik çizgi yok sayılır; tanınmayan yol ana sayfa. */
export function parsePath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/'
  const editor = path.match(/^\/p\/([\w-]+)$/)
  if (editor) return { screen: 'editor', projectId: editor[1] }
  // eski "Videolar" adresi Studio'ya açılır
  if (path === '/studio' || path === '/videos') return { screen: 'studio' }
  const studio = path.match(/^\/studio\/([\w-]+)$/)
  if (studio) return (STUDIO_VIEWS as readonly string[]).includes(studio[1]) ? { screen: 'studio', view: studio[1] as StudioView } : { screen: 'studio', folderId: studio[1] }
  const shared = path.match(/^\/s\/([\w-]+)$/)
  if (shared) return { screen: 'shared', shareId: shared[1] }
  if (path === '/new') return { screen: 'new' }
  const fresh = path.match(/^\/new\/([\w-]+)$/)
  if (fresh) return { screen: 'new', folderId: fresh[1] }
  const template = path.match(/^\/t\/([\w-]+)$/)
  if (template) return { screen: 'template', templateId: template[1] }
  if (path === '/welcome') return { screen: 'welcome' }
  if (path === '/templates') return { screen: 'templates' }
  if (path === '/prompts') return { screen: 'prompts' }
  const prompt = path.match(/^\/prompts\/([\w-]+)$/)
  if (prompt) return { screen: 'prompts', promptId: prompt[1] }
  if (path === '/assets') return { screen: 'assets' }
  if (path === '/credits') return { screen: 'credits' }
  if (path === '/privacy') return { screen: 'privacy' }
  if (path === '/terms') return { screen: 'terms' }
  if (path === '/pricing') return { screen: 'pricing' }
  if (path === '/profile') return { screen: 'profile' }
  if (path === '/members') return { screen: 'members' }
  if (path === '/signup') return { screen: 'signup' }
  if (path === OAUTH_CONSENT_PATH) return { screen: 'oauth' }
  if (path === RESET_PASSWORD_PATH) return { screen: 'reset' }
  // `/soon/mcp`: sayfanın "yakında" olduğu dönemden kalan bağlantılar
  if (path === '/claude' || path === '/soon/mcp') return { screen: 'claude' }
  const soon = path.match(/^\/soon\/([\w-]+)$/)
  if (soon && (COMING_SOON as readonly string[]).includes(soon[1])) return { screen: 'soon', feature: soon[1] as ComingSoonFeature }
  return { screen: 'home' }
}

export function routeToPath(route: Route): string {
  switch (route.screen) {
    case 'editor':
      return `/p/${route.projectId}`
    case 'soon':
      return `/soon/${route.feature}`
    case 'shared':
      return `/s/${route.shareId}`
    case 'studio':
      if (route.view) return `/studio/${route.view}`
      return route.folderId ? `/studio/${route.folderId}` : '/studio'
    case 'new':
      return route.folderId ? `/${route.screen}/${route.folderId}` : `/${route.screen}`
    case 'template':
      return `/t/${route.templateId}`
    case 'prompts':
      return route.promptId ? `/prompts/${route.promptId}` : '/prompts'
    case 'home':
      return '/'
    case 'oauth':
      return OAUTH_CONSENT_PATH
    case 'reset':
      return RESET_PASSWORD_PATH
    default:
      return `/${route.screen}`
  }
}

/** Eski `#/...` adresinin (yer imleri, paylaşılmış bağlantılar) yeni yolu; eski biçimde değilse `undefined`. */
export function legacyHashPath(hash: string): string | undefined {
  return hash.startsWith('#/') ? hash.slice(1) : undefined
}

/** Sayfayı yeniden yüklemeden adresi değiştirir; `App` `popstate` ile yeni sayfayı çizer. */
export function goTo(path: string) {
  if (path !== window.location.pathname) window.history.pushState(null, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

export function navigate(route: Route) {
  goTo(routeToPath(route))
}

/**
 * Site içi bağlantı tıklaması için gidilecek yol; tarayıcıya bırakılması gereken tıklamada `undefined`
 * (yeni sekme / indirme, başka site, dosya adresi, aynı sayfadaki `#bölüm` bağlantısı).
 */
export function internalLinkPath(anchor: HTMLAnchorElement, current: Location = window.location): string | undefined {
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return undefined
  const url = new URL(anchor.href, current.href)
  if (url.origin !== current.origin) return undefined
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return undefined
  if (url.hash && url.pathname === current.pathname) return undefined
  return url.pathname
}
