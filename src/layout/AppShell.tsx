import { Moon, PanelLeft, Search, Sun } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AccountButton } from '../components/AccountButton'
import { routeToPath, type Route } from '../router'
import { useUiStore } from '../store/uiStore'
import { Sidebar } from './Sidebar'

const TOP_LINKS: { labelKey: string; route: Route }[] = [
  { labelKey: 'nav.explore', route: { screen: 'home' } },
  { labelKey: 'nav.templates', route: { screen: 'templates' } },
  { labelKey: 'nav.prompts', route: { screen: 'prompts' } },
  { labelKey: 'nav.audio', route: { screen: 'soon', feature: 'audio' } },
  { labelKey: 'nav.studio', route: { screen: 'studio' } },
  { labelKey: 'nav.assets', route: { screen: 'assets' } },
]

/** Üst menü: seçili sayfa turuncu; yalnızca MCP yazısında sürekli bir ışık süzülür. */
function TopNav({ current }: { current: Route }) {
  const { t } = useTranslation()
  return (
    <nav className="topnav" aria-label={t('nav.topNav')}>
      {TOP_LINKS.map((link) => {
        const screen = current.screen === 'template' ? 'templates' : current.screen
        const active =
          link.route.screen === 'soon' ? current.screen === 'soon' && current.feature === link.route.feature : link.route.screen === screen
        const label = t(link.labelKey)
        return (
          <a key={link.labelKey} className={`topnav-item ${active ? 'is-active' : ''}`} href={routeToPath(link.route)} aria-current={active ? 'page' : undefined}>
            {label}
          </a>
        )
      })}
      <span className="topnav-divider" aria-hidden="true" />
      <a className={`topnav-item topnav-item--gold ${current.screen === 'claude' ? 'is-active' : ''}`} href={routeToPath({ screen: 'claude' })} aria-current={current.screen === 'claude' ? 'page' : undefined}>
        <span className="shimmer-text shimmer-text--gold" data-text={t('nav.mcp')}>
          {t('nav.mcp')}
        </span>
        <span className="topnav-badge">{t('nav.new')}</span>
      </a>
    </nav>
  )
}

/**
 * Sol menü + üst çubuk + içerik. Editör hariç tüm sayfalar bunu kullanır.
 * `bare`: sol menü yok, marka üst çubukta (giriş yapmamış ziyaretçinin ana sayfası, Higgsfield gibi).
 */
export function AppShell({ current, title, bare = false, children }: { current: Route; title: string; bare?: boolean; children: ReactNode }) {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const theme = useUiStore((s) => s.theme)
  const toggleTheme = useUiStore((s) => s.toggleTheme)

  return (
    <div className={`shell${bare ? ' shell--bare' : ''}`}>
      {!bare && <Sidebar current={current} />}
      <div className="shell-main">
        <header className="shell-topbar">
          {bare ? (
            <a className="topbar-brand" href={routeToPath({ screen: 'home' })} aria-label="Mango Studio">
              <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" width={26} height={26} />
              <span className="brand">
                Mango <span>Studio</span>
              </span>
            </a>
          ) : (
            <button type="button" className="icon-button" onClick={toggleSidebar} aria-label={t('nav.toggleSidebar')} title={t('nav.toggleSidebar')}>
              <PanelLeft size={16} strokeWidth={1.75} />
            </button>
          )}
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
            <button type="button" className="shell-theme" onClick={toggleTheme} aria-label={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')} title={t(theme === 'dark' ? 'theme.toLight' : 'theme.toDark')}>
              {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
            </button>
            <AccountButton />
          </div>
        </header>
        <main className="shell-content">{children}</main>
        <footer className="shell-foot">
          <span>© {new Date().getFullYear()} Mango Studio</span>
          <a href={routeToPath({ screen: 'privacy' })}>{t('legal.footer.privacy')}</a>
          <a href={routeToPath({ screen: 'terms' })}>{t('legal.footer.terms')}</a>
          <a href={routeToPath({ screen: 'credits' })}>{t('nav.credits')}</a>
        </footer>
      </div>
    </div>
  )
}
