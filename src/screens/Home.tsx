import {
  ArrowUpRight,
  Check,
  Clapperboard,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  LayoutTemplate,
  Loader2,
  MousePointer2,
  Palette,
  PenTool,
  Plus,
  SlidersHorizontal,
  Smartphone,
  Type,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { TemplateCard } from '../components/TemplateCard'
import { reducedMotion, useAutoplay } from '../components/useAutoplay'
import { AppShell } from '../layout/AppShell'
import { TEMPLATES, templateDescription, templateName } from '../project/templates'
import { routeToPath, type Route } from '../router'
import { useAuthStore } from '../store/authStore'
import { matchesSearch, useUiStore } from '../store/uiStore'

// Girişte yalnızca yatay (16:9) şablonlar: dikey bir video yatay karta kırpılmaz.
const HERO_TEMPLATES = ['mango-ai-ad', 'fintech', 'words-motion'] as const

/**
 * Şablon vitrini (Higgsfield Genjutsu gibi): her sütunda tek bir yön, her önizleme kendi oranında; dikey ve yatay
 * aynı satırda eşit yüksekliğe zorlanmaz. Altı kararır, üstünde "Tüm şablonları gör". Dar ekranda sağdaki sütunlar gizlenir.
 */
const SHOWCASE: string[][] = [['wallet-promo'], ['mango-ai-ad', 'fintech', 'words-motion'], ['meadow-phone'], ['crystal'], ['ai-search-ad']]

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

/** Her `ms`'de bir artan sayaç (0..count-1, döner); canlı görünen kartlar bununla adım adım ilerler. */
function useTicker(count: number, ms: number) {
  const [step, setStep] = useState(() => (reducedMotion() ? count - 1 : 0))
  useEffect(() => {
    if (reducedMotion()) return
    const timer = window.setInterval(() => setStep((s) => (s + 1) % count), ms)
    return () => window.clearInterval(timer)
  }, [count, ms])
  return step
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

function HeroCard({ route, title, body, children }: { route: Route; title: string; body: string; children: ReactNode }) {
  return (
    <a className="x-hero-card" href={routeToPath(route)}>
      <span className="x-hero-media">{children}</span>
      <strong>{title}</strong>
      <span>{body}</span>
    </a>
  )
}

/** Claude ile sohbet: istem yazılır, adımlar tek tek tamamlanır, sonra baştan. */
function ClaudeChat() {
  const { t } = useTranslation()
  const step = useTicker(5, 1400)
  const steps = [t('explore.chat.s1'), t('explore.chat.s2'), t('explore.chat.s3')]
  return (
    <span className="x-chat">
      <span className="x-chat-prompt">{t('explore.chat.prompt')}</span>
      <span className="x-chat-steps">
        {steps.map((label, i) => {
          const state = step > i + 1 ? 'done' : step === i + 1 ? 'busy' : 'wait'
          return (
            <span key={label} className={`x-chat-step is-${state}`}>
              {state === 'done' ? <Check size={13} strokeWidth={2.5} /> : state === 'busy' ? <Loader2 size={13} strokeWidth={2.5} className="x-spin" /> : <span className="x-dot" />}
              {label}
            </span>
          )
        })}
      </span>
      <span className="x-chat-by">
        <Spark className="spark spark--claude" />
        Claude Opus 5.5
      </span>
    </span>
  )
}

function McpCard() {
  const { t } = useTranslation()
  const step = useTicker(5, 1500)
  const rows = [t('explore.mcpCard.s1'), t('explore.mcpCard.s2'), t('explore.mcpCard.s3'), t('explore.mcpCard.s4')]
  return (
    <section className="x-mcp-card" aria-labelledby="x-mcp-card-title">
      <header>
        <div>
          <h2 id="x-mcp-card-title">
            Mango Studio <span className="x-plus">×</span> Claude <Spark className="spark spark--claude" />
          </h2>
          <p>{t('explore.mcpCard.body')}</p>
        </div>
        <a className="x-btn x-btn--accent" href={routeToPath({ screen: 'soon', feature: 'mcp' })}>
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          {t('explore.mcpCard.install')}
        </a>
      </header>
      <div className="x-mcp-log" aria-hidden="true">
        <span className="x-mcp-connected">
          <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          {t('explore.mcpCard.connected')}
          <span className="x-live" />
        </span>
        {rows.map((label, i) => (
          <span key={label} className={`x-mcp-row ${step > i ? 'is-done' : step === i ? 'is-busy' : ''}`}>
            {step > i ? <Check size={13} strokeWidth={2.5} /> : <Film size={13} strokeWidth={2} />}
            {label}
          </span>
        ))}
      </div>
    </section>
  )
}

interface Tool {
  id: string
  icon: LucideIcon
  route: Route
  kind?: 'video' | 'image'
  badge?: 'new' | 'top'
}

// Yalnızca bugün çalışan araçlar; "yakında" olanlar ana sayfada gösterilmez.
const TOOLS: Tool[] = [
  { id: 'templates', icon: LayoutTemplate, route: { screen: 'templates' }, kind: 'video', badge: 'top' },
  { id: 'studio', icon: Clapperboard, route: { screen: 'studio' }, kind: 'video' },
  { id: 'design', icon: PenTool, route: { screen: 'new' }, kind: 'image', badge: 'new' },
  { id: 'editor', icon: SlidersHorizontal, route: { screen: 'new' }, kind: 'video' },
  { id: 'devices', icon: Smartphone, route: { screen: 'templates' }, kind: 'video' },
  { id: 'export', icon: Download, route: { screen: 'pricing' } },
]

function ToolTile({ tool }: { tool: Tool }) {
  const { t } = useTranslation()
  const Icon = tool.icon
  return (
    <a className="x-tool" href={routeToPath(tool.route)}>
      <span className="x-tool-top">
        <Icon size={17} strokeWidth={1.75} aria-hidden="true" />
        {tool.kind && (
          <span className="x-kind">
            {tool.kind === 'video' ? <Film size={11} strokeWidth={2} aria-hidden="true" /> : <ImageIcon size={11} strokeWidth={2} aria-hidden="true" />}
            {t(`explore.kinds.${tool.kind}`)}
          </span>
        )}
      </span>
      <span className="x-tool-name">
        {t(`explore.tools.${tool.id}.title`)}
        {tool.badge && <em className={`x-badge x-badge--${tool.badge}`}>{t(`explore.badges.${tool.badge}`)}</em>}
      </span>
      <span className="x-tool-body">{t(`explore.tools.${tool.id}.body`)}</span>
    </a>
  )
}

/** Claude Opus 5.5 + Mango Studio MCP tanıtımı: çevresinde Claude'un üstlendiği roller süzülür. */
function McpBanner() {
  const { t } = useTranslation()
  const roles = ['motion', 'director', 'copy', 'editor'] as const
  // Çeviride modelin yeri {{model}}: önü ve arkası ayrı, ortada Claude adı ve simgesi.
  const [before, after] = t('explore.banner.line1', { model: '|' }).split('|').map((part) => part.trim())
  return (
    <section className="x-banner" id="mcp" aria-labelledby="x-banner-title">
      {roles.map((role) => (
        <span key={role} className={`x-role x-role--${role}`} aria-hidden="true">
          <span className="x-role-avatar">
            <Spark className="spark spark--claude" />
          </span>
          <MousePointer2 className="x-role-cursor" size={15} strokeWidth={1.75} />
          <span className="x-role-label">{t(`explore.banner.roles.${role}`)}</span>
        </span>
      ))}
      <h2 id="x-banner-title">
        <span className="x-banner-line">
          {before ? `${before} ` : ''}
          <span className="x-claude">Claude</span>
          <Spark className="spark spark--claude spark--spin" />
          <span className="x-claude">Opus 5.5</span>
          {after ? ` ${after}` : ''}
        </span>
        <span className="x-banner-line">{t('explore.banner.line2')}</span>
      </h2>
      <p>{t('explore.banner.body')}</p>
      <a className="x-btn x-btn--accent x-btn--big" href={routeToPath({ screen: 'soon', feature: 'mcp' })}>
        <img src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
        {t('explore.banner.cta')}
      </a>
    </section>
  )
}

function Showcase() {
  const { t } = useTranslation()
  return (
    <section className="x-section" aria-labelledby="x-showcase-title">
      <header className="x-section-head">
        <div>
          <span className="x-pill-new">
            <PenTool size={11} strokeWidth={2} aria-hidden="true" />
            {t('explore.showcase.eyebrow', { count: TEMPLATES.length })}
          </span>
          <h2 id="x-showcase-title">{t('explore.showcase.title')}</h2>
          <p>{t('explore.showcase.body')}</p>
        </div>
        <div className="x-head-actions">
          <a className="x-btn x-btn--accent" href={routeToPath({ screen: 'templates' })}>
            {t('explore.showcase.tryFree')}
          </a>
          <a className="x-btn x-btn--light" href="#x-edit">
            {t('explore.showcase.learn')}
          </a>
        </div>
      </header>
      <div className="x-wall">
        {SHOWCASE.map((column, i) => (
          <div key={i} className={`x-wall-col x-wall-col--${i + 1}`}>
            {column.map((id) => {
              const template = TEMPLATES.find((tpl) => tpl.id === id)
              if (!template) return null
              const [w, h] = template.format.split(':').map(Number)
              return (
                <a key={id} className="x-tile" style={{ aspectRatio: `${w} / ${h}` }} href={routeToPath({ screen: 'template', templateId: id })}>
                  <Loop id={id} />
                  <span className="x-shot-label">{templateName(id)}</span>
                </a>
              )
            })}
          </div>
        ))}
        <a className="x-fade-cta" href={routeToPath({ screen: 'templates' })}>
          {t('explore.showcase.viewAll')}
          <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </div>
    </section>
  )
}

const EDIT_POINTS: { id: string; icon: LucideIcon }[] = [
  { id: 'text', icon: Type },
  { id: 'colors', icon: Palette },
  { id: 'screens', icon: Smartphone },
  { id: 'motion', icon: Video },
]

/**
 * Düzenleme bandı (yatay): solda neyin değiştirilebildiği, sağda canlı bir editör: katman seçilir, başlık yazılır,
 * renk değişir, önizleme aynı anda güncellenir, timeline oynar.
 */
function EditBand() {
  const { t } = useTranslation()
  const step = useTicker(3, 2400)
  const titles = [t('explore.edit.sample1'), t('explore.edit.sample2'), t('explore.edit.sample3')]
  const layers = [t('explore.edit.layers.title'), t('explore.edit.layers.logo'), t('explore.edit.layers.phone'), t('explore.edit.layers.background')]
  return (
    <section className="x-editband" id="x-edit" aria-labelledby="x-edit-title">
      <div className="x-editband-text">
        <span className="x-pill-new">
          <PenTool size={11} strokeWidth={2} aria-hidden="true" />
          {t('explore.edit.badge')}
        </span>
        <h2 id="x-edit-title">{t('explore.edit.title')}</h2>
        <p>{t('explore.edit.body')}</p>
        <ul className="x-edit-points">
          {EDIT_POINTS.map(({ id, icon: Icon }) => (
            <li key={id}>
              <span className="x-edit-point-icon" aria-hidden="true">
                <Icon size={15} strokeWidth={1.75} />
              </span>
              <span>
                <strong>{t(`explore.edit.points.${id}.title`)}</strong>
                {t(`explore.edit.points.${id}.body`)}
              </span>
            </li>
          ))}
        </ul>
        <div className="x-head-actions">
          <a className="x-btn x-btn--accent" href={routeToPath({ screen: 'templates' })}>
            {t('explore.edit.cta')}
          </a>
          <a className="x-btn x-btn--ghost" href={routeToPath({ screen: 'new' })}>
            {t('explore.edit.blank')}
          </a>
        </div>
      </div>

      <div className="x-editor" aria-hidden="true">
        <div className="x-editor-bar">
          <i />
          <i />
          <i />
          <span>{t('explore.edit.project')}</span>
          <b>{t('explore.edit.export')}</b>
        </div>
        <div className="x-editor-body">
          <div className="x-editor-layers">
            <span className="x-editor-label">
              <Layers size={12} strokeWidth={2} />
              {t('explore.edit.layersLabel')}
            </span>
            {layers.map((name, i) => (
              <span key={name} className={`x-editor-layer${i === 0 ? ' is-on' : ''}`}>
                {name}
              </span>
            ))}
          </div>
          <div className={`x-editor-stage is-c${step}`}>
            <span className="x-editor-phone" />
            <span key={step} className="x-editor-title">
              {titles[step]}
            </span>
            <img className="x-editor-logo" src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          </div>
          <div className="x-editor-props">
            <span className="x-editor-label">{t('explore.edit.field')}</span>
            <span className="x-editor-input">
              {titles[step]}
              <i className="x-caret" />
            </span>
            <span className="x-editor-label">{t('explore.edit.color')}</span>
            <span className="x-editor-swatches">
              {[0, 1, 2].map((i) => (
                <i key={i} className={`is-c${i}${step === i ? ' is-on' : ''}`} />
              ))}
            </span>
            <span className="x-editor-label">{t('explore.edit.animation')}</span>
            <span className="x-editor-chip">{t('explore.edit.animationValue')}</span>
          </div>
        </div>
        <div className="x-editor-timeline">
          <i style={{ left: '2%', width: '40%' }} />
          <i style={{ left: '24%', width: '48%' }} />
          <i style={{ left: '8%', width: '70%' }} />
          <i style={{ left: '0%', width: '100%' }} />
          <b />
        </div>
      </div>
    </section>
  )
}

/** Keşfet: Higgsfield düzeninde canlı ana sayfa. Arama yapılınca eşleşen şablonlar ızgarada. */
export function Home() {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  // Giriş yapmamış ziyaretçide sol menü yok (Higgsfield gibi yalnızca üst çubuk).
  const guest = useAuthStore((s) => !!supabase && s.status === 'out')

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

  const [first, second, third] = HERO_TEMPLATES
  return (
    <AppShell current={{ screen: 'home' }} title={t('nav.home')} bare={guest}>
      <div className="x-page">
        <div className="x-hero">
          <HeroCard route={{ screen: 'template', templateId: first }} title={t('explore.hero.ad.title')} body={t('explore.hero.ad.body')}>
            <Loop id={first} />
          </HeroCard>
          <HeroCard route={{ screen: 'soon', feature: 'mcp' }} title={t('explore.hero.claude.title')} body={t('explore.hero.claude.body')}>
            <ClaudeChat />
          </HeroCard>
          <HeroCard route={{ screen: 'template', templateId: second }} title={t('explore.hero.fintech.title')} body={t('explore.hero.fintech.body')}>
            <Loop id={second} />
          </HeroCard>
          <HeroCard route={{ screen: 'template', templateId: third }} title={t('explore.hero.words.title')} body={t('explore.hero.words.body')}>
            <Loop id={third} />
          </HeroCard>
        </div>

        <div className="x-row">
          <McpCard />
          <nav className="x-tools" aria-label={t('explore.toolsLabel')}>
            {TOOLS.map((tool) => (
              <ToolTile key={tool.id} tool={tool} />
            ))}
          </nav>
        </div>

        <McpBanner />
        <Showcase />
        <EditBand />
      </div>
    </AppShell>
  )
}
