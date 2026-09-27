import {
  AudioLines,
  Clapperboard,
  Crown,
  FolderOpen,
  Hash,
  House,
  LayoutTemplate,
  Layers,
  Mic,
  Music,
  PlugZap,
  Rocket,
  Sparkles,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { createFromTemplate } from '../project/actions'
import { routeToHash, type Route } from '../router'
import { useUiStore } from '../store/uiStore'

interface NavItem {
  labelKey: string
  icon: LucideIcon
  route?: Route
  onClick?: () => void
  soon?: boolean
}

const MAIN: NavItem[] = [
  { labelKey: 'nav.home', icon: House, route: { screen: 'home' } },
  { labelKey: 'nav.videos', icon: Clapperboard, route: { screen: 'videos' } },
  { labelKey: 'nav.templates', icon: LayoutTemplate, route: { screen: 'templates' } },
  { labelKey: 'nav.assets', icon: FolderOpen, route: { screen: 'assets' } },
]

const PINNED: NavItem[] = [
  { labelKey: 'nav.textToVideo', icon: Type, route: { screen: 'home' } },
  { labelKey: 'nav.launch', icon: Rocket, onClick: () => void createFromTemplate('app-launch') },
  { labelKey: 'nav.featureTour', icon: Layers, onClick: () => void createFromTemplate('feature-tour') },
  { labelKey: 'nav.stats', icon: Hash, onClick: () => void createFromTemplate('stats') },
  { labelKey: 'nav.logoReveal', icon: Sparkles, onClick: () => void createFromTemplate('logo-reveal') },
  { labelKey: 'nav.music', icon: Music, route: { screen: 'soon', feature: 'music' }, soon: true },
  { labelKey: 'nav.voiceover', icon: Mic, route: { screen: 'soon', feature: 'voiceover' }, soon: true },
  { labelKey: 'nav.soundEffects', icon: AudioLines, route: { screen: 'soon', feature: 'sound-effects' }, soon: true },
]

function isActive(item: NavItem, current: Route) {
  if (!item.route || item.labelKey === 'nav.textToVideo') return false
  if (item.route.screen === 'soon' && current.screen === 'soon') return item.route.feature === current.feature
  return item.route.screen === current.screen
}

function NavLink({ item, current }: { item: NavItem; current: Route }) {
  const { t } = useTranslation()
  const Icon = item.icon
  const content = (
    <>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="nav-label">{t(item.labelKey)}</span>
      {item.soon && <span className="nav-badge">{t('nav.soon')}</span>}
    </>
  )
  const className = `nav-item ${isActive(item, current) ? 'is-active' : ''}`
  if (item.route) {
    return (
      <a className={className} href={routeToHash(item.route)} aria-current={isActive(item, current) ? 'page' : undefined} title={t(item.labelKey)}>
        {content}
      </a>
    )
  }
  return (
    <button type="button" className={className} onClick={item.onClick} title={t(item.labelKey)}>
      {content}
    </button>
  )
}

export function Sidebar({ current }: { current: Route }) {
  const { t } = useTranslation()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="sidebar-brand" href="#/">
        <span className="brand-mark" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
        </span>
        <span className="nav-label brand">
          Mango <span>Studio</span>
        </span>
      </a>

      <nav className="nav-group" aria-label={t('nav.home')}>
        {MAIN.map((item) => (
          <NavLink key={item.labelKey} item={item} current={current} />
        ))}
      </nav>

      <div className="nav-group">
        <div className="nav-heading nav-label">{t('nav.pinned')}</div>
        {PINNED.map((item) => (
          <NavLink key={item.labelKey} item={item} current={current} />
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="sidebar-card nav-label">
          <PlugZap size={16} strokeWidth={1.75} aria-hidden="true" />
          <strong>{t('nav.cardTitle')}</strong>
          <span>{t('nav.cardBody')}</span>
        </div>
        <button type="button" className="upgrade" title={t('nav.upgrade')}>
          <Crown size={15} strokeWidth={1.75} aria-hidden="true" />
          <span className="nav-label">{t('nav.upgrade')}</span>
        </button>
        <a className="sidebar-credits nav-label" href={routeToHash({ screen: 'credits' })}>
          {t('nav.credits')}
        </a>
      </div>
    </aside>
  )
}
