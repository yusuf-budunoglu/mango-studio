import { ArrowUpRight, Palette, Smartphone, Type, Video, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { AuroraBackground } from '../components/AuroraBackground'
import { McpCommand } from '../components/McpCommand'
import { TemplateCard } from '../components/TemplateCard'
import { useAutoplay } from '../components/useAutoplay'
import { AppShell } from '../layout/AppShell'
import { loadPromptLibrary, promptPosterUrl, promptPreviewUrl, type LibraryPrompt } from '../project/promptLibrary'
import { TEMPLATES, templateDescription, templateName } from '../project/templates'
import { routeToPath, type Route } from '../router'
import { useAuthStore } from '../store/authStore'
import { matchesSearch, useUiStore } from '../store/uiStore'
import '../styles/home.css'

// Ana sayfada gösterilen şablonlar: yalnızca yatay (16:9), dikey bir video yatay karta kırpılmaz.
const HOME_TEMPLATES = ['fintech', 'fold-promo', 'words-motion'] as const
/** Ana sayfada gösterilen prompt önizlemesi sayısı. */
const HOME_PROMPTS = 4

/** 12 kollu ışık: Claude adının yanındaki simge. */
export function Spark({ className = 'spark' }: { className?: string }) {
  const rays = Array.from({ length: 12 }, (_, i) => i * 30)
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden="true">
      {rays.map((deg, i) => (
        <rect key={deg} x={-4} y={i % 2 ? -46 : -50} width={8} height={i % 2 ? 40 : 44} rx={4} fill="currentColor" transform={`rotate(${deg})`} />
      ))}
    </svg>
  )
}

