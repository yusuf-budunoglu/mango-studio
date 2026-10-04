import { Box, Camera, Clapperboard, Download, LayoutTemplate, Sparkles, Zap } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { startCheckout } from '../billing/checkout'
import { LAUNCH_DISCOUNT, PLANS, type Plan } from '../billing/plans'
import { AccountButton } from '../components/AccountButton'
import { PlanCard } from '../components/PlanCard'
import { TemplateCard } from '../components/TemplateCard'
import { TEMPLATES, templateName } from '../project/templates'
import { navigate, routeToPath } from '../router'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Girişteki üç örnek: dikey, yatay, dikey. Döngü videosu sessiz oynar; hareketi azaltan kullanıcıda yalnızca kapak görseli. */
const HERO_TEMPLATES = ['meadow-phone', 'mango-ai-ad', 'wallet-promo']

const FEATURES: { id: string; icon: ReactNode; soon?: boolean }[] = [
  { id: 'templates', icon: <LayoutTemplate size={20} strokeWidth={1.75} /> },
  { id: 'devices', icon: <Box size={20} strokeWidth={1.75} /> },
  { id: 'camera', icon: <Camera size={20} strokeWidth={1.75} /> },
  { id: 'edit', icon: <Zap size={20} strokeWidth={1.75} /> },
  { id: 'export', icon: <Download size={20} strokeWidth={1.75} /> },
  { id: 'claude', icon: <Clapperboard size={20} strokeWidth={1.75} />, soon: true },
]
const STEPS = ['pick', 'edit', 'export'] as const
const FAQ = ['account', 'free', 'browser', 'upload', 'own', 'claude'] as const

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
}

function HeroShot({ id }: { id: string }) {
  const template = TEMPLATES.find((tpl) => tpl.id === id)
  const base = import.meta.env.BASE_URL
  if (!template) return null
  const [w, h] = template.format.split(':').map(Number)
  return (
    <figure className="landing-shot" style={{ aspectRatio: `${w} / ${h}` }}>
      <img src={`${base}templates/posters/${id}.jpg`} alt={templateName(id)} width={w * 40} height={h * 40} />
      {!reducedMotion() && <video src={`${base}templates/loops/${id}.mp4`} autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />}
    </figure>
  )
}

/** Hesabı olmayan ziyaretçi için tanıtım sayfası: ne olduğu, özellikler, şablonlar, fiyatlar, sık sorulanlar. */
export function Landing() {
  const { t } = useTranslation()
  const [notice, setNotice] = useState(false)

  const choose = async (plan: Plan) => {
    if (plan.price === 0) {
      navigate({ screen: 'templates' })
      return
    }
    await startCheckout(plan.id)
    setNotice(true)
  }

  const nav = [
    { id: 'features', label: t('landing.nav.features') },
    { id: 'templates', label: t('landing.nav.templates') },
    { id: 'pricing', label: t('landing.nav.pricing') },
    { id: 'faq', label: t('landing.nav.faq') },
  ]

  return (
    <div className="landing">
      <header className="landing-bar">
        <a className="landing-brand" href={routeToPath({ screen: 'welcome' })} aria-label="Mango Studio">
          <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" width={26} height={26} />
          <span>
            MANGO <em>STUDIO</em>
          </span>
        </a>
        <nav className="landing-links" aria-label={t('landing.nav.label')}>
          {nav.map((item) => (
            <button key={item.id} type="button" onClick={() => scrollTo(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="landing-bar-actions">
          <AccountButton />
          <a className="landing-btn landing-btn--small landing-btn--primary" href={routeToPath({ screen: 'templates' })}>
            {t('landing.startFree')}
          </a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <span className="landing-eyebrow">{t('landing.hero.eyebrow')}</span>
          <h1>{t('landing.hero.title')}</h1>
          <p className="landing-lead">{t('landing.hero.lead')}</p>
          <div className="landing-cta">
            <a className="landing-btn landing-btn--primary" href={routeToPath({ screen: 'templates' })}>
              {t('landing.startFree')}
            </a>
            <button type="button" className="landing-btn" onClick={() => scrollTo('templates')}>
              {t('landing.hero.browse')}
            </button>
          </div>
          <p className="landing-note">{t('landing.hero.note')}</p>
          <div className="landing-shots" aria-label={t('landing.hero.examples')}>
            {HERO_TEMPLATES.map((id) => (
              <HeroShot key={id} id={id} />
            ))}
          </div>
        </section>

        <section className="landing-section" id="features">
          <h2>{t('landing.features.title')}</h2>
          <div className="landing-features">
            {FEATURES.map((f) => (
              <article key={f.id} className="landing-feature">
                <span className="landing-feature-icon" aria-hidden="true">
                  {f.icon}
                </span>
                <h3>
                  {t(`landing.features.${f.id}.title`)}
                  {f.soon && <em className="landing-soon">{t('landing.soon')}</em>}
                </h3>
                <p>{t(`landing.features.${f.id}.body`, { count: TEMPLATES.length })}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section" id="how">
          <h2>{t('landing.how.title')}</h2>
          <ol className="landing-steps">
            {STEPS.map((step) => (
              <li key={step}>
                <h3>{t(`landing.how.${step}.title`)}</h3>
                <p>{t(`landing.how.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-section" id="templates">
          <div className="landing-section-head">
            <h2>{t('landing.templates.title')}</h2>
            <a href={routeToPath({ screen: 'templates' })}>
              {t('landing.templates.viewAll')}
            </a>
          </div>
          <div className="tcard-grid">
            {TEMPLATES.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        </section>

        <section className="landing-section" id="pricing">
          <div className="landing-section-head landing-section-head--center">
            <span className="pricing-launch">
              <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
              {t('pricing.launchBadge', { percent: LAUNCH_DISCOUNT * 100 })}
            </span>
            <h2>{t('pricing.title')}</h2>
            <p>{t('landing.pricing.lead')}</p>
          </div>
          <div className="plan-grid">
            {PLANS.map((plan) => (
              <PlanCard key={plan.id} plan={plan} current={false} onChoose={() => void choose(plan)} />
            ))}
          </div>
          {notice && (
            <p className="pricing-notice landing-notice" role="status">
              {t('pricing.checkoutSoon')}
            </p>
          )}
          <p className="hint pricing-foot">{t('landing.pricing.footnote')}</p>
        </section>

        <section className="landing-section landing-section--narrow" id="faq">
          <h2>{t('landing.faq.title')}</h2>
          <div className="landing-faq">
            {FAQ.map((id) => (
              <details key={id}>
                <summary>{t(`landing.faq.${id}.q`)}</summary>
                <p>{t(`landing.faq.${id}.a`)}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="landing-final">
          <h2>{t('landing.final.title')}</h2>
          <a className="landing-btn landing-btn--primary" href={routeToPath({ screen: 'templates' })}>
            {t('landing.startFree')}
          </a>
        </section>
      </main>

      <footer className="landing-foot">
        <span>{t('landing.footer.copyright', { year: new Date().getFullYear() })}</span>
        <a href={routeToPath({ screen: 'credits' })}>
          {t('nav.credits')}
        </a>
      </footer>
    </div>
  )
}
