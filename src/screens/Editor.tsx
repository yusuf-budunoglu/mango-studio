import type { TimelineState } from '@xzdarcy/react-timeline-editor'
import { useEffect, useRef, useState } from 'react'
import { Grid2x2, Magnet, Move, RotateCw, Scaling, Scan } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { navigate } from '../router'
import { ExportButton } from '../components/ExportButton'
import { LibraryPanel } from '../components/LibraryPanel'
import { PropertiesPanel } from '../components/PropertiesPanel'
import { LanguageSelect } from '../components/LanguageSelect'
import { Stage } from '../components/Stage'
import { TimelinePanel } from '../components/TimelinePanel'
import { attachAudioPreview } from '../audio/engine'
import { deleteSelection, duplicateSelection, splitSelection } from '../editor/commands'
import { NewerProjectVersionError } from '../engine/migrate'
import { projectToFile } from '../persistence/projectFile'
import { repository } from '../persistence/repository'
import { downloadText, renderThumbnail, safeFileName } from '../persistence/thumbnail'
import { useEditorStore, type TransformMode } from '../store/editorStore'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

const TOOLS: { mode: TransformMode; key: string; icon: typeof Move }[] = [
  { mode: 'translate', key: 'move', icon: Move },
  { mode: 'rotate', key: 'rotate', icon: RotateCw },
  { mode: 'scale', key: 'scale', icon: Scaling },
]

/** Önizleme araçları: tutamaç modu, yapışma, güvenli alan kılavuzları. */
function StageTools() {
  const { t } = useTranslation()
  const mode = useEditorStore((s) => s.transformMode)
  const snapping = useEditorStore((s) => s.snapping)
  const showGuides = useEditorStore((s) => s.showGuides)
  const showOverscan = useEditorStore((s) => s.showOverscan)
  const { setTransformMode, toggleSnapping, toggleGuides, toggleOverscan } = useEditorStore.getState()
  return (
    <div className="stage-tools" role="toolbar" aria-label={t('editor.tools.label')}>
      {TOOLS.map(({ mode: m, key, icon: Icon }) => (
        <button key={m} type="button" className={mode === m ? 'is-on' : ''} aria-pressed={mode === m} onClick={() => setTransformMode(m)} title={t(`editor.tools.${key}`)} aria-label={t(`editor.tools.${key}`)}>
          <Icon size={15} strokeWidth={1.75} />
        </button>
      ))}
      <span className="tool-sep" />
      <button type="button" className={snapping ? 'is-on' : ''} aria-pressed={snapping} onClick={toggleSnapping} title={t('editor.tools.snap')} aria-label={t('editor.tools.snap')}>
        <Magnet size={15} strokeWidth={1.75} />
      </button>
      <button type="button" className={showGuides ? 'is-on' : ''} aria-pressed={showGuides} onClick={toggleGuides} title={t('editor.tools.guides')} aria-label={t('editor.tools.guides')}>
        <Grid2x2 size={15} strokeWidth={1.75} />
      </button>
      <button type="button" className={showOverscan ? 'is-on' : ''} aria-pressed={showOverscan} onClick={toggleOverscan} title={t('editor.tools.overscan')} aria-label={t('editor.tools.overscan')}>
        <Scan size={15} strokeWidth={1.75} />
      </button>
    </div>
  )
}

function TimeDisplay({ duration }: { duration: number }) {
  const { t } = useTranslation()
  const time = usePlaybackStore((s) => s.time)
  return (
    <span className="time">
      {time.toFixed(2)} <span>{t('editor.timeOf', { duration: duration.toFixed(2) })}</span>
    </span>
  )
}

/** Proje her değiştiğinde 800 ms sonra kaydeder; ekrandan çıkarken bekleyen kaydı hemen yapar. */
function useAutosave(enabled: boolean) {
  const [status, setStatus] = useState<SaveStatus>('saved')

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // Küçük resim her kayıtta değil, en fazla 20 saniyede bir yenilenir (bir kare çizmek gerekiyor).
    let lastThumbnailAt = Date.now()
    const save = async () => {
      timer = undefined
      setStatus('saving')
      try {
        const project = useProjectStore.getState().project
        let thumbnail: string | undefined
        if (Date.now() - lastThumbnailAt > 20_000) {
          thumbnail = await renderThumbnail(project)
          if (thumbnail) lastThumbnailAt = Date.now()
        }
        await repository.save(project, thumbnail)
        setStatus('saved')
      } catch {
        setStatus('error')
      }
    }
    const unsubscribe = useProjectStore.subscribe((s, prev) => {
      if (s.project === prev.project) return
      setStatus('pending')
      clearTimeout(timer)
      timer = setTimeout(save, 800)
    })
    return () => {
      unsubscribe()
      if (timer) {
        clearTimeout(timer)
        void save()
      }
    }
  }, [enabled])

  return status
}

