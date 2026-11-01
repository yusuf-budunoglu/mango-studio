import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmCheckout, startCheckout, type CheckoutResult } from '../billing/checkout'
import { LAUNCH_DISCOUNT, PLANS, type Plan } from '../billing/plans'
import { PlanCard } from '../components/PlanCard'
import { AppShell } from '../layout/AppShell'
import { routeToPath } from '../router'
import { usePlan } from '../store/planStore'

type Notice = { kind: CheckoutResult | 'subscribed' | 'pending'; plan?: string } | null

const NOTICE_TEXT: Record<Exclude<NonNullable<Notice>['kind'], 'signin'>, string> = {
  activated: 'pricing.activated',
  subscribed: 'pricing.subscribed',
  pending: 'pricing.pending',
  redirecting: 'pricing.redirecting',
  unavailable: 'pricing.checkoutSoon',
  none: 'pricing.noSubscription',
  failed: 'pricing.checkoutFailed',
}

/** Planlar ve fiyatlar: ücretsiz + üç ücretli plan, çıkışa özel yarı fiyat. Ödeme Stripe'ın sayfasında alınır. */
export function Pricing() {
  const { t } = useTranslation()
  const { plan: currentPlan } = usePlan()
  const [notice, setNotice] = useState<Notice>(null)
  const [busy, setBusy] = useState(false)

  // Stripe'tan dönüş (`/pricing?checkout=success`): plan sunucudan okunur, adres temizlenir. Dönüş bir kez okunur:
  // geliştirmede etki iki kez çalışır ve ilki adresi temizlemiş olur.
  const [returned] = useState(() => new URLSearchParams(window.location.search).get('checkout') === 'success')
  useEffect(() => {
    if (!returned) return
    window.history.replaceState(null, '', routeToPath({ screen: 'pricing' }))
    let cancelled = false
    void confirmCheckout().then((active) => {
      if (!cancelled) setNotice({ kind: active ? 'subscribed' : 'pending' })
    })
    return () => {
      cancelled = true
    }
  }, [returned])

  const choose = async (plan: Plan) => {
    if (busy) return
    setBusy(true)
    setNotice({ kind: 'redirecting' })
    const result = await startCheckout(plan.id)
    // Stripe'a gidilirken düğmeler kilitli kalır; sayfa zaten değişiyor.
    if (result !== 'redirecting') setBusy(false)
    setNotice(result === 'signin' ? null : { kind: result, plan: t(`pricing.plans.${plan.id}`) })
  }

  return (
    <AppShell current={{ screen: 'pricing' }} title={t('pricing.title')}>
      <div className="pricing">
        <div className="pricing-head">
          <span className="pricing-launch">{t('pricing.launchBadge', { percent: LAUNCH_DISCOUNT * 100 })}</span>
          <h2>{t('pricing.title')}</h2>
          <p className="hint">{t('pricing.lead')}</p>
        </div>

        <div className="plan-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={plan.id === currentPlan.id} onChoose={() => void choose(plan)} />
          ))}
        </div>

        {notice && notice.kind !== 'signin' && (
          <p className={`pricing-notice ${notice.kind === 'activated' || notice.kind === 'subscribed' ? 'is-ok' : ''}`} role="status">
            {t(NOTICE_TEXT[notice.kind], { plan: notice.plan ?? t(`pricing.plans.${currentPlan.id}`) })}
          </p>
        )}
        <p className="hint pricing-foot">{t('pricing.footnote')}</p>
      </div>
    </AppShell>
  )
}
