import { ArrowUpRight, Check, Copy, Pause, Play, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { isPostUrl, PROMPT_MODEL, promptCardRatio, promptPosterUrl, promptPreviewUrl, type LibraryPrompt } from '../project/promptLibrary'
import { supabase } from '../cloud/client'
import { routeToPath } from '../router'
import { rememberNext } from '../store/afterSignIn'
import { useAuthStore } from '../store/authStore'
import { reducedMotion, useAutoplay } from './useAutoplay'

/** "Kopyalandı" yazısının ekranda kalma süresi */
const COPIED_MS = 1600

/**
 * Prompt'u kopyalamak üyelik ister. Üye olmayan ziyaretçide (bulut açıkken) `guest` true; `copy` kopyalamak yerine
 * giriş penceresini açar ve girişten sonra aynı prompt'a dönülür. Üyede metni panoya kopyalar; kısa bir süre `copied`
 * true kalır. Pano reddederse (izin, eski tarayıcı) sessizce false.
 */
function useCopy(prompt: LibraryPrompt) {
  const [copied, setCopied] = useState(false)
  const timer = useRef(0)
  const guest = useAuthStore((s) => s.status) === 'out' && !!supabase
  const openSignIn = useAuthStore((s) => s.openSignIn)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const text = prompt.prompt
  const copy = () => {
    if (guest) {
      rememberNext(routeToPath({ screen: 'prompts', promptId: prompt.id }))
      openSignIn()
      return
    }
    void navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true)
        window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setCopied(false), COPIED_MS)
      },
      () => setCopied(false),
    )
  }
  return { copied, copy, guest }
}

/**
 * Prompt kartı: videonun kısa önizlemesi kendi oranında (ekranda görünürken oynar), altında yalnızca yazar ve
 * kopyalama düğmesi; prompt metni kartta yazmaz. Önizlemeye tıklayınca prompt penceresi karttan büyüyerek açılır.
 */
