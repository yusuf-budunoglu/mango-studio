import type { TimelineState } from '@xzdarcy/react-timeline-editor'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { ExportButton } from './components/ExportButton'
import { Inspector } from './components/Inspector'
import { Stage } from './components/Stage'
import { TimelinePanel } from './components/TimelinePanel'
import { useProjectStore, usePlaybackStore } from './store/projectStore'

function TimeDisplay({ duration }: { duration: number }) {
  const time = usePlaybackStore((s) => s.time)
  return (
    <span className="time">
      {time.toFixed(2)} <span>/ {duration.toFixed(2)} sn</span>
    </span>
  )
}

export default function App() {
  const timelineRef = useRef<TimelineState>(null)
  const [selectedTrackId, setSelectedTrackId] = useState('l-title')
  const project = useProjectStore((s) => s.project)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)
  const { undo, redo } = useProjectStore.temporal.getState()

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

  const rewind = () => {
    timelineRef.current?.pause()
    timelineRef.current?.setTime(0)
  }

  // Klavye kısayolları: boşluk = oynat/durdur, Ctrl+Z / Ctrl+Y = geri al / yinele, Delete = bloğu sil
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, select, textarea')) return
      const mod = e.ctrlKey || e.metaKey
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) useProjectStore.temporal.getState().redo()
        else useProjectStore.temporal.getState().undo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useProjectStore.temporal.getState().redo()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = useProjectStore.getState().selectedBlockId
        if (id) useProjectStore.getState().removeBlock(id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          motion<span>studio</span>
        </div>
        <div className="project-name">{project.name}</div>
        <div className="controls">
          <button type="button" onClick={() => undo()} disabled={!canUndo} title="Geri al (Ctrl+Z)">
            ↶ Geri al
          </button>
          <button type="button" onClick={() => redo()} disabled={!canRedo} title="Yinele (Ctrl+Y)">
            ↷ Yinele
          </button>
          <ExportButton beforeExport={() => timelineRef.current?.pause()} />
        </div>
      </header>

      <main className="workspace">
        <div className="stage-wrap">
          <Stage />
          <div className="transport">
            <button type="button" onClick={rewind} title="Başa sar">
              ⏮
            </button>
            <button type="button" className="play" onClick={togglePlay} title="Oynat / durdur (boşluk)">
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
