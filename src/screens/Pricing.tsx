import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { startCheckout } from '../billing/checkout'
import { LAUNCH_DISCOUNT, PLANS, type Plan } from '../billing/plans'
import { PlanCard } from '../components/PlanCard'
import { AppShell } from '../layout/AppShell'
import { usePlan } from '../store/planStore'

type Notice = { kind: 'activated' | 'unavailable'; plan: string } | null

/** Planlar ve fiyatlar: ücretsiz + üç ücretli plan, çıkışa özel yarı fiyat. */
export function Pricing() {
  const { t } = useTranslation()
  const { plan: currentPlan } = usePlan()
  const [notice, setNotice] = useState<Notice>(null)

  const choose = async (plan: Plan) => {
    const result = await startCheckout(plan.id)
    setNotice({ kind: result, plan: t(`pricing.plans.${plan.id}`) })
  }

  return (
    <AppShell current={{ screen: 'pricing' }} title={t('pricing.title')}>
      <div className="pricing">
        <div className="pricing-head">
          <span className="pricing-launch">
            <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
            {t('pricing.launchBadge', { percent: LAUNCH_DISCOUNT * 100 })}
          </span>
          <h2>{t('pricing.title')}</h2>
          <p className="hint">{t('pricing.lead')}</p>
        </div>

        <div className="plan-grid">
          {PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} current={plan.id === currentPlan.id} onChoose={() => void choose(plan)} />
          ))}
        </div>

        {notice && (
          <p className={`pricing-notice ${notice.kind === 'activated' ? 'is-ok' : ''}`} role="status">
            {notice.kind === 'activated' ? t('pricing.activated', { plan: notice.plan }) : t('pricing.checkoutSoon')}
          </p>
        )}
        <p className="hint pricing-foot">{t('pricing.footnote')}</p>
      </div>
    </AppShell>
  )
}
