import { ChevronRight, Pause, Play } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog } from '../components/Dialog'
import { cardInfo } from '../components/cardInfo'
import { TemplateCard } from '../components/TemplateCard'
import { AppShell } from '../layout/AppShell'
import { createFromTemplate } from '../project/actions'
import { createFromPublished, getPublished, listPublished, unpublishTemplate, type PublishedTemplate } from '../project/publishedTemplates'
import { TEMPLATES, templateAbout, type Template } from '../project/templates'
import { navigate, routeToPath } from '../router'
import { useProfileStore } from '../store/profileStore'
import { useUiStore } from '../store/uiStore'

const DEVICE_KINDS = new Set(['phone', 'tablet', 'laptop', 'foldable'])

/** Önizleme sayfasının gösterdikleri; kendi şablonlarımız ve yayınlananlar aynı düzende. */
interface PreviewModel {
  id: string
  about: string
  width: number
  height: number
  fps?: number
  /** doldurulacak ekran ve metin sayısı (yalnızca kendi şablonlarımızda hesaplanır) */
  fillIn?: { screens: number; texts: number }
  tags: string[]
  published: boolean
  use: () => Promise<void>
}

function builtInModel(template: Template, t: (key: string) => string): PreviewModel {
  // Teknik bilgiler şablonun kendisinden okunur (elle yazılan sayılar zamanla yanlış olur).
  const project = template.build()
  const screens = new Set(project.layers.filter((l) => DEVICE_KINDS.has(l.kind) && l.image).map((l) => l.image)).size
  const texts = project.layers.filter((l) => l.kind === 'text').length
  return {
    id: template.id,
    about: templateAbout(template.id),
    width: project.width,
    height: project.height,
    fps: project.fps,
    fillIn: { screens, texts },
    tags: template.tags.map((tag) => t(`templateTags.${tag}`)),
    published: false,
    use: () => createFromTemplate(template.id),
  }
}

function publishedModel(template: PublishedTemplate): PreviewModel {
  return {
    id: template.id,
    about: template.description,
    width: template.width,
    height: template.height,
    tags: template.tags,
    published: true,
    use: async () => {
      await createFromPublished(template.id)
      navigate({ screen: 'studio' })
    },
  }
}

/**
 * Şablon önizleme sayfası: döngü videosu, açıklama, yapımcı ve teknik bilgiler, etiketler; altta diğer
 * şablonlar. "Ücretsiz kullan" projeyi oluşturup kullanıcının Studio'suna götürür. Yayınlanan şablonda
 * yönetici "Yayından kaldır"ı görür.
 */
