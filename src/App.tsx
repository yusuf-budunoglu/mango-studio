import { Fragment, useEffect, useState } from 'react'
import { AccountLayer } from './components/AccountLayer'
import { supabase } from './cloud/client'
import { goTo, internalLinkPath, legacyHashPath, parsePath, type Route } from './router'
import { Assets } from './screens/Assets'
import { ClaudeConnect } from './screens/ClaudeConnect'
import { ComingSoon } from './screens/ComingSoon'
import { Credits } from './screens/Credits'
import { Editor } from './screens/Editor'
import { Home } from './screens/Home'
import { Landing } from './screens/Landing'
import { Legal } from './screens/Legal'
import { Members } from './screens/Members'
import { NewProject } from './screens/NewProject'
import { OAuthConsent } from './screens/OAuthConsent'
import { Pricing } from './screens/Pricing'
import { Profile } from './screens/Profile'
import { Prompts } from './screens/Prompts'
import { ResetPassword } from './screens/ResetPassword'
import { SharedView } from './screens/SharedView'
import { SignUp } from './screens/SignUp'
import { Studio } from './screens/Studio'
import { TemplatePreview } from './screens/TemplatePreview'
import { Templates } from './screens/Templates'
import { takeNext } from './store/afterSignIn'
import { initAuth, useAuthStore } from './store/authStore'
import { useUiStore } from './store/uiStore'

export default function App() {
  const [route, setRoute] = useState(() => {
    // Eski `#/...` adresiyle gelen (yer imi, paylaşılmış bağlantı) yeni yola taşınır.
    const legacy = legacyHashPath(window.location.hash)
    if (legacy) window.history.replaceState(null, '', legacy)
    return parsePath(window.location.pathname)
  })
  const authVersion = useAuthStore((s) => s.version)
  const authStatus = useAuthStore((s) => s.status)

  useEffect(() => initAuth(), [])

  // Üyelik sayfasından giriş bağlantısıyla dönen kullanıcıyı açmak istediği şablona/sayfaya götür.
  useEffect(() => {
    if (authStatus !== 'in') return
    const next = takeNext()
    if (next && next !== window.location.pathname) goTo(next)
  }, [authStatus])

  useEffect(() => {
    const onChange = () => {
      setRoute(parsePath(window.location.pathname))
      // Arama sayfaya özeldir; başka sayfaya geçince eski arama listeyi gizlice süzmesin.
      useUiStore.getState().setSearch('')
      window.scrollTo(0, 0)
    }
    // Site içi bağlantılar (`<a href="/templates">`) sayfayı yeniden yüklemeden açılır.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest('a') : null
      const path = anchor?.href ? internalLinkPath(anchor) : undefined
      if (path === undefined) return
      event.preventDefault()
      goTo(path)
    }
    window.addEventListener('popstate', onChange)
    document.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('popstate', onChange)
      document.removeEventListener('click', onClick)
    }
  }, [])

  // Oturum okunana kadar bekle: yanlış depodan "proje bulunamadı" göstermemek için.
  if (authStatus === 'loading') return null

  return (
    <>
      {/* Kullanıcı değişince (giriş/çıkış) ekranlar yeniden kurulur ve listeleri yeni depodan okur. */}
      <Fragment key={authVersion}>{renderScreen(route, !!supabase && authStatus === 'out')}</Fragment>
      <AccountLayer />
    </>
  )
}

// Üye olmayan ziyaretçi şablonları görür ama kullanamaz: şablon açma, yeni proje, editör, Studio ve Dosyalar üyelik sayfasına gider.
const MEMBERS_ONLY = new Set<Route['screen']>(['template', 'new', 'editor', 'studio', 'assets', 'oauth', 'members'])

function renderScreen(route: Route, guest: boolean) {
  if (guest && MEMBERS_ONLY.has(route.screen)) return <SignUp key={route.screen} route={route} />
  switch (route.screen) {
    case 'welcome':
      return <Landing />
    case 'editor':
      return <Editor key={route.projectId} projectId={route.projectId} />
    case 'studio':
      return <Studio folderId={route.folderId} view={route.view} />
    case 'shared':
      return <SharedView key={route.shareId} shareId={route.shareId} />
    case 'new':
      return <NewProject key={route.folderId ?? ''} folderId={route.folderId} />
    case 'templates':
      return <Templates />
    case 'template':
      return <TemplatePreview key={route.templateId} templateId={route.templateId} />
    case 'prompts':
      return <Prompts promptId={route.promptId} />
    case 'assets':
      return <Assets />
    case 'credits':
      return <Credits />
    case 'privacy':
    case 'terms':
      return <Legal key={route.screen} doc={route.screen} />
    case 'pricing':
      return <Pricing />
    case 'profile':
      return <Profile />
    case 'members':
      return <Members />
    case 'signup':
      return guest ? <SignUp route={route} /> : <Home />
    case 'oauth':
      return <OAuthConsent />
    case 'reset':
      return <ResetPassword />
    case 'claude':
      return <ClaudeConnect />
    case 'soon':
      return <ComingSoon feature={route.feature} />
    default:
      // Herkes (üye olsun olmasın) canlı Keşfet sayfasıyla karşılanır; uzun tanıtım sayfası /welcome.
      return <Home />
  }
}