export function PromptCard({ prompt, onOpen }: { prompt: LibraryPrompt; onOpen: (id: string) => void }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const poster = promptPosterUrl(prompt)
  const preview = promptPreviewUrl(prompt)
  const [posterFailed, setPosterFailed] = useState(!poster)
  const playing = useAutoplay(video)
  const { copied, copy } = useCopy(prompt)

  return (
    <article className="tcard promptcard">
      {/* Gerçek bağlantı (yeni sekmede açılabilir); düz tıklamada sayfa değişmez, pencere açılır. */}
      <a
        className={`tcard-media${playing ? ' is-playing' : ''}`}
        style={{ aspectRatio: String(promptCardRatio(prompt)) }}
        href={routeToPath({ screen: 'prompts', promptId: prompt.id })}
        aria-label={t('promptsPage.open', { handle: prompt.handle })}
        data-prompt-id={prompt.id}
        onClick={(event) => {
          if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onOpen(prompt.id)
        }}
      >
        {posterFailed ? <span className="tcard-fallback promptcard-fallback" /> : <img src={poster} alt="" loading="lazy" onError={() => setPosterFailed(true)} />}
        {preview && <video ref={video} src={preview} muted loop playsInline preload="none" aria-hidden="true" disablePictureInPicture />}
      </a>
      <div className="tcard-info">
        <span className="tcard-meta promptcard-author">@{prompt.handle}</span>
        <button
          type="button"
          className={`tcard-fav${copied ? ' is-on' : ''}`}
          aria-label={t(copied ? 'promptsPage.copied' : 'promptsPage.copy')}
          title={t(copied ? 'promptsPage.copied' : 'promptsPage.copy')}
          onClick={copy}
        >
          {copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </div>
    </article>
  )
}

/** Üye olmayana gösterilen (ve sayfaya yazılan) en uzun prompt parçası */
const GUEST_CHARS = 280

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

/** Penceredeki video: döngüde sessiz oynar; altında oynat/durdur düğmesi ve sürüklenebilir zaman çubuğu. */
function PreviewPlayer({ src, poster }: { src: string; poster?: string }) {
  const { t } = useTranslation()
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)

  // timeupdate saniyede birkaç kez gelir; çubuk akıcı ilerlesin diye oynarken her karede okunur.
  useEffect(() => {
    if (!playing) return
    let frame = requestAnimationFrame(function tick() {
      if (video.current) setTime(video.current.currentTime)
      frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [playing])

  const toggle = () => {
    const v = video.current
    if (!v) return
    if (v.paused) void v.play().catch(() => setPlaying(false))
    else v.pause()
  }

  return (
    <div className="pmodal-player">
      <video
        ref={video}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay={!reducedMotion()}
        disablePictureInPicture
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
      />
      <div className="pmodal-controls">
        <button type="button" className="icon-button" onClick={toggle} aria-label={t(playing ? 'promptsPage.pause' : 'promptsPage.play')} title={t(playing ? 'promptsPage.pause' : 'promptsPage.play')}>
          {playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
        </button>
        <input
          type="range"
          className="pmodal-seek"
          min={0}
          max={duration || 1}
          step={0.01}
          value={Math.min(time, duration || 1)}
          aria-label={t('promptsPage.seek')}
          onChange={(event) => {
            const next = Number(event.target.value)
            if (video.current) video.current.currentTime = next
            setTime(next)
          }}
        />
        <span className="pmodal-time">
          {clock(time)} / {clock(duration)}
        </span>
      </div>
    </div>
  )
}

/** Açılış: hafif taşan yay; kapanış: daha kısa ve taşmasız. */
const OPEN_MS = 520
const CLOSE_MS = 280
const SPRING = 'cubic-bezier(0.22, 1.16, 0.36, 1)'
const SETTLE = 'cubic-bezier(0.4, 0, 0.6, 1)'
/** Arka planın en bulanık hali; CSS'teki `.pmodal-scrim` ile aynı olmalı. */
const SCRIM_BLUR = 'blur(22px) saturate(1.15)'

/**
 * Pencerenin karttan büyümüş gibi görünmesi için başlangıç dönüşümü: pencereyi tıklanan kartın yerine ve genişliğine
 * getirir. Kart ekranda değilse (doğrudan adresle açıldı, kaydırıldı) yerinde hafifçe küçülür.
 */
function fromCard(panel: HTMLElement, promptId: string): string {
  const card = document.querySelector<HTMLElement>(`[data-prompt-id="${CSS.escape(promptId)}"]`)
  const from = card?.getBoundingClientRect()
  if (!from || from.width === 0 || from.bottom < 0 || from.top > window.innerHeight) return 'scale(0.92)'
  const to = panel.getBoundingClientRect()
  const dx = from.left + from.width / 2 - (to.left + to.width / 2)
  const dy = from.top + from.height / 2 - (to.top + to.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${Math.max(0.1, from.width / to.width)})`
}

/**
 * Prompt penceresi: solda video, sağda yazar, prompt ve üretim bilgileri. Tıklanan karttan yaylanarak büyür, arkadaki
 * sayfa bu sırada bulanıklaşır; kapanırken karta geri küçülür. Kendi `<dialog>`'u (Esc, odak tuzağı); `Dialog`
 * bileşeninin dar ve başlıklı düzeni buraya uymuyor.
 */
export function PromptDialog({ prompt, onClose }: { prompt: LibraryPrompt; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const side = useRef<HTMLDivElement>(null)
  const closing = useRef(false)
  const [expanded, setExpanded] = useState(false)
  const { copied, copy, guest } = useCopy(prompt)
  const preview = promptPreviewUrl(prompt)
  const poster = promptPosterUrl(prompt)
  const long = prompt.prompt.length > 420 || prompt.prompt.split('\n').length > 9

  useLayoutEffect(() => {
    const el = dialog.current
    if (!el || !panel.current) return
    if (!el.open) el.showModal()
    el.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    if (reducedMotion()) {
      panel.current.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 })
      return
    }
    panel.current.animate(
      [
        { transform: fromCard(panel.current, prompt.id), opacity: 0 },
        { opacity: 1, offset: 0.3 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: OPEN_MS, easing: SPRING },
    )
    scrim.current?.animate(
      [
        { opacity: 0, backdropFilter: 'blur(0px) saturate(1)' },
        { opacity: 1, backdropFilter: SCRIM_BLUR },
      ],
      { duration: OPEN_MS * 0.8, easing: 'ease-out' },
    )
    // içerik pencere yerine oturmaya yakınken belirir
    side.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: OPEN_MS * 0.6, delay: OPEN_MS * 0.25, fill: 'backwards', easing: 'ease-out' })
    return () => el.close()
  }, [prompt.id])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    const box = panel.current
    if (!box || reducedMotion()) return onClose()
    scrim.current?.animate(
      [
        { opacity: 1, backdropFilter: SCRIM_BLUR },
        { opacity: 0, backdropFilter: 'blur(0px) saturate(1)' },
      ],
      { duration: CLOSE_MS, easing: 'ease-in', fill: 'forwards' },
    )
    box
      .animate(
        [
          { transform: 'none', opacity: 1 },
          { opacity: 1, offset: 0.55 },
          { transform: fromCard(box, prompt.id), opacity: 0 },
        ],
        { duration: CLOSE_MS, easing: SETTLE, fill: 'forwards' },
      )
      .finished.then(onClose, onClose)
  }, [onClose, prompt.id])

  const details: [string, string][] = [
    [t('promptsPage.detail.model'), PROMPT_MODEL],
    ...(prompt.stack ? [[t('promptsPage.detail.stack'), prompt.stack] as [string, string]] : []),
    ...(prompt.effort ? [[t('promptsPage.detail.effort'), prompt.effort] as [string, string]] : []),
    ...(prompt.rounds ? [[t('promptsPage.detail.rounds'), t(`promptsPage.rounds.${prompt.rounds}`)] as [string, string]] : []),
    ...(prompt.uses ? [[t('promptsPage.detail.uses'), t('promptsPage.uses', { count: prompt.uses })] as [string, string]] : []),
    [t('promptsPage.detail.posted'), new Date(`${prompt.date}T00:00:00`).toLocaleDateString(i18n.language, { year: 'numeric', month: 'short', day: 'numeric' })],
  ]

  return (
    <dialog
      ref={dialog}
      className="pmodal"
      aria-label={t('promptsPage.by', { handle: prompt.handle })}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <div ref={scrim} className="pmodal-scrim" onClick={close} />
      <div ref={panel} className="pmodal-panel">
        <div className="pmodal-stage">
          {preview ? (
            <PreviewPlayer src={preview} poster={poster} />
          ) : poster ? (
            <img src={poster} alt="" />
          ) : (
            <span className="promptcard-fallback" />
          )}
        </div>
        <div ref={side} className="pmodal-side">
          <header className="pmodal-head">
            <span className="pmodal-avatar" aria-hidden="true">
              {prompt.handle.replace(/^_+/, '').charAt(0).toUpperCase()}
            </span>
            <span className="pmodal-author">@{prompt.handle}</span>
            {isPostUrl(prompt.postUrl) && (
              <a className="pmodal-post" href={prompt.postUrl} target="_blank" rel="noreferrer">
                {t('promptsPage.viewPost')}
                <ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </a>
            )}
            <button type="button" className="icon-button" onClick={close} aria-label={t('studio.close')}>
              <X size={16} strokeWidth={1.75} />
            </button>
          </header>
          <section className="pmodal-prompt">
            <div className="pmodal-label">
              <h2>{t('promptsPage.promptLabel')}</h2>
              <button type="button" className={`pmodal-copy${copied ? ' is-on' : ''}`} data-autofocus onClick={copy}>
                {copied ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={1.75} aria-hidden="true" />}
                {t(copied ? 'promptsPage.copied' : 'promptsPage.copyShort')}
              </button>
            </div>
            {/* Üye olmayan prompt'un yalnızca başını görür: kırpılı, seçilemez; tamamı ve kopyalama üyelikle. */}
            <pre className={`pmodal-text${guest ? ' is-clipped is-locked' : long && !expanded ? ' is-clipped' : ''}`}>{guest ? prompt.prompt.slice(0, GUEST_CHARS) : prompt.prompt}</pre>
            {guest ? (
              <div className="pmodal-gate">
                <p>{t('promptsPage.memberOnly')}</p>
                <button type="button" className="primary" onClick={copy}>
                  {t('promptsPage.signUp')}
                </button>
              </div>
            ) : (
              long && (
                <button type="button" className="pmodal-more" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>
                  {t(expanded ? 'promptsPage.showLess' : 'promptsPage.showAll')}
                </button>
              )
            )}
          </section>
          <dl className="pmodal-details">
            {details.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </dialog>
  )
}
