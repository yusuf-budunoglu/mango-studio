import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createFromTemplate } from '../project/actions'
import { TEMPLATES, templateName, type Template } from '../project/templates'
import { routeToHash } from '../router'

/** 12 kollu ışık; Claude adının yanındaki simge. */
function Spark() {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg className="mcp-spark" viewBox="-50 -50 100 100" aria-hidden="true">
      {rays.map((deg, i) => (
        <rect key={deg} x={-4} y={i % 2 ? -46 : -50} width={8} height={i % 2 ? 40 : 44} rx={4} fill="currentColor" transform={`rotate(${deg})`} />
      ))}
    </svg>
  )
}

/** Şablonun döngü videosu (`public/templates/loops/<id>.mp4`); yoksa kapak görseli. */
function LoopCard({ template, hidden }: { template: Template; hidden?: boolean }) {
  const [ratio, setRatio] = useState<number>()
  const [failed, setFailed] = useState(false)
  const base = import.meta.env.BASE_URL
  return (
    <button
      type="button"
      className="marquee-card"
      style={{ aspectRatio: ratio ?? 16 / 9 }}
      onClick={() => void createFromTemplate(template.id)}
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
    >
      {failed ? (
        <img src={`${base}templates/${template.id}.jpg`} alt="" loading="lazy" />
      ) : (
        <video
          src={`${base}templates/loops/${template.id}.mp4`}
          poster={`${base}templates/${template.id}.jpg`}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          onLoadedMetadata={(e) => setRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight)}
          onError={() => setFailed(true)}
        />
      )}
      <span className="marquee-label">{templateName(template.id)}</span>
    </button>
  )
}

/** Ana sayfadaki "Claude ile Mango Studio MCP" tanıtımı; altında şablonlar sürekli akar. */
export function McpPromo() {
  const { t } = useTranslation()
  return (
    <section className="mcp" id="mcp" aria-labelledby="mcp-title">
      <p className="mcp-lead">{t('mcp.lead')}</p>
      <h2 className="mcp-title" id="mcp-title">
        <span>{t('mcp.model')}</span>
        <Spark />
        <span>{t('mcp.version')}</span>
      </h2>
      <p className="mcp-body">{t('mcp.body')}</p>
      <a className="mcp-install" href={routeToHash({ screen: 'soon', feature: 'mcp' })}>
        <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
        {t('mcp.install')}
      </a>
      <div className="marquee" role="group" aria-label={t('mcp.marquee')}>
        <div className="marquee-track">
          {TEMPLATES.map((tpl) => (
            <LoopCard key={tpl.id} template={tpl} />
          ))}
          {TEMPLATES.map((tpl) => (
            <LoopCard key={`copy-${tpl.id}`} template={tpl} hidden />
          ))}
        </div>
      </div>
    </section>
  )
}