/** Şablonun sessiz döngü videosu; ekranda görünürken oynar. */
function Loop({ id }: { id: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const playing = useAutoplay(video)
  const base = import.meta.env.BASE_URL
  return (
    <span className={`x-loop${playing ? ' is-playing' : ''}`}>
      <img src={`${base}templates/posters/${id}.jpg`} alt="" loading="lazy" />
      <video ref={video} src={`${base}templates/loops/${id}.mp4`} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />
    </span>
  )
}

/**
 * Ana sayfada gösterilecek prompt'lar: kapağı ve önizlemesi olan 16:9 videolar, aynı yazar bir kez.
 * `library` indirilene kadar boş; indirilemezse `failed` (prompt bölümü çizilmez).
 */
function usePromptPicks() {
  const [library, setLibrary] = useState<LibraryPrompt[]>()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    loadPromptLibrary().then(
      (list) => alive && setLibrary(list),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [])

  const seen = new Set<string>()
  const picks = (library ?? [])
    .filter((p) => !p.noPoster && !p.noPreview && Math.abs(p.width / p.height - 16 / 9) < 0.02 && !seen.has(p.handle) && !!seen.add(p.handle))
    .slice(0, HOME_PROMPTS)
  return { library, failed, picks }
}

function PromptTile({ prompt }: { prompt: LibraryPrompt }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const playing = useAutoplay(video)
  return (
    <a className="x-tile" href={routeToPath({ screen: 'prompts', promptId: prompt.id })} aria-label={t('promptsPage.open', { handle: prompt.handle })}>
      <span className={`x-loop${playing ? ' is-playing' : ''}`}>
        <img src={promptPosterUrl(prompt)} alt="" loading="lazy" />
        <video ref={video} src={promptPreviewUrl(prompt)} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />
      </span>
      <span className="x-shot-label">@{prompt.handle}</span>
    </a>
  )
}

const EDIT_POINTS: { id: string; icon: LucideIcon }[] = [
  { id: 'text', icon: Type },
  { id: 'colors', icon: Palette },
  { id: 'screens', icon: Smartphone },
  { id: 'motion', icon: Video },
]

/** Bölüm: solda küçük üst yazı, büyük başlık ve kısa açıklama; sağda (ya da `wide` ise altında) içerik. */
export function Section({ id, eyebrow, title, lead, wide, children }: { id: string; eyebrow?: string; title: string; lead: string; wide?: boolean; children: ReactNode }) {
  return (
    <section className={`h-section${wide ? ' h-section--wide' : ''}`} aria-labelledby={id}>
      <header>
        <div>
          {eyebrow && <span className="h-eyebrow">{eyebrow}</span>}
          <h2 id={id}>{title}</h2>
        </div>
        <p>{lead}</p>
      </header>
      {children}
    </section>
  )
}

export function TextLink({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <a className="h-link" href={routeToPath(route)}>
      {children}
      <ArrowUpRight size={15} strokeWidth={2} aria-hidden="true" />
    </a>
  )
}

/** Girişteki büyük video (AI video ad şablonunun yüksek çözünürlüklü döngüsü); ekranda görünürken oynar. */
function HeroVideo() {
  const video = useRef<HTMLVideoElement>(null)
  const playing = useAutoplay(video)
  const base = import.meta.env.BASE_URL
  return (
    <a className="h-hero-video" href={routeToPath({ screen: 'template', templateId: 'mango-ai-ad' })} aria-label={templateName('mango-ai-ad')}>
      <span className={`x-loop${playing ? ' is-playing' : ''}`}>
        <img src={`${base}home/hero.jpg`} alt="" />
        <video ref={video} src={`${base}home/hero.mp4`} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />
      </span>
    </a>
  )
}

/**
 * Ana sayfa: hareketli zemin üstünde büyük başlık + video, ardından dört sade bölüm (şablonlar, Claude, prompt'lar,
 * düzenleme). Sayılar (şablon ve prompt adedi) bölümlerin üst yazısında.
 * Arama yapılınca eşleşen şablonlar ızgarada.
 */
export function Home() {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  // Giriş yapmamış ziyaretçide sol menü yok (yalnızca üst çubuk).
  const guest = useAuthStore((s) => !!supabase && s.status === 'out')
  const { library, failed, picks } = usePromptPicks()

  if (search.trim()) {
    const found = TEMPLATES.filter((tpl) => matchesSearch(`${templateName(tpl.id)} ${templateDescription(tpl.id)}`, search))
    return (
      <AppShell current={{ screen: 'home' }} title={t('nav.home')} bare={guest}>
        <div className="x-page">
          {found.length === 0 ? (
            <p className="hint">{t('search.noResults', { query: search })}</p>
          ) : (
            <div className="tcard-grid">
              {found.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell current={{ screen: 'home' }} title={t('nav.home')} bare={guest}>
      <div className="h-page">
        <AuroraBackground />
        <header className="h-hero">
          <h1>
            Mango <span>Studio</span>
          </h1>
          <p className="h-tagline">{t('homePage.tagline')}</p>
          <div className="h-hero-actions">
            <a className="h-btn h-btn--accent" href={routeToPath({ screen: 'templates' })}>
              {t('homePage.browse')}
            </a>
            <a className="h-btn" href={routeToPath({ screen: 'claude' })}>
              <Spark className="spark spark--claude" />
              {t('homePage.connect')}
            </a>
          </div>
          <p className="h-note">{t('homePage.note')}</p>
        </header>
        <HeroVideo />

        <Section id="h-templates" eyebrow={t('explore.showcase.eyebrow', { count: TEMPLATES.length })} title={t('explore.showcase.title')} lead={t('explore.showcase.body')} wide>
          <div className="h-grid">
            {HOME_TEMPLATES.map((id) => (
              <a key={id} className="x-tile" href={routeToPath({ screen: 'template', templateId: id })}>
                <Loop id={id} />
                <span className="x-shot-label">{templateName(id)}</span>
              </a>
            ))}
          </div>
          <TextLink route={{ screen: 'templates' }}>{t('explore.showcase.viewAll')}</TextLink>
        </Section>

        <Section id="h-claude" eyebrow={t('homePage.claude.eyebrow')} title={t('homePage.claude.title')} lead={t('explore.banner.body')} wide>
          <McpCommand />
          <ol className="h-steps">
            {(['s1', 's2', 's3', 's4'] as const).map((step, n) => (
              <li key={step}>
                <small>0{n + 1}</small>
                {t(`explore.mcpCard.${step}`)}
              </li>
            ))}
          </ol>
          <TextLink route={{ screen: 'claude' }}>{t('explore.banner.cta')}</TextLink>
        </Section>

        {!failed && (
          <Section id="h-prompts" eyebrow={library ? t('explore.prompts.eyebrow', { count: library.length }) : undefined} title={t('explore.prompts.title')} lead={t('explore.prompts.body')} wide>
            <div className="h-grid h-grid--4">
              {library ? picks.map((prompt) => <PromptTile key={prompt.id} prompt={prompt} />) : Array.from({ length: HOME_PROMPTS }, (_, i) => <span key={i} className="x-tile" />)}
            </div>
            <TextLink route={{ screen: 'prompts' }}>{t('explore.prompts.cta')}</TextLink>
          </Section>
        )}

        <Section id="h-edit" eyebrow={t('explore.edit.badge')} title={t('explore.edit.title')} lead={t('explore.edit.body')}>
          <div className="h-card">
            <ul className="h-rows h-rows--points">
              {EDIT_POINTS.map(({ id, icon: Icon }) => (
                <li key={id}>
                  <span>
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                    {t(`explore.edit.points.${id}.title`)}
                  </span>
                  <small>{t(`explore.edit.points.${id}.body`)}</small>
                </li>
              ))}
            </ul>
            <TextLink route={{ screen: 'new' }}>{t('explore.edit.blank')}</TextLink>
          </div>
        </Section>
      </div>
    </AppShell>
  )
}
