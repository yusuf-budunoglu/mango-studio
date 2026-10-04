import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LAUNCH_DISCOUNT, RESOLUTION_LABEL, type Plan } from '../billing/plans'

/** Öne çıkan plan: sayfadaki tek turuncu (birincil) düğme onda. */
export const FEATURED_PLAN = 'pro'

/** Plan kartı: fiyat, çıkışa özel indirim, özellikler ve seçme düğmesi. Fiyat sayfası ve karşılama sayfası kullanır. */
export function PlanCard({ plan, current, onChoose }: { plan: Plan; current: boolean; onChoose: () => void }) {
  const { t, i18n } = useTranslation()
  const money = (v: number) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'USD', minimumFractionDigits: v % 1 ? 2 : 0 }).format(v)
  const name = t(`pricing.plans.${plan.id}`)
  const maxRes = Math.max(...plan.resolutions) as keyof typeof RESOLUTION_LABEL
  const maxFps = Math.max(...plan.fps)
  const featured = plan.id === FEATURED_PLAN
  const paid = plan.price > 0

  const features = [
    t(plan.resolutions.length === 1 ? 'pricing.features.exportOnly' : 'pricing.features.export', { resolution: RESOLUTION_LABEL[maxRes], fps: maxFps }),
    ...(plan.aiCredits === 0 ? [] : [plan.aiCredits === null ? t('pricing.features.aiUnlimited') : t('pricing.features.aiCredits', { credits: plan.aiCredits.toLocaleString(i18n.language) })]),
    t('pricing.features.templates'),
    ...(plan.aiCredits === null ? [t('pricing.features.everything')] : []),
  ]

  return (
    <article className={`plan ${featured ? 'plan--featured' : ''} ${current ? 'is-current' : ''}`} aria-label={name}>
      {featured && <span className="plan-flag">{t('pricing.popular')}</span>}
      <header>
        <h3>{name}</h3>
        <p className="hint">{t(`pricing.taglines.${plan.id}`)}</p>
      </header>
      <div className="plan-price">
        {paid ? (
          <>
            <s aria-label={t('pricing.regular', { price: money(plan.price) })}>{money(plan.price)}</s>
            <strong>{money(plan.launchPrice)}</strong>
            <span>{t('pricing.perMonth')}</span>
          </>
        ) : (
          <>
            <strong>{money(0)}</strong>
            <span>{t('pricing.perMonth')}</span>
          </>
        )}
      </div>
      <p className="plan-save">{paid ? t('pricing.launchSave', { percent: LAUNCH_DISCOUNT * 100 }) : t('pricing.freeForever')}</p>
      <ul>
        {features.map((f) => (
          <li key={f}>
            <Check size={15} strokeWidth={2.25} aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <button type="button" className={featured && !current ? 'primary' : ''} disabled={current} onClick={onChoose}>
        {current ? t('pricing.current') : t('pricing.choose', { plan: name })}
      </button>
    </article>
  )
}
