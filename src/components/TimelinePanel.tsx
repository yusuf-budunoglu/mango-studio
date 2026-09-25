import { Timeline } from '@xzdarcy/react-timeline-editor'
import type { TimelineEditor, TimelineState } from '@xzdarcy/react-timeline-editor'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { PRESETS } from '../engine/presets'
import { easingLabel, presetLabel } from '../i18n/labels'
import type { Block } from '../engine/types'
import { findBlock, useProjectStore, usePlaybackStore } from '../store/projectStore'

type TimelineRow = TimelineEditor['editorData'][number]

const ROW_HEIGHT = 34
const ZOOM_MIN = 40
const ZOOM_MAX = 480
const LANE_SEP = '::'
const trackIdOf = (rowId: string) => rowId.split(LANE_SEP)[0]

/** Çakışmayan blokları aynı şeride koyar, çakışanlar için yeni şerit açar. */
function splitIntoLanes(blocks: Block[]): Block[][] {
  const lanes: Block[][] = []
  const laneEnds: number[] = []
  for (const b of [...blocks].sort((x, y) => x.start - y.start)) {
    let lane = laneEnds.findIndex((end) => end <= b.start + 1e-6)
    if (lane === -1) {
      lane = lanes.length
      lanes.push([])
    }
    lanes[lane].push(b)
    laneEnds[lane] = b.start + b.duration
  }
  return lanes.length ? lanes : [[]]
}

const EFFECTS = Object.fromEntries(Object.keys(PRESETS).map((id) => [id, { id }]))

interface Props {
  timelineRef: RefObject<TimelineState | null>
  selectedTrackId: string
  onSelectTrack: (id: string) => void
}

export function TimelinePanel({ timelineRef, selectedTrackId, onSelectTrack }: Props) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const selectedBlockIds = useProjectStore((s) => s.selectedBlockIds)
  const selectBlock = useProjectStore((s) => s.selectBlock)
  const setBlockTimes = useProjectStore((s) => s.setBlockTimes)
  const setTime = usePlaybackStore((s) => s.setTime)
  const setPlaying = usePlaybackStore((s) => s.setPlaying)

  const namesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  // Timeline yakınlaştırma: 1 saniyenin kaç piksel olduğu.
  const [scaleWidth, setScaleWidth] = useState(120)
  const zoom = (factor: number) => setScaleWidth((w) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(w * factor))))
  const tracks = useMemo(() => [...project.layers, project.camera], [project])
  const trackLanes = useMemo(() => tracks.map((track) => ({ track, lanes: splitIntoLanes(track.blocks) })), [tracks])

  // Proje verisi → timeline'ın beklediği satır/aksiyon formatı. Her blok bir aksiyon;
  // bir katmanın çakışan blokları alt alta ayrı satırlara (şeritlere) dağıtılır.
  const editorData: TimelineRow[] = useMemo(
    () =>
      trackLanes.flatMap(({ track, lanes }) =>
        lanes.map((blocks, lane) => ({
          id: `${track.id}${LANE_SEP}${lane}`,
          selected: track.id === selectedTrackId,
          actions: blocks.map((b) => ({
            id: b.id,
            start: b.start,
            end: b.start + b.duration,
            effectId: b.preset,
            selected: selectedBlockIds.includes(b.id),
          })),
        })),
      ),
    [trackLanes, selectedBlockIds, selectedTrackId],
  )

  // Timeline kendi saatini çalıştırıyor; zamanı oradan önizlemeye aktarıyoruz.
  useEffect(() => {
    const listener = timelineRef.current?.listener
    if (!listener) return
    const onTime = ({ time }: { time: number }) => setTime(time)
    const onPlay = () => setPlaying(true)
    const onStop = () => setPlaying(false)
    listener.on('setTimeByTick', onTime)
    listener.on('afterSetTime', onTime)
    listener.on('play', onPlay)
    listener.on('paused', onStop)
    listener.on('ended', onStop)
    return () => {
      listener.off('setTimeByTick', onTime)
      listener.off('afterSetTime', onTime)
      listener.off('play', onPlay)
      listener.off('paused', onStop)
      listener.off('ended', onStop)
    }
  }, [timelineRef, setTime, setPlaying])

  // Ctrl + fare tekerleği ile yakınlaştır. React'in onWheel'i pasif olduğu için elle bağlanıyor.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoom(e.deltaY < 0 ? 1.15 : 1 / 1.15)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  return (
    <div className="timeline-panel" ref={panelRef}>
      <div className="zoom-controls">
        <button type="button" onClick={() => zoom(1 / 1.25)} title={t('timeline.zoomOut')} aria-label={t('timeline.zoomOut')}>
          −
        </button>
        <button type="button" onClick={() => zoom(1.25)} title={t('timeline.zoomIn')} aria-label={t('timeline.zoomIn')}>
          +
        </button>
      </div>
      <div className="track-names" ref={namesRef}>
        {trackLanes.map(({ track: t, lanes }) => (
          <button
            key={t.id}
            type="button"
            className={`track-name ${t.id === selectedTrackId ? 'is-selected' : ''}`}
            style={{ height: ROW_HEIGHT * lanes.length }}
            onClick={() => onSelectTrack(t.id)}
          >
            <span className="track-kind">{t.id === 'camera' ? '🎥' : 'kind' in t && t.kind === 'phone' ? '📱' : 'T'}</span>
            {t.name}
          </button>
        ))}
      </div>
      <Timeline
        ref={timelineRef}
        editorData={editorData}
        effects={EFFECTS}
        scale={1}
        scaleSplitCount={10}
        scaleWidth={scaleWidth}
        startLeft={16}
        rowHeight={ROW_HEIGHT}
        minScaleCount={Math.ceil(project.duration) + 1}
        gridSnap
        dragLine
        autoScroll
        onScroll={({ scrollTop }) => {
          if (namesRef.current) namesRef.current.scrollTop = scrollTop
        }}
        style={{ width: '100%', height: '100%' }}
        onChange={(rows) => {
          const times: Record<string, { start: number; end: number }> = {}
          for (const row of rows) for (const a of row.actions) times[a.id] = { start: a.start, end: a.end }
          setBlockTimes(times)
        }}
        onClickActionOnly={(e, { action, row }) => {
          selectBlock(action.id, e.shiftKey || e.ctrlKey || e.metaKey)
          onSelectTrack(trackIdOf(row.id))
        }}
        onClickRow={(_e, { row }) => onSelectTrack(trackIdOf(row.id))}
        getActionRender={(action) => {
          const found = findBlock(project, action.id)
          const preset = PRESETS[action.effectId]
          const easing = found?.block.easing ?? preset?.defaultEasing
          return (
            <div className={`block block--${preset?.category ?? 'x'} ${action.selected ? 'is-selected' : ''}`}>
              <span className="block-name">{presetLabel(action.effectId)}</span>
              <span className="block-easing">{easing ? easingLabel(easing) : ''}</span>
            </div>
          )
        }}
      />
    </div>
  )
}
