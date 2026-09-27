import { PanelLeft, Search } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '../components/LanguageSelect'
import { navigate, routeToHash, type Route } from '../router'
import { useUiStore } from '../store/uiStore'
import { Sidebar } from './Sidebar'

const TOP_LINKS: { labelKey: string; route: Route }[] = [
  { labelKey: 'nav.explore', route: { screen: 'home' } },
  { labelKey: 'nav.templates', route: { screen: 'templates' } },
  { labelKey: 'nav.videos', route: { screen: 'videos' } },
  { labelKey: 'nav.assets', route: { screen: 'assets' } },
]

/** Ana sayfadaki MCP tanıtımına kaydırır; başka sayfadaysak önce ana sayfaya gider. */
function goToMcp(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  navigate({ screen: 'home' })
  const started = performance.now()
  const tryScroll = () => {
    const section = document.getElementById('mcp')
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' })
    else if (performance.now() - started < 1500) requestAnimationFrame(tryScroll)
  }
  requestAnimationFrame(tryScroll)
}

/** Üst menü: seçili sayfa turuncu, öne çıkan öğelerin yazısında sürekli bir ışık süzülür. */
function TopNav({ current }: { current: Route }) {
  const { t } = useTranslation()
  return (
    <nav className="topnav" aria-label={t('nav.topNav')}>
      {TOP_LINKS.map((link) => {
        const active = link.route.screen === current.screen
        const label = t(link.labelKey)
        return (
          <a key={link.labelKey} className={`topnav-item ${active ? 'is-active' : ''}`} href={routeToHash(link.route)} aria-current={active ? 'page' : undefined}>
            <span className="shimmer-text" data-text={label}>
              {label}
            </span>
          </a>
        )
      })}
      <span className="topnav-divider" aria-hidden="true" />
      <a className="topnav-item topnav-item--gold" href={routeToHash({ screen: 'home' })} onClick={goToMcp}>
        <span className="shimmer-text shimmer-text--gold" data-text={t('nav.mcp')}>
          {t('nav.mcp')}
        </span>
        <span className="topnav-badge">{t('nav.new')}</span>
      </a>
    </nav>
  )
}

/** Sol menü + üst çubuk + içerik. Editör hariç tüm sayfalar bunu kullanır. */
export function AppShell({ current, title, children }: { current: Route; title: string; children: ReactNode }) {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="shell">
      <Sidebar current={current} />
      <div className="shell-main">
        <header className="shell-topbar">
          <button type="button" className="icon-button" onClick={toggleSidebar} aria-label={t('nav.toggleSidebar')} title={t('nav.toggleSidebar')}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
          <h1 className="visually-hidden">{title}</h1>
          <TopNav current={current} />
          <label className="shell-search">
            <Search size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="visually-hidden">{t('search.placeholder')}</span>
            <input
              id="global-search"
              type="search"
              value={search}
              placeholder={t('search.placeholder')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="shell-actions">
            <LanguageSelect />
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}
