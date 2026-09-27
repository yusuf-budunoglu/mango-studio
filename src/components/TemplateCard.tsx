import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createFromTemplate } from '../project/actions'
import { templateName, type Template } from '../project/templates'
import { useUiStore } from '../store/uiStore'

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Şablon kartı: önizleme şablonun kendi oranında (`public/templates/posters/<id>.jpg`); üstüne gelince
 * döngü videosu (`public/templates/loops/<id>.mp4`) oynar. Altında ad, "Ücretsiz · oran · süre" ve favori kalbi.
 */
export function TemplateCard({ template }: { template: Template }) {
  const { t, i18n } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [posterFailed, setPosterFailed] = useState(false)
  const [playing, setPlaying] = useState(false)
  const favorite = useUiStore((s) => s.favorites.includes(template.id))
  const toggleFavorite = useUiStore((s) => s.toggleFavorite)
  const base = import.meta.env.BASE_URL
  const name = templateName(template.id)
  const [w, h] = template.format.split(':').map(Number)
  const seconds = template.seconds.toLocaleString(i18n.language, { maximumFractionDigits: 1 })

  const play = () => {
    const v = video.current
    if (!v || reducedMotion()) return
    v.currentTime = 0
    void v.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }
  const stop = () => {
    video.current?.pause()
    setPlaying(false)
  }

  return (
    <article className="tcard">
      <button
        type="button"
        className={`tcard-media${playing ? ' is-playing' : ''}`}
        style={{ aspectRatio: `${w} / ${h}` }}
        onClick={() => void createFromTemplate(template.id)}
        onMouseEnter={play}
        onMouseLeave={stop}
        onFocus={play}
        onBlur={stop}
        aria-label={t('templatesPage.use', { name })}
      >
        {posterFailed ? (
          <span className="tcard-fallback" style={{ background: `radial-gradient(circle at 30% 30%, ${template.accent}, #0a0a0b 75%)` }} />
        ) : (
          <img src={`${base}templates/posters/${template.id}.jpg`} alt="" loading="lazy" onError={() => setPosterFailed(true)} />
        )}
        <video ref={video} src={`${base}templates/loops/${template.id}.mp4`} muted loop playsInline preload="none" aria-hidden="true" />
      </button>
      <div className="tcard-info">
        <div className="tcard-text">
          <span className="tcard-title">{name}</span>
          <span className="tcard-meta">
            {t('templatesPage.free')} · {template.format} · {t('templatesPage.seconds', { value: seconds })}
          </span>
        </div>
        <button
          type="button"
          className={`tcard-fav${favorite ? ' is-on' : ''}`}
          aria-pressed={favorite}
          aria-label={t(favorite ? 'templatesPage.unfavorite' : 'templatesPage.favorite', { name })}
          onClick={() => toggleFavorite(template.id)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.9 4.5 7.4 4.5c2 0 3.4 1.1 4.6 2.7 1.2-1.6 2.6-2.7 4.6-2.7 3.5 0 5.7 3.5 4.6 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
          </svg>
        </button>
      </div>
    </article>
  )
}
