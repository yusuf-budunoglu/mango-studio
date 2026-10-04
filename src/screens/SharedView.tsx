import { Copy, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { attachAudioPreview } from '../audio/engine'
import { supabase } from '../cloud/client'
import { Stage } from '../components/Stage'
import { isDesign } from '../engine/design'
import { AppShell } from '../layout/AppShell'
import { setAssetOverride } from '../persistence/assets'
import { copySharedToStudio, loadShared, type SharedProject } from '../project/sharing'
import { navigate, routeToPath } from '../router'
import { rememberNext } from '../store/afterSignIn'
import { useAuthStore } from '../store/authStore'
import { useEditorStore } from '../store/editorStore'
import { usePlaybackStore, useProjectStore } from '../store/projectStore'

/** Önizleme sahnesini kendi saatiyle oynatır (editördeki timeline yok); sonda başa sarar. */
function usePlayer(duration: number, enabled: boolean) {
  const playing = usePlaybackStore((s) => s.isPlaying)
  useEffect(() => {
    if (!enabled || !playing) return
    let frame = 0
    let last = performance.now()
    const tick = (now: number) => {
      const { time, setTime } = usePlaybackStore.getState()
      const next = time + (now - last) / 1000
      last = now
      setTime(next >= duration ? 0 : next)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [duration, enabled, playing])
  return playing
}

/**
 * Bağlantıyla paylaşılan proje (`/s/<id>`): üye olmayan da izler. Dosyalar sahibinin deposundan salt okunur
 * gelir. Üye "Studio'ma kopyala" ile kendi kopyasını alır; üye olmayan önce üye olur (sonra buraya döner).
 */
export function SharedView({ shareId }: { shareId: string }) {
  const { t } = useTranslation()
  const guest = useAuthStore((s) => !!supabase && s.status === 'out')
  const [shared, setShared] = useState<SharedProject | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [copying, setCopying] = useState(false)
  const [time, setTime] = useState(0)
  const duration = shared?.project.duration ?? 0
  const playing = usePlayer(duration, state === 'ready' && !!shared && !isDesign(shared.project))

  useEffect(() => {
    let alive = true
    const previousOverscan = useEditorStore.getState().showOverscan
    void loadShared(shareId)
      .then((result) => {
        if (!alive) return
        if (!result) {
          setState('missing')
          return
        }
        setAssetOverride(result.assetStore)
        useProjectStore.getState().loadProject(result.project)
        useProjectStore.getState().selectTrack('')
        usePlaybackStore.getState().setTime(isDesign(result.project) ? 0 : Math.min(result.project.duration * 0.3, 2))
        useEditorStore.setState({ showOverscan: false })
        setShared(result)
        setState('ready')
      })
      .catch(() => alive && setState('missing'))
    const detachAudio = attachAudioPreview()
    const offTime = usePlaybackStore.subscribe((s) => setTime(s.time))
    return () => {
      alive = false
      detachAudio()
      offTime()
      usePlaybackStore.getState().setPlaying(false)
      useEditorStore.setState({ showOverscan: previousOverscan })
      setAssetOverride(undefined)
    }
  }, [shareId])

  const copy = async () => {
    if (!shared) return
    if (guest) {
      rememberNext(routeToPath({ screen: 'shared', shareId }))
      navigate({ screen: 'signup' })
      return
    }
    setCopying(true)
    usePlaybackStore.getState().setPlaying(false)
    try {
      const id = await copySharedToStudio(shared)
      navigate({ screen: 'editor', projectId: id })
    } finally {
      setCopying(false)
    }
  }

  const togglePlay = () => {
    const playback = usePlaybackStore.getState()
    playback.setPlaying(!playback.isPlaying)
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  const design = shared ? isDesign(shared.project) : false

  return (
    <AppShell current={{ screen: 'shared', shareId }} title={shared?.name ?? t('shared.title')} bare={guest}>
      {state === 'missing' ? (
        <div className="soon">
          <h2>{t('shared.missing')}</h2>
          <p>{t('shared.missingBody')}</p>
          <a className="button-primary" href={routeToPath({ screen: 'home' })}>
            {t('shared.explore')}
          </a>
        </div>
      ) : state === 'loading' || !shared ? (
        <p className="hint shared-loading">{t('studio.loading')}</p>
      ) : (
        <div className="shared">
          <header className="shared-head">
            <div>
              <p className="shared-kicker">{t(shared.isTemplate ? 'shared.kickerTemplate' : 'shared.kicker')}</p>
              <h1>{shared.name}</h1>
              <p className="shared-meta">
                {shared.project.width} × {shared.project.height}
                {!design && ` · ${fmt(duration)}`}
              </p>
            </div>
            <button type="button" className="primary shared-copy" onClick={() => void copy()} disabled={copying}>
              <Copy size={14} strokeWidth={2} aria-hidden="true" />
              {copying ? t('shared.copying') : guest ? t('shared.signUpToCopy') : t('shared.copy')}
            </button>
          </header>

          <div className="shared-stage" style={{ aspectRatio: `${shared.project.width} / ${shared.project.height}`, ['--shared-ratio' as string]: shared.project.width / shared.project.height }}>
            <Stage />
          </div>

          {!design && (
            <div className="shared-controls">
              <button type="button" className="shared-play" onClick={togglePlay} aria-label={t(playing ? 'templatePreview.pause' : 'templatePreview.play')}>
                {playing ? <Pause size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
              </button>
              <button type="button" className="icon-button" onClick={() => usePlaybackStore.getState().setTime(0)} aria-label={t('editor.rewind')}>
                <RotateCcw size={14} strokeWidth={1.75} />
              </button>
              <input
                className="shared-scrub"
                type="range"
                min={0}
                max={duration}
                step={1 / 60}
                value={Math.min(time, duration)}
                aria-label={t('shared.position')}
                onChange={(e) => usePlaybackStore.getState().setTime(Number(e.target.value))}
              />
              <span className="shared-time">
                {fmt(time)} / {fmt(duration)}
              </span>
            </div>
          )}
          <p className="shared-note">{t('shared.note')}</p>
        </div>
      )}
    </AppShell>
  )
}
