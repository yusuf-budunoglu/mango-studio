import {
  AudioLines,
  Clapperboard,
  Crown,
  FolderOpen,
  House,
  LayoutTemplate,
  Mic,
  Music,
  PlugZap,
  Type,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { routeToPath, type Route } from '../router'
import { supabase } from '../cloud/client'
import { useAuthStore } from '../store/authStore'
import { useMembersStore } from '../store/membersStore'
import { usePlan } from '../store/planStore'
import { useProfileStore } from '../store/profileStore'
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
  { labelKey: 'nav.studio', icon: Clapperboard, route: { screen: 'studio' } },
  { labelKey: 'nav.templates', icon: LayoutTemplate, route: { screen: 'templates' } },
  { labelKey: 'nav.assets', icon: FolderOpen, route: { screen: 'assets' } },
  { labelKey: 'nav.profile', icon: UserRound, route: { screen: 'profile' } },
]

const PINNED: NavItem[] = [
  { labelKey: 'nav.textToVideo', icon: Type, route: { screen: 'soon', feature: 'text-to-video' }, soon: true },
  { labelKey: 'nav.music', icon: Music, route: { screen: 'soon', feature: 'music' }, soon: true },
  { labelKey: 'nav.voiceover', icon: Mic, route: { screen: 'soon', feature: 'voiceover' }, soon: true },
  { labelKey: 'nav.soundEffects', icon: AudioLines, route: { screen: 'soon', feature: 'sound-effects' }, soon: true },
]

function isActive(item: NavItem, current: Route) {
  if (!item.route) return false
  if (item.route.screen === 'soon' && current.screen === 'soon') return item.route.feature === current.feature
  // şablon önizlemesi Şablonlar'ın, yeni proje Studio'nun altında sayılır
  const screen = current.screen === 'template' ? 'templates' : current.screen === 'new' ? 'studio' : current.screen
  return item.route.screen === screen
}

const MEMBERS: NavItem = { labelKey: 'nav.members', icon: Users, route: { screen: 'members' } }
/** Yeni üye sayacının sunucudan yenilenme aralığı (sekme görünürken) */
const MEMBERS_POLL_MS = 60_000

/** Yalnızca yöneticide: Üyeler bağlantısı ve henüz görülmemiş yeni üye sayısı. */
function MembersLink({ current }: { current: Route }) {
  const unseen = useMembersStore((s) => s.unseen)
  const refreshCounts = useMembersStore((s) => s.refreshCounts)

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void refreshCounts()
    }
    refresh()
    const timer = window.setInterval(refresh, MEMBERS_POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [refreshCounts])

  return <NavLink item={MEMBERS} current={current} count={unseen} />
}

function NavLink({ item, current, count = 0 }: { item: NavItem; current: Route; count?: number }) {
  const { t } = useTranslation()
  const Icon = item.icon
  const content = (
    <>
      <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="nav-label">{t(item.labelKey)}</span>
      {item.soon && <span className="nav-badge">{t('nav.soon')}</span>}
      {count > 0 && (
        <span className="nav-count" aria-label={t('nav.newMembers', { count })}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </>
  )
  const className = `nav-item ${isActive(item, current) ? 'is-active' : ''}`
  if (item.route) {
    return (
      <a className={className} href={routeToPath(item.route)} aria-current={isActive(item, current) ? 'page' : undefined} title={t(item.labelKey)}>
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
  const { plan, left } = usePlan()
  const planName = t(`pricing.plans.${plan.id}`)
  const guest = useAuthStore((s) => !!supabase && s.status === 'out')
  const openSignIn = useAuthStore((s) => s.openSignIn)
  const isAdmin = useProfileStore((s) => s.isAdmin)

  return (
    <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''}`}>
      <a className="sidebar-brand" href="/">
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
        {isAdmin && <MembersLink current={current} />}
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
        {guest ? (
          <div className="sidebar-join nav-label">
            <strong>{t('nav.joinTitle')}</strong>
            <span>{t('nav.joinBody')}</span>
            <a className="sidebar-join-primary" href={routeToPath({ screen: 'signup' })}>
              {t('account.signUp')}
            </a>
            <button type="button" className="sidebar-join-secondary" onClick={openSignIn}>
              {t('account.signIn')}
            </button>
          </div>
        ) : (
          <a className={`upgrade ${current.screen === 'pricing' ? 'is-active' : ''}`} href={routeToPath({ screen: 'pricing' })} title={t('nav.upgrade')}>
            <Crown size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="nav-label upgrade-text">
              <strong>
                {t('plan.label', { plan: planName })}
                {plan.id !== 'unlimited' && <em>{t('nav.upgrade')}</em>}
              </strong>
              {plan.aiCredits !== 0 && (
                <span>
                  {plan.aiCredits === null
                    ? t('plan.creditsUnlimited')
                    : t('plan.credits', { left, total: plan.aiCredits })}
                </span>
              )}
            </span>
            {plan.aiCredits !== null && plan.aiCredits > 0 && (
              <span className="upgrade-meter nav-label" aria-hidden="true">
                <span style={{ width: `${(left / plan.aiCredits) * 100}%` }} />
              </span>
            )}
          </a>
        )}
        <a className="sidebar-credits nav-label" href={routeToPath({ screen: 'credits' })}>
          {t('nav.credits')}
        </a>
      </div>
    </aside>
  )
}
