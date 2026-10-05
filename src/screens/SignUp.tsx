import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AuthForm } from '../components/AuthForm'
import { useAutoplay } from '../components/useAutoplay'
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
  oauth: 'signup.titleConnect',
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
  const templateId = route.screen === 'template' ? route.templateId : undefined
  // Claude bağlantısı onayında istek kimliği adresin sorgu kısmında: girişten sonra onunla dönülmeli.
  const target = routeToPath(route) + (route.screen === 'oauth' ? window.location.search : '')

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

          <AuthForm intent="signup" />
          {route.screen !== 'signup' && <p className="signup-note">{templateId ? t('signup.note') : t('signup.noteBack')}</p>}
          <a className="signup-back" href={routeToPath({ screen: 'templates' })}>
            {t('signup.back')}
          </a>
        </section>
      </div>
    </AppShell>
  )
}
