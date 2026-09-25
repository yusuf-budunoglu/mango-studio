import type { TimelineState } from '@xzdarcy/react-timeline-editor'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { navigate } from '../router'
import { ExportButton } from '../components/ExportButton'
import { Inspector } from '../components/Inspector'
import { LanguageSelect } from '../components/LanguageSelect'
import { Stage } from '../components/Stage'
import { TimelinePanel } from '../components/TimelinePanel'
import { repository } from '../persistence/repository'
import { downloadText, renderThumbnail, safeFileName } from '../persistence/thumbnail'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

type SaveStatus = 'saved' | 'pending' | 'saving' | 'error'

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
    const save = async () => {
      timer = undefined
      setStatus('saving')
      try {
        const project = useProjectStore.getState().project
        await repository.save(project, await renderThumbnail(project))
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
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading')
  const [selectedTrackId, setSelectedTrackId] = useState('')
  const project = useProjectStore((s) => s.project)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)
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
      setSelectedTrackId(loaded.layers[0]?.id ?? 'camera')
      setState('ready')
      // Şablondan yeni açılmış projenin henüz küçük resmi yok; sahne çizildikten sonra üret.
      setTimeout(() => {
        if (!alive) return
        void renderThumbnail(loaded).then((thumb) => {
          if (thumb) void repository.setThumbnail(loaded.id, thumb)
        })
      }, 1500)
    })
    return () => {
      alive = false
    }
  }, [projectId])

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
        store.duplicateBlocks(selected)
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        store.removeBlocks(selected)
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selected.length) {
        handled()
        const step = e.shiftKey ? 1 : 0.1
        store.nudgeBlocks(selected, e.key === 'ArrowLeft' ? -step : step)
      } else if (e.key === 'Escape') {
        store.selectBlock(null)
      } else if (e.key === 'Home') {
        seek(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (state === 'missing') {
    return (
      <div className="home">
        <main className="home-main">
          <p className="home-error">{t('editor.missing')}</p>
          <button type="button" onClick={() => navigate({ screen: 'home' })}>
            {t('topbar.backToProjectsTitle')}
          </button>
        </main>
      </div>
    )
  }
  if (state === 'loading') return <div className="loading">{t('editor.loading')}</div>

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="back" onClick={() => navigate({ screen: 'home' })} title={t('topbar.backToProjectsTitle')}>
          {t('topbar.backToProjects')}
        </button>
        <div className="brand">
          motion<span>studio</span>
        </div>
        <div className="project-name">{project.name}</div>
        <span className={`save-status save-status--${saveStatus}`}>{t(`save.${saveStatus}`)}</span>
        <div className="controls">
          <button type="button" onClick={() => useProjectStore.temporal.getState().undo()} disabled={!canUndo} title={t('topbar.undoTitle')}>
            {t('topbar.undo')}
          </button>
          <button type="button" onClick={() => useProjectStore.temporal.getState().redo()} disabled={!canRedo} title={t('topbar.redoTitle')}>
            {t('topbar.redo')}
          </button>
          <button
            type="button"
            onClick={() => downloadText(`${safeFileName(project.name)}.motion.json`, JSON.stringify(project, null, 2))}
            title={t('topbar.saveToFileTitle')}
          >
            {t('topbar.saveToFile')}
          </button>
          <ExportButton beforeExport={() => timelineRef.current?.pause()} />
          <LanguageSelect />
        </div>
      </header>

      <main className="workspace">
        <div className="stage-wrap">
          <Stage />
          <div className="transport">
            <button type="button" onClick={() => seek(0)} title={t('editor.rewind')}>
              ⏮
            </button>
            <button type="button" className="play" onClick={togglePlay} title={t('editor.playPause')}>
              {isPlaying ? '⏸' : '▶'}
            </button>
            <TimeDisplay duration={project.duration} />
          </div>
        </div>
        <Inspector selectedTrackId={selectedTrackId} onSelectTrack={setSelectedTrackId} />
      </main>

      <TimelinePanel timelineRef={timelineRef} selectedTrackId={selectedTrackId} onSelectTrack={setSelectedTrackId} />
    </div>
  )
}
