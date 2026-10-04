import { Check, Mail } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAutoplay } from '../components/useAutoplay'
import { useMagicLink } from '../components/useMagicLink'
import { AppShell } from '../layout/AppShell'
import { TEMPLATES, templateName } from '../project/templates'
import { routeToPath, type Route } from '../router'
import { rememberNext } from '../store/afterSignIn'

const PERKS = ['templates', 'editor', 'cloud', 'free'] as const

/** Ziyaretçinin girmek istediği sayfaya göre başlık. */
const TITLES: Partial<Record<Route['screen'], string>> = {
  studio: 'signup.titleStudio',
  assets: 'signup.titleAssets',
  signup: 'signup.titleJoin',
}

/** Seçilen şablonun döngü videosu, kendi oranında. */
function TemplateLoop({ id }: { id: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const playing = useAutoplay(video)
  const template = TEMPLATES.find((tpl) => tpl.id === id)
  if (!template) return null
  const [w, h] = template.format.split(':').map(Number)
  const base = import.meta.env.BASE_URL
  return (
    <figure className={`signup-shot${w < h ? ' is-vertical' : ''}`}>
      <span className={`x-loop${playing ? ' is-playing' : ''}`} style={{ aspectRatio: `${w} / ${h}` }}>
        <img src={`${base}templates/posters/${id}.jpg`} alt="" />
        <video ref={video} src={`${base}templates/loops/${id}.mp4`} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />
      </span>
      <figcaption>{templateName(id)}</figcaption>
    </figure>
  )
}

/**
 * Üyelik kapısı: üye olmayan ziyaretçi şablon açmaya, proje başlatmaya, editöre, Studio'ya ya da Dosyalar'a girmeye
 * çalışınca bu sayfa açılır; sağ üstteki "Üye ol" da buraya (/signup) getirir.
 * Giriş bağlantısıyla dönünce istediği sayfaya geri götürülür (`afterSignIn`).
 */
export function SignUp({ route }: { route: Route }) {
  const { t } = useTranslation()
  const { email, setEmail, trimmed, state, error, wait, submit, changeEmail } = useMagicLink()
  const templateId = route.screen === 'template' ? route.templateId : undefined
  const target = routeToPath(route)

  // Kendi adresi (#/signup) dışında: girişten sonra ziyaretçinin açmak istediği sayfaya dön.
  useEffect(() => {
    if (route.screen !== 'signup') rememberNext(target)
  }, [route.screen, target])

  return (
    <AppShell current={route.screen === 'template' || route.screen === 'new' || route.screen === 'editor' ? { screen: 'templates' } : route} title={t('signup.title')} bare>
      <div className="signup">
        <div className="signup-media">
          {templateId ? (
            <TemplateLoop id={templateId} />
          ) : (
            <img className="signup-mark" src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          )}
        </div>

        <section className="signup-card" aria-labelledby="signup-title">
          <span className="x-pill-new">{t('signup.eyebrow')}</span>
          <h1 id="signup-title">{templateId ? t('signup.titleTemplate', { name: templateName(templateId) }) : t(TITLES[route.screen] ?? 'signup.title')}</h1>
          <p className="signup-lead">{t('signup.lead')}</p>
          <ul className="signup-perks">
            {PERKS.map((id) => (
              <li key={id}>
                <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                {t(`signup.perks.${id}`)}
              </li>
            ))}
          </ul>

          {state === 'sent' ? (
            <div className="signup-sent" role="status">
              <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
              <div>
                <strong>{t('account.linkSentTitle')}</strong>
                <p>{t('account.linkSentBody', { email: trimmed })}</p>
                <div className="signup-sent-actions">
                  <button type="button" onClick={changeEmail}>
                    {t('account.useOtherEmail')}
                  </button>
                  <button type="button" disabled={wait > 0} onClick={() => void submit()}>
                    {wait > 0 ? t('account.resendIn', { seconds: wait }) : t('account.sendLink')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form
              className="signup-form"
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <input
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                placeholder={t('account.emailPlaceholder')}
                aria-label={t('account.emailLabel')}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button type="submit" className="x-btn x-btn--accent" disabled={!trimmed || state === 'sending' || wait > 0}>
                {state === 'sending' ? t('account.sending') : t('signup.submit')}
              </button>
            </form>
          )}
          {error && (
            <p className="modal-error signup-error" role="alert">
              {error}
            </p>
          )}
          {route.screen !== 'signup' && <p className="signup-note">{templateId ? t('signup.note') : t('signup.noteBack')}</p>}
          <a className="signup-back" href={routeToPath({ screen: 'templates' })}>
            {t('signup.back')}
          </a>
        </section>
      </div>
    </AppShell>
  )
}
