import { Crown, FolderOpen, LogOut, Sparkles, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { creditPeriod, RESOLUTION_LABEL } from '../billing/plans'
import { supabase } from '../cloud/client'
import { AppShell } from '../layout/AppShell'
import { repository } from '../persistence/repository'
import { routeToPath } from '../router'
import { useAuthStore } from '../store/authStore'
import { usePlan, usePlanStore } from '../store/planStore'

/** Profil: hesap (e-posta, üyelik tarihi), plan ve yapay zekâ kredisi, projeler, çıkış. Girişsizken giriş daveti. */
export function Profile() {
  const { t, i18n } = useTranslation()
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const openSignIn = useAuthStore((s) => s.openSignIn)
  const signOut = useAuthStore((s) => s.signOut)
  const { plan, used, left } = usePlan()
  const anchor = usePlanStore((s) => s.anchor)
  const [projects, setProjects] = useState<number>()
  // Yenileme tarihi için sayfanın açıldığı an yeterli.
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false
    void repository.list().then((list) => {
      if (!cancelled) setProjects(list.length)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const signedIn = status === 'in' && !!user
  const email = user?.email ?? ''
  const date = (ms: number) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(ms)
  const planName = t(`pricing.plans.${plan.id}`)
  const maxRes = Math.max(...plan.resolutions) as keyof typeof RESOLUTION_LABEL
  const maxFps = Math.max(...plan.fps)

  return (
    <AppShell current={{ screen: 'profile' }} title={t('profile.title')}>
      <div className="profile">
        <section className="profile-card profile-id">
          <span className={`profile-avatar ${signedIn ? '' : 'is-guest'}`} aria-hidden="true">
            {signedIn ? (email[0] ?? '?').toUpperCase() : <UserRound size={26} strokeWidth={1.75} />}
          </span>
          <div className="profile-id-text">
            <h2>{signedIn ? email : t('profile.guest')}</h2>
            <p className="hint">
              {signedIn
                ? user.created_at
                  ? t('profile.memberSince', { date: date(Date.parse(user.created_at)) })
                  : t('profile.member')
                : supabase
                  ? t('profile.guestBody')
                  : t('profile.localOnly')}
            </p>
          </div>
          {!signedIn && supabase && (
            <button type="button" className="button-primary profile-id-action" onClick={openSignIn}>
              {t('profile.signUp')}
            </button>
          )}
        </section>

        <section className="profile-card">
          <div className="profile-card-head">
            <h3>
              <Crown size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('profile.planTitle')}
            </h3>
            {plan.id !== 'unlimited' && (
              <a className="button-primary" href={routeToPath({ screen: 'pricing' })}>
                {t('profile.upgrade')}
              </a>
            )}
          </div>
          <dl className="profile-facts">
            <div>
              <dt>{t('profile.plan')}</dt>
              <dd>{t('plan.label', { plan: planName })}</dd>
            </div>
            <div>
              <dt>{t('profile.export')}</dt>
              <dd>{t('profile.exportValue', { resolution: RESOLUTION_LABEL[maxRes], fps: maxFps })}</dd>
            </div>
            <div>
              <dt>{t('profile.aiCredits')}</dt>
              <dd>
                {plan.aiCredits === null
                  ? t('plan.creditsUnlimited')
                  : plan.aiCredits === 0
                    ? t('profile.noCredits')
                    : t('plan.credits', { left, total: plan.aiCredits })}
              </dd>
            </div>
          </dl>
          {plan.aiCredits !== null && plan.aiCredits > 0 && (
            <>
              <div className="profile-meter" role="meter" aria-valuemin={0} aria-valuemax={plan.aiCredits} aria-valuenow={left} aria-label={t('profile.aiCredits')}>
                <span style={{ width: `${(left / plan.aiCredits) * 100}%` }} />
              </div>
              <p className="hint">{t('profile.renews', { used, date: date(creditPeriod(anchor, now).end) })}</p>
            </>
          )}
          {plan.aiCredits === 0 && (
            <p className="hint profile-note">
              <Sparkles size={13} strokeWidth={1.75} aria-hidden="true" />
              {t('profile.noCreditsBody')}
            </p>
          )}
        </section>

        <section className="profile-card">
          <div className="profile-card-head">
            <h3>
              <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" />
              {t('profile.projectsTitle')}
            </h3>
            <a className="profile-link" href={routeToPath({ screen: 'studio' })}>
              {t('profile.openStudio')}
            </a>
          </div>
          <p className="hint">
            {projects === undefined ? '…' : t('profile.projects', { count: projects })} · {signedIn ? t('profile.storageCloud') : t('profile.storageLocal')}
          </p>
        </section>

        {signedIn && (
          <section className="profile-card">
            <h3>{t('profile.settings')}</h3>
            <div className="profile-row">
              <span>{t('account.signedInAs', { email })}</span>
              <button type="button" className="profile-signout" onClick={() => void signOut()}>
                <LogOut size={14} strokeWidth={1.75} aria-hidden="true" />
                {t('account.signOut')}
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  )
}