export function Editor({ projectId }: { projectId: string }) {
  const { t } = useTranslation()
  const timelineRef = useRef<TimelineState>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'newer'>('loading')
  const project = useProjectStore((s) => s.project)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const timelineHeight = useEditorStore((s) => s.timelineHeight)
  const saveStatus = useAutosave(state === 'ready')

  useEffect(() => {
    let alive = true
    void repository.load(projectId).then((loaded) => {
      if (!alive) return
      if (!loaded) {
        setState('missing')
        return
      }
      useProjectStore.getState().loadProject(loaded)
      usePlaybackStore.getState().setTime(0)
      setState('ready')
      // Şablondan yeni açılmış projenin henüz küçük resmi yok; sahne çizildikten sonra üret.
      setTimeout(() => {
        if (!alive) return
        void renderThumbnail(loaded).then((thumb) => {
          if (thumb) void repository.setThumbnail(loaded.id, thumb)
        })
      }, 1500)
    }).catch((err: unknown) => {
      if (alive) setState(err instanceof NewerProjectVersionError ? 'newer' : 'missing')
    })
    return () => {
      alive = false
    }
  }, [projectId])

  // Projelere dönerken kartın küçük resmini son hale getir (kayıt zaten otomatik).
  const leaveToVideos = async () => {
    timelineRef.current?.pause()
    const current = useProjectStore.getState().project
    const thumbnail = await renderThumbnail(current).catch(() => undefined)
    if (thumbnail) await repository.setThumbnail(current.id, thumbnail).catch(() => undefined)
    navigate({ screen: 'videos' })
  }

  const togglePlay = () => {
    const tl = timelineRef.current
    if (!tl) return
    if (tl.isPlaying) {
      tl.pause()
      return
    }
    if (tl.getTime() >= project.duration - 0.01) tl.setTime(0)
    tl.play({ toTime: project.duration, autoEnd: true })
  }

  const seek = (t: number) => {
    timelineRef.current?.pause()
    timelineRef.current?.setTime(t)
  }

  // Timeline oynarken ses parçalarını çal.
  useEffect(() => (state === 'ready' ? attachAudioPreview() : undefined), [state])

  // Klavye kısayolları. Metin kutularındayken devre dışı.
  useEffect(() => {
    if (state !== 'ready') return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, select, textarea')) return
      const store = useProjectStore.getState()
      const history = useProjectStore.temporal.getState()
      const selected = store.selectedBlockIds
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const handled = () => e.preventDefault()

      if (e.code === 'Space') {
        handled()
        togglePlay()
      } else if (mod && key === 'z') {
        handled()
        if (e.shiftKey) history.redo()
        else history.undo()
      } else if (mod && key === 'y') {
        handled()
        history.redo()
      } else if (mod && key === 'c') {
        store.copyBlocks(selected)
      } else if (mod && key === 'v') {
        handled()
        store.pasteBlocks(usePlaybackStore.getState().time)
      } else if (mod && key === 'd') {
        handled()
        duplicateSelection()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        handled()
        deleteSelection()
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selected.length) {
        handled()
        const step = e.shiftKey ? 1 : 0.1
        store.nudgeBlocks(selected, e.key === 'ArrowLeft' ? -step : step)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // Seçili blok yokken oklar oynatma kafasını bir kare (Shift: 1 sn) oynatır.
        handled()
        const step = e.shiftKey ? 1 : 1 / project.fps
        const now = usePlaybackStore.getState().time
        seek(Math.min(project.duration, Math.max(0, now + (e.key === 'ArrowLeft' ? -step : step))))
      } else if (!mod && key === 's') {
        handled()
        splitSelection()
      } else if (!mod && (key === 'w' || key === 'e' || key === 'r')) {
        useEditorStore.getState().setTransformMode(key === 'w' ? 'translate' : key === 'e' ? 'rotate' : 'scale')
      } else if (e.key === 'Escape') {
        store.selectBlock(null)
        store.selectTrack('')
      } else if (e.key === 'Home') {
        seek(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (state === 'missing' || state === 'newer') {
    return (
      <div className="home">
        <main className="home-main">
          <p className="home-error">{state === 'newer' ? t('editor.newer') : t('editor.missing')}</p>
          <button type="button" onClick={() => navigate({ screen: 'home' })}>
            {t('topbar.backToProjectsTitle')}
          </button>
        </main>
      </div>
    )
  }
  if (state === 'loading') return <div className="loading">{t('editor.loading')}</div>

  return (
    <div className="app" style={{ gridTemplateRows: `auto minmax(0, 1fr) ${timelineHeight}px` }}>
      <header className="topbar">
        <button type="button" className="back" onClick={() => void leaveToVideos()} title={t('topbar.backToProjectsTitle')}>
          {t('topbar.backToProjects')}
        </button>
        <div className="brand">
          <img className="brand-logo" src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          Mango <span>Studio</span>
        </div>
        <div className="project-name">{project.name}</div>
        <span className={`save-status save-status--${saveStatus}`}>{t(`save.${saveStatus}`)}</span>
        <div className="controls">
          <button
            type="button"
            onClick={() => void projectToFile(project).then((text) => downloadText(`${safeFileName(project.name)}.motion.json`, text))}
            title={t('topbar.saveToFileTitle')}
          >
            {t('topbar.saveToFile')}
          </button>
          <ExportButton beforeExport={() => timelineRef.current?.pause()} />
          <LanguageSelect />
        </div>
      </header>

      <main className="workspace">
        <LibraryPanel />
        <div className="stage-wrap">
          <Stage />
          <div className="transport">
            <StageTools />
            <button type="button" onClick={() => seek(0)} title={t('editor.rewind')}>
              ⏮
            </button>
            <button type="button" className="play" onClick={togglePlay} title={t('editor.playPause')}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <TimeDisplay duration={project.duration} />
          </div>
        </div>
        <PropertiesPanel />
      </main>

      <TimelinePanel timelineRef={timelineRef} />
    </div>
  )
}
