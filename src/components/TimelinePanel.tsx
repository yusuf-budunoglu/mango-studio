import { Timeline } from '@xzdarcy/react-timeline-editor'
import type { TimelineEditor, TimelineState } from '@xzdarcy/react-timeline-editor'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { MoveHorizontal } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { PRESETS } from '../engine/presets'
import type { Layer } from '../engine/types'
import { easingLabel, presetLabel } from '../i18n/labels'
import { findAudio, findBlock, useProjectStore, usePlaybackStore } from '../store/projectStore'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { TrackList, type AudioTrackRow } from './TrackList'
import { Waveform } from './Waveform'

type TimelineRow = TimelineEditor['editorData'][number]

const ROW_HEIGHT = 34
const START_LEFT = 16
const ZOOM_MIN = 40
const ZOOM_MAX = 480
const LANE_SEP = '::'
const trackIdOf = (rowId: string) => rowId.split(LANE_SEP)[0]

/** Çakışmayan blokları aynı şeride koyar, çakışanlar için yeni şerit açar. */
function splitIntoLanes<T extends { start: number; duration: number }>(blocks: T[]): T[][] {
  const lanes: T[][] = []
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

const AUDIO_EFFECT = 'audio'
const EFFECTS = Object.fromEntries([...Object.keys(PRESETS), AUDIO_EFFECT].map((id) => [id, { id }]))

interface Props {
  timelineRef: RefObject<TimelineState | null>
}

export function TimelinePanel({ timelineRef }: Props) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const selectedBlockIds = useProjectStore((s) => s.selectedBlockIds)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const selectTrack = useProjectStore((s) => s.selectTrack)
  const selectBlock = useProjectStore((s) => s.selectBlock)
  const setBlockTimes = useProjectStore((s) => s.setBlockTimes)
  const setTime = usePlaybackStore((s) => s.setTime)
  const setPlaying = usePlaybackStore((s) => s.setPlaying)

  const namesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Timeline yakınlaştırma: 1 saniyenin kaç piksel olduğu.
  const [scaleWidth, setScaleWidth] = useState(120)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const zoom = (factor: number) => setScaleWidth((w) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(w * factor))))
  const zoomToFit = () => {
    const width = wrapRef.current?.clientWidth ?? 800
    setScaleWidth(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.floor((width - START_LEFT - 32) / project.duration))))
  }

  const tracks = useMemo(() => [...project.layers, project.camera], [project])
  const trackLanes = useMemo(() => tracks.map((track) => ({ track, lanes: splitIntoLanes(track.blocks) })), [tracks])
  const audioLanes = useMemo(() => splitIntoLanes(project.audio ?? []), [project.audio])
  const audioTrack: AudioTrackRow = { id: 'audio', name: t('tracks.audio') }

  // Proje verisi → timeline'ın beklediği satır/aksiyon formatı. Her blok bir aksiyon;
  // bir katmanın çakışan blokları alt alta ayrı satırlara (şeritlere) dağıtılır.
  const editorData: TimelineRow[] = useMemo(
    () =>
      trackLanes.flatMap(({ track, lanes }) => {
        const locked = 'locked' in track && !!track.locked
        const hidden = 'hidden' in track && !!track.hidden
        return lanes.map((blocks, lane) => ({
          id: `${track.id}${LANE_SEP}${lane}`,
          selected: track.id === selectedTrackId,
          classNames: hidden ? ['is-hidden'] : [],
          actions: blocks.map((b) => ({
            id: b.id,
            start: b.start,
            end: b.start + b.duration,
            // Bloklar videonun bitişinden öteye sürüklenemez (eski projelerde taşan blok bozulmasın diye onun sonu da kabul).
            maxEnd: Math.max(project.duration, b.start + b.duration),
            // Kilitli katmanın blokları taşınamaz ve uzatılamaz.
            movable: !locked,
            flexible: !locked,
            effectId: b.preset,
            selected: selectedBlockIds.includes(b.id),
          })),
        }))
      }),
    [trackLanes, selectedBlockIds, selectedTrackId, project.duration],
  )

  // Ses parçaları ayrı satırlarda; kaynak dosyanın dışına kırpılamaz, videonun sonunu geçemez.
  const audioData: TimelineRow[] = useMemo(
    () =>
      audioLanes.map((clips, lane) => ({
        id: `audio${LANE_SEP}${lane}`,
        selected: selectedTrackId === 'audio',
        actions: clips.map((c) => ({
          id: c.id,
          start: c.start,
          end: c.start + c.duration,
          minStart: Math.max(0, c.start - c.offset),
          maxEnd: Math.max(c.start + c.duration, Math.min(project.duration, c.start + (c.sourceDuration - c.offset))),
          effectId: AUDIO_EFFECT,
          selected: selectedBlockIds.includes(c.id),
        })),
      })),
    [audioLanes, selectedBlockIds, selectedTrackId, project.duration],
  )
  // Aynı dizi referansı kalmalı: timeline motoru verisi her değiştiğinde oynatmayı durdurur.
  const allRows = useMemo(() => (audioData.length ? [...editorData, ...audioData] : editorData), [editorData, audioData])

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

  // Zaman başka bir yerden değişirse (dışa aktarma bitişi, süre kısaltma, kısayollar) timeline'daki
  // oynatma kafası da oraya gitsin. Timeline'ın kendi değişiklikleri aynı değeri geri yazdığı için döngü olmaz.
  useEffect(() => {
    const sync = (time: number) => {
      const tl = timelineRef.current
      if (tl && !tl.isPlaying && Math.abs(tl.getTime() - time) > 1e-4) tl.setTime(time)
    }
    sync(usePlaybackStore.getState().time)
    return usePlaybackStore.subscribe((s, prev) => {
      if (s.time !== prev.time) sync(s.time)
    })
  }, [timelineRef])

  // Proje kısaltılınca oynatma kafası videonun dışında kalmasın.
  useEffect(() => {
    const playback = usePlaybackStore.getState()
    if (playback.time > project.duration) playback.setTime(project.duration)
  }, [project.duration])

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

  const layerMenu = (layer: Layer, e: MouseEvent) => {
    e.preventDefault()
    selectTrack(layer.id)
    const store = useProjectStore.getState()
    const index = project.layers.findIndex((l) => l.id === layer.id)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t('tracks.rename'), onSelect: () => setRenamingId(layer.id) },
        { label: t('tracks.duplicate'), onSelect: () => store.duplicateLayer(layer.id) },
        { label: layer.hidden ? t('tracks.show') : t('tracks.hide'), onSelect: () => store.updateLayer(layer.id, { hidden: !layer.hidden }) },
        { label: layer.locked ? t('tracks.unlock') : t('tracks.lock'), onSelect: () => store.updateLayer(layer.id, { locked: !layer.locked }) },
        { kind: 'separator' },
        { label: t('tracks.moveUp'), disabled: index <= 0, onSelect: () => store.moveLayer(layer.id, index - 1) },
        { label: t('tracks.moveDown'), disabled: index >= project.layers.length - 1, onSelect: () => store.moveLayer(layer.id, index + 1) },
        { kind: 'separator' },
        { label: t('layer.delete'), danger: true, onSelect: () => store.removeLayer(layer.id) },
      ],
    })
  }

  const blockMenu = (blockId: string, e: MouseEvent) => {
    e.preventDefault()
    const store = useProjectStore.getState()
    // Seçimin dışındaki bloğa sağ tıklanınca sadece o blok seçilir.
    if (!store.selectedBlockIds.includes(blockId)) store.selectBlock(blockId)
    const ids = useProjectStore.getState().selectedBlockIds
    const time = usePlaybackStore.getState().time
    const canSplit = ids.some((id) => {
      const b = findBlock(project, id)?.block ?? findAudio(project, id)
      return !!b && time > b.start + 0.01 && time < b.start + b.duration - 0.01
    })
    const found = findBlock(project, blockId)
    if (!found) {
      if (!findAudio(project, blockId)) return
      setMenu({
        x: e.clientX,
        y: e.clientY,
        items: [
          { label: t('blockMenu.duplicate'), hint: 'Ctrl+D', onSelect: () => store.duplicateBlocks(ids) },
          { label: t('blockMenu.split'), hint: 'S', disabled: !canSplit, onSelect: () => store.splitBlocks(ids, time) },
          { kind: 'separator' },
          { label: t('block.delete', { count: ids.length }), hint: 'Del', danger: true, onSelect: () => store.removeBlocks(ids) },
        ],
      })
      return
    }
    const isCamera = PRESETS[found.block.preset]?.target === 'camera'
    const targets = isCamera ? [] : project.layers.filter((l) => l.id !== found.track.id)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t('blockMenu.duplicate'), hint: 'Ctrl+D', onSelect: () => store.duplicateBlocks(ids) },
        { label: t('blockMenu.split'), hint: 'S', disabled: !canSplit, onSelect: () => store.splitBlocks(ids, time) },
        ...(targets.length
          ? ([
              { kind: 'separator' },
              { kind: 'heading', label: t('blockMenu.moveTo') },
              ...targets.map((l) => ({ label: l.name, onSelect: () => store.moveBlockToTrack(blockId, l.id) })),
            ] satisfies MenuItem[])
          : []),
        { kind: 'separator' },
        { label: t('block.delete', { count: ids.length }), hint: 'Del', danger: true, onSelect: () => store.removeBlocks(ids) },
      ],
    })
  }

  return (
    <div className="timeline-panel" ref={panelRef}>
      <div className="zoom-controls">
        <button type="button" onClick={() => zoom(1 / 1.25)} title={t('timeline.zoomOut')} aria-label={t('timeline.zoomOut')}>
          −
        </button>
        <button type="button" onClick={() => zoom(1.25)} title={t('timeline.zoomIn')} aria-label={t('timeline.zoomIn')}>
          +
        </button>
        <button type="button" onClick={zoomToFit} title={t('timeline.fit')} aria-label={t('timeline.fit')}>
          <MoveHorizontal size={13} strokeWidth={1.75} />
        </button>
      </div>
      <TrackList
        rows={[
          ...trackLanes.map(({ track, lanes }) => ({ track, lanes: lanes.length })),
          ...(project.audio?.length ? [{ track: audioTrack, lanes: audioLanes.length }] : []),
        ]}
        rowHeight={ROW_HEIGHT}
        containerRef={namesRef}
        onContextMenu={layerMenu}
        renamingId={renamingId}
        onRenameStart={setRenamingId}
        onRenameEnd={() => setRenamingId(null)}
      />
      <div className="timeline-wrap" ref={wrapRef}>
        <Timeline
          ref={timelineRef}
          editorData={allRows}
          effects={EFFECTS}
          scale={1}
          scaleSplitCount={10}
          scaleWidth={scaleWidth}
          startLeft={START_LEFT}
          rowHeight={ROW_HEIGHT}
          minScaleCount={Math.ceil(project.duration) + 1}
          gridSnap
          dragLine
          autoScroll
          onScroll={({ scrollTop, scrollLeft: left }) => {
            if (namesRef.current) namesRef.current.scrollTop = scrollTop
            setScrollLeft(left)
          }}
          style={{ width: '100%', height: '100%' }}
          onChange={(rows) => {
            const times: Record<string, { start: number; end: number }> = {}
            for (const row of rows) for (const a of row.actions) times[a.id] = { start: a.start, end: a.end }
            setBlockTimes(times)
            if (project.audio?.length) useProjectStore.getState().setAudioTimes(times)
          }}
          onClickActionOnly={(e, { action, row }) => {
            selectBlock(action.id, e.shiftKey || e.ctrlKey || e.metaKey)
            selectTrack(trackIdOf(row.id))
          }}
          onClickRow={(_e, { row }) => selectTrack(trackIdOf(row.id))}
          onContextMenuAction={(e, { action }) => blockMenu(action.id, e)}
          getActionRender={(action) => {
            if (action.effectId === AUDIO_EFFECT) {
              const clip = findAudio(project, action.id)
              if (!clip) return null
              return (
                <div className={`block block--audio ${action.selected ? 'is-selected' : ''}`}>
                  <Waveform asset={clip.asset} offset={clip.offset} duration={clip.duration} sourceDuration={clip.sourceDuration} />
                  <span className="block-name">{clip.name}</span>
                </div>
              )
            }
            const found = findBlock(project, action.id)
            const preset = PRESETS[action.effectId]
            const easing = found?.block.easing ?? preset?.defaultEasing
            return (
              <div className={`block block--${preset?.category ?? 'x'} ${action.selected ? 'is-selected' : ''} ${action.movable === false ? 'is-locked' : ''}`}>
                <span className="block-name">{presetLabel(action.effectId)}</span>
                <span className="block-easing">{easing ? easingLabel(easing) : ''}</span>
              </div>
            )
          }}
        />
        {/* Videonun bitişi: sonrası gölgeli, çıktıya girmez. */}
        <div className="timeline-end" style={{ left: START_LEFT + project.duration * scaleWidth - scrollLeft }} aria-hidden="true">
          <span>{t('timeline.end')}</span>
        </div>
      </div>
      {menu && <ContextMenu x={menu.x} y={menu.y} items={menu.items} onClose={closeMenu} />}
    </div>
  )
}
