import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PublishedTemplate } from '../project/publishedTemplates'
import type { Template } from '../project/templates'
import { routeToPath } from '../router'
import { useUiStore } from '../store/uiStore'
import { cardInfo } from './cardInfo'
import { useAutoplay } from './useAutoplay'

/**
 * Şablon kartı: önizleme şablonun kendi oranında (kapak görseli); ekranda görünürken döngü videosu (varsa)
 * kendiliğinden oynar; tıklayınca şablonun önizleme sayfası açılır. Altında ad, "Ücretsiz · oran · süre" ve favori kalbi.
 */
export function TemplateCard({ template }: { template: Template | PublishedTemplate }) {
  const { t, i18n } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const card = cardInfo(template)
  const [posterFailed, setPosterFailed] = useState(!card.posterUrl)
  const favorite = useUiStore((s) => s.favorites.includes(card.id))
  const toggleFavorite = useUiStore((s) => s.toggleFavorite)
  const seconds = card.seconds.toLocaleString(i18n.language, { maximumFractionDigits: 1 })

  const playing = useAutoplay(video)

  return (
    <article className="tcard">
      <a
        className={`tcard-media${playing ? ' is-playing' : ''}`}
        style={{ aspectRatio: `${card.ratio[0]} / ${card.ratio[1]}` }}
        href={routeToPath({ screen: 'template', templateId: card.id })}
        aria-label={t('templatesPage.open', { name: card.name })}
      >
        {posterFailed ? (
          <span className="tcard-fallback" style={{ background: `radial-gradient(circle at 30% 30%, ${card.accent}, #0a0a0b 75%)` }} />
        ) : (
          <img src={card.posterUrl} alt="" loading="lazy" onError={() => setPosterFailed(true)} />
        )}
        {card.loopUrl && <video ref={video} src={card.loopUrl} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />}
      </a>
      <div className="tcard-info">
        <div className="tcard-text">
          <span className="tcard-title">{card.name}</span>
          <span className="tcard-meta">
            {t('templatesPage.free')} · {card.format} · {t('templatesPage.seconds', { value: seconds })}
          </span>
        </div>
        <button
          type="button"
          className={`tcard-fav${favorite ? ' is-on' : ''}`}
          aria-pressed={favorite}
          aria-label={t(favorite ? 'templatesPage.unfavorite' : 'templatesPage.favorite', { name: card.name })}
          onClick={() => toggleFavorite(card.id)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.9 4.5 7.4 4.5c2 0 3.4 1.1 4.6 2.7 1.2-1.6 2.6-2.7 4.6-2.7 3.5 0 5.7 3.5 4.6 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
          </svg>
        </button>
      </div>
    </article>
  )
}