export function TemplatePreview({ templateId }: { templateId: string }) {
  const { t, i18n } = useTranslation()
  const builtIn = TEMPLATES.find((tpl) => tpl.id === templateId)
  const [published, setPublished] = useState<PublishedTemplate[]>([])
  const [remote, setRemote] = useState<PublishedTemplate | null | undefined>(builtIn ? null : undefined)
  const favorite = useUiStore((s) => s.favorites.includes(templateId))
  const toggleFavorite = useUiStore((s) => s.toggleFavorite)
  const isAdmin = useProfileStore((s) => s.isAdmin)
  const video = useRef<HTMLVideoElement>(null)
  const [paused, setPaused] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void listPublished().then((list) => alive && setPublished(list))
    if (!builtIn) void getPublished(templateId).then((tpl) => alive && setRemote(tpl ?? null), () => alive && setRemote(null))
    return () => {
      alive = false
    }
  }, [templateId, builtIn])

  const template = builtIn ?? remote ?? undefined
  const model = useMemo(() => (builtIn ? builtInModel(builtIn, t) : remote ? publishedModel(remote) : null), [builtIn, remote, t])

  if (remote === undefined) {
    return (
      <AppShell current={{ screen: 'templates' }} title={t('templatePreview.breadcrumb')}>
        <p className="hint">{t('studio.loading')}</p>
      </AppShell>
    )
  }

  if (!template || !model) {
    return (
      <AppShell current={{ screen: 'templates' }} title={t('templatePreview.breadcrumb')}>
        <div className="soon">
          <h2>{t('templatePreview.notFound')}</h2>
          <a className="button-primary" href={routeToPath({ screen: 'templates' })}>
            {t('newProject.template.action')}
          </a>
        </div>
      </AppShell>
    )
  }

  const card = cardInfo(template)
  const base = import.meta.env.BASE_URL
  const [w, h] = card.ratio
  const seconds = card.seconds.toLocaleString(i18n.language, { maximumFractionDigits: 1 })
  const others = [...published, ...TEMPLATES].filter((tpl) => tpl.id !== template.id)

  const togglePlay = () => {
    const v = video.current
    if (!v) return
    if (v.paused) void v.play().catch(() => undefined)
    else v.pause()
  }

  const use = async () => {
    setCreating(true)
    setError(null)
    try {
      await model.use()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const remove = async () => {
    await unpublishTemplate(model.id)
    navigate({ screen: 'templates' })
  }

  return (
    <AppShell current={{ screen: 'templates' }} title={card.name}>
      <div className="tp">
        <nav className="tp-crumbs" aria-label={t('templatePreview.breadcrumb')}>
          <a href={routeToPath({ screen: 'templates' })}>{t('templatePreview.breadcrumb')}</a>
          <ChevronRight size={13} strokeWidth={1.75} aria-hidden="true" />
          <span aria-current="page">{card.name}</span>
        </nav>

        <header className="tp-head">
          <h1>{card.name}</h1>
          <div className="tp-head-actions">
            {model.published && isAdmin && (
              <button type="button" className="tp-unpublish" onClick={() => setConfirmRemove(true)}>
                {t('publish.remove')}
              </button>
            )}
            <button
              type="button"
              className={`tp-fav${favorite ? ' is-on' : ''}`}
              aria-pressed={favorite}
              aria-label={t(favorite ? 'templatesPage.unfavorite' : 'templatesPage.favorite', { name: card.name })}
              onClick={() => toggleFavorite(template.id)}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-9.2-9.3C1.7 8 3.9 4.5 7.4 4.5c2 0 3.4 1.1 4.6 2.7 1.2-1.6 2.6-2.7 4.6-2.7 3.5 0 5.7 3.5 4.6 6.7-1.7 4.7-9.2 9.3-9.2 9.3z" />
              </svg>
            </button>
            <button type="button" className="primary tp-use" onClick={() => void use()} disabled={creating}>
              {creating ? t('templatePreview.creating') : t('templatePreview.useFree')}
            </button>
          </div>
        </header>
        {error && <p className="page-error">{error}</p>}

        <div className="tp-stage">
          <div className="tp-media" style={{ aspectRatio: `${w} / ${h}`, ['--tp-ratio' as string]: w / h }}>
            {card.loopUrl ? (
              <>
                <video
                  ref={video}
                  src={card.loopUrl}
                  poster={card.posterUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  onPlay={() => setPaused(false)}
                  onPause={() => setPaused(true)}
                />
                <button type="button" className="tp-play" onClick={togglePlay} aria-label={t(paused ? 'templatePreview.play' : 'templatePreview.pause')}>
                  {paused ? <Play size={14} strokeWidth={2} /> : <Pause size={14} strokeWidth={2} />}
                </button>
              </>
            ) : card.posterUrl ? (
              <img src={card.posterUrl} alt="" />
            ) : (
              <span className="tcard-fallback" style={{ background: `radial-gradient(circle at 30% 30%, ${card.accent}, #0a0a0b 75%)` }} />
            )}
          </div>
        </div>

        <div className="tp-body">
          <section className="tp-about">
            <h2>{t('templatePreview.about')}</h2>
            <p>{model.about}</p>
          </section>

          <aside className="tp-side">
            <section className="tp-card">
              <h2>{t('templatePreview.details')}</h2>
              <dl>
                <div>
                  <dt>{t('templatePreview.creator')}</dt>
                  <dd className="tp-creator">
                    <img src={`${base}brand/mango-mark-96.png`} alt="" />
                    {t('templatePreview.madeBy')}
                  </dd>
                </div>
                <div>
                  <dt>{t('templatePreview.price')}</dt>
                  <dd>{t('templatePreview.free')}</dd>
                </div>
              </dl>
            </section>
            <section className="tp-card">
              <h2>{t('templatePreview.specs')}</h2>
              <dl>
                <div>
                  <dt>{t('templatePreview.aspect')}</dt>
                  <dd>{card.format}</dd>
                </div>
                <div>
                  <dt>{t('templatePreview.duration')}</dt>
                  <dd>{t('templatesPage.seconds', { value: seconds })}</dd>
                </div>
                <div>
                  <dt>{t('templatePreview.resolution')}</dt>
                  <dd>
                    {model.width} × {model.height}
                  </dd>
                </div>
                {model.fps && (
                  <div>
                    <dt>{t('templatePreview.frameRate')}</dt>
                    <dd>{t('templatePreview.fps', { value: model.fps })}</dd>
                  </div>
                )}
                {model.fillIn && (
                  <div>
                    <dt>{t('templatePreview.fillIn')}</dt>
                    <dd>
                      {model.fillIn.screens > 0
                        ? t('templatePreview.fillInValue', { count: model.fillIn.screens, text: model.fillIn.texts })
                        : t('templatePreview.fillInText', { text: model.fillIn.texts })}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
            {model.tags.length > 0 && (
              <section className="tp-card">
                <h2>{t('templatePreview.categories')}</h2>
                <ul className="tp-tags">
                  {model.tags.map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>
              </section>
            )}
          </aside>
        </div>

        {others.length > 0 && (
          <section className="tp-more">
            <h2>{t('templatePreview.more')}</h2>
            <div className="tcard-grid tcard-grid--row">
              {others.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          </section>
        )}
      </div>
      {confirmRemove && (
        <ConfirmDialog
          title={t('publish.removeTitle', { name: card.name })}
          body={t('publish.removeBody')}
          confirmLabel={t('publish.remove')}
          onClose={() => setConfirmRemove(false)}
          onConfirm={() => void remove()}
        />
      )}
    </AppShell>
  )
}
