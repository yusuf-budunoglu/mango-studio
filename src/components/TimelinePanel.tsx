import { Timeline } from '@xzdarcy/react-timeline-editor'
import type { TimelineEditor, TimelineState } from '@xzdarcy/react-timeline-editor'
import '@xzdarcy/react-timeline-editor/dist/react-timeline-editor.css'
import { Copy, MoveHorizontal, Redo2, Scissors, Trash2, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { canSplit, deleteSelection, duplicateSelection, splitSelection } from '../editor/commands'
import { PRESETS } from '../engine/presets'
import type { Block, Layer } from '../engine/types'
import { easingLabel, presetLabel } from '../i18n/labels'
import { useEditorStore } from '../store/editorStore'
import { findAudio, findBlock, trackOffset, useProjectStore, usePlaybackStore } from '../store/projectStore'
import { ClipBar } from './ClipBar'
import { ContextMenu, type MenuItem } from './ContextMenu'
import { TrackList, type TrackRow } from './TrackList'
import { Waveform } from './Waveform'

type TimelineRow = TimelineEditor['editorData'][number]

/** Satır yükseklikleri: klip satırı belirgin, animasyon şeritleri ince. */
// İnce satırlar: timeline'a kaydırmadan daha çok katman sığar.
const ROW = { clip: 30, lane: 20, camera: 24, audio: 28 }
const START_LEFT = 16
const ZOOM_MIN = 20
const ZOOM_MAX = 480
const LANE_SEP = '::'
const CLIP_PREFIX = 'clip:'
const trackIdOf = (rowId: string) => rowId.split(LANE_SEP)[0]
const EPS = 1e-4

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
const CLIP_EFFECT = 'clip'
const EFFECTS = Object.fromEntries([...Object.keys(PRESETS), AUDIO_EFFECT, CLIP_EFFECT].map((id) => [id, { id }]))

/** Bir satırın bloklarını mutlak (videoya göre) zamanla timeline aksiyonlarına çevirir. */
function blockActions(blocks: Block[], offset: number, selected: string[], locked: boolean, bounds: { min: number; max: number }) {
  return blocks.map((b) => {
    const start = b.start + offset
    const end = start + b.duration
    return {
      id: b.id,
      start,
      end,
      // Katman blokları klibin içinde kalır (eskiden taşmış blok bozulmasın diye kendi sınırı da kabul).
      minStart: Math.min(bounds.min, start),
      maxEnd: Math.max(bounds.max, end),
      movable: !locked,
      flexible: !locked,
      effectId: b.preset,
      selected: selected.includes(b.id),
    }
  })
}

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
  const expanded = useEditorStore((s) => s.expandedLayers)
  const setTime = usePlaybackStore((s) => s.setTime)
  const setPlaying = usePlaybackStore((s) => s.setPlaying)
  const time = usePlaybackStore((s) => s.time)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)

  const namesRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  // Timeline yakınlaştırma: 1 saniyenin kaç piksel olduğu.
  const [scaleWidth, setScaleWidth] = useState(100)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])

  const clampZoom = (w: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(w)))
  const zoom = (factor: number) => setScaleWidth((w) => clampZoom(w * factor))
  const zoomToFit = useCallback(() => {
    const width = wrapRef.current?.clientWidth ?? 800
    setScaleWidth(clampZoom((width - START_LEFT - 40) / project.duration))
  }, [project.duration])
  // Proje açılınca tüm video görünsün.
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || !wrapRef.current) return
    fitted.current = true
    zoomToFit()
  }, [zoomToFit])

  const audioLanes = useMemo(() => splitIntoLanes(project.audio ?? []), [project.audio])
  const cameraLanes = useMemo(() => splitIntoLanes(project.camera.blocks), [project.camera.blocks])
  const layerLanes = useMemo(
    () => project.layers.map((layer) => ({ layer, lanes: expanded.includes(layer.id) ? splitIntoLanes(layer.blocks) : [] })),
    [project.layers, expanded],
  )

  // Proje → timeline satırları. Her katman bir klip satırı; açıksa altında animasyon şeritleri.
  // Aynı dizi referansı kalmalı: timeline motoru verisi her değiştiğinde oynatmayı durdurur.
  const rows: TimelineRow[] = useMemo(() => {
    const out: TimelineRow[] = []
    for (const { layer, lanes } of layerLanes) {
      const locked = !!layer.locked
      const end = layer.start + layer.duration
      out.push({
        id: `${layer.id}${LANE_SEP}clip`,
        rowHeight: ROW.clip,
        selected: layer.id === selectedTrackId,
        classNames: ['row-clip', ...(layer.hidden ? ['is-hidden'] : [])],
        actions: [
          {
            id: CLIP_PREFIX + layer.id,
            start: layer.start,
            end,
            minStart: 0,
            maxEnd: Math.max(project.duration, end),
            movable: !locked,
            flexible: !locked,
            effectId: CLIP_EFFECT,
            selected: layer.id === selectedTrackId && !selectedBlockIds.length,
          },
        ],
      })
      lanes.forEach((blocks, i) =>
        out.push({
          id: `${layer.id}${LANE_SEP}${i}`,
          rowHeight: ROW.lane,
          classNames: ['row-lane', ...(layer.hidden ? ['is-hidden'] : [])],
          actions: blockActions(blocks, layer.start, selectedBlockIds, locked, { min: layer.start, max: end }),
        }),
      )
    }
    cameraLanes.forEach((blocks, i) =>
      out.push({
        id: `camera${LANE_SEP}${i}`,
        rowHeight: ROW.camera,
        selected: selectedTrackId === 'camera',
        classNames: ['row-camera'],
        actions: blockActions(blocks, 0, selectedBlockIds, false, { min: 0, max: project.duration }),
      }),
    )
    // Ses parçaları: timeline'da serbestçe taşınır; kaynak dosyanın dışına kırpılamaz (setAudioTimes).
    if (project.audio?.length)
      audioLanes.forEach((clips, i) =>
        out.push({
          id: `audio${LANE_SEP}${i}`,
          rowHeight: ROW.audio,
          selected: selectedTrackId === 'audio',
          actions: clips.map((c) => ({
            id: c.id,
            start: c.start,
            end: c.start + c.duration,
            // Sınırlar taşımayı da kısıtlıyordu (kaynağın başından başlayan parça hiç kıpırdamıyordu); kaynak dışına
            // kırpmayı setAudioTimes engeller.
            minStart: 0,
            maxEnd: Math.max(c.start + c.duration, project.duration),
            effectId: AUDIO_EFFECT,
            selected: selectedBlockIds.includes(c.id),
          })),
        }),
      )
    return out
  }, [layerLanes, cameraLanes, audioLanes, project.audio, project.duration, selectedBlockIds, selectedTrackId])

  const trackRows: TrackRow[] = [
    ...layerLanes.map(({ layer, lanes }) => ({ track: layer, height: ROW.clip, subHeight: lanes.length * ROW.lane })),
    { track: project.camera, height: cameraLanes.length * ROW.camera },
    ...(project.audio?.length ? [{ track: { id: 'audio' as const, name: t('tracks.audio') }, height: audioLanes.length * ROW.audio }] : []),
  ]

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

  // Timeline'ın üst kenarından sürükleyerek yüksekliği değiştir.
  const startResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = useEditorStore.getState().timelineHeight
    const max = window.innerHeight - 240
    const onMove = (ev: PointerEvent) => useEditorStore.getState().setTimelineHeight(Math.min(max, startH - (ev.clientY - startY)))
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const layerMenuItems = (layer: Layer): MenuItem[] => {
    const store = useProjectStore.getState()
    const index = project.layers.findIndex((l) => l.id === layer.id)
    const now = usePlaybackStore.getState().time
    const isExpanded = useEditorStore.getState().expandedLayers.includes(layer.id)
    return [
      { label: isExpanded ? t('clip.collapse') : t('clip.expand'), onSelect: () => useEditorStore.getState().toggleExpanded(layer.id) },
      { label: t('clip.split'), hint: 'S', disabled: !(now > layer.start + 0.05 && now < layer.start + layer.duration - 0.05), onSelect: () => store.splitClip(layer.id, now) },
      { label: t('tracks.duplicate'), hint: 'Ctrl+D', onSelect: () => store.duplicateLayer(layer.id) },
      { label: t('tracks.rename'), onSelect: () => setRenamingId(layer.id) },
      { kind: 'separator' },
      { label: layer.hidden ? t('tracks.show') : t('tracks.hide'), onSelect: () => store.updateLayer(layer.id, { hidden: !layer.hidden }) },
      { label: layer.locked ? t('tracks.unlock') : t('tracks.lock'), onSelect: () => store.updateLayer(layer.id, { locked: !layer.locked }) },
      { kind: 'separator' },
      { label: t('tracks.moveUp'), disabled: index <= 0, onSelect: () => store.moveLayer(layer.id, index - 1) },
      { label: t('tracks.moveDown'), disabled: index >= project.layers.length - 1, onSelect: () => store.moveLayer(layer.id, index + 1) },
      { kind: 'separator' },
      { label: t('layer.delete'), hint: 'Del', danger: true, onSelect: () => store.removeLayer(layer.id) },
    ]
  }

  const layerMenu = (layer: Layer, e: MouseEvent) => {
    e.preventDefault()
    selectTrack(layer.id)
    selectBlock(null)
    setMenu({ x: e.clientX, y: e.clientY, items: layerMenuItems(layer) })
  }

  const blockMenu = (blockId: string, e: MouseEvent) => {
    e.preventDefault()
    const store = useProjectStore.getState()
    // Seçimin dışındaki bloğa sağ tıklanınca sadece o blok seçilir.
    if (!store.selectedBlockIds.includes(blockId)) store.selectBlock(blockId)
    const ids = useProjectStore.getState().selectedBlockIds
    const now = usePlaybackStore.getState().time
    const splittable = ids.some((id) => {
      const found = findBlock(project, id)
      const b = found ? { start: found.block.start + trackOffset(found.track), duration: found.block.duration } : findAudio(project, id)
      return !!b && now > b.start + 0.01 && now < b.start + b.duration - 0.01
    })
    const found = findBlock(project, blockId)
    if (!found && !findAudio(project, blockId)) return
    const isCamera = !!found && PRESETS[found.block.preset]?.target === 'camera'
    const targets = !found || isCamera ? [] : project.layers.filter((l) => l.id !== found.track.id)
    setMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        { label: t('blockMenu.duplicate'), hint: 'Ctrl+D', onSelect: () => store.duplicateBlocks(ids) },
        { label: t('blockMenu.split'), hint: 'S', disabled: !splittable, onSelect: () => store.splitBlocks(ids, now) },
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

  // Timeline'dan gelen değişiklikler: yalnızca gerçekten değişen klip/blok/ses parçaları uygulanır.
  // Önce bloklar (klibin eski başına göre), sonra klipler: taşınan klibin blokları onunla birlikte gider.
  const applyChanges = (changed: TimelineRow[]) => {
    const store = useProjectStore.getState()
    const current = store.project
    const clips: Record<string, { start: number; end: number }> = {}
    const blocks: Record<string, { start: number; end: number }> = {}
    const audio: Record<string, { start: number; end: number }> = {}
    for (const row of changed)
      for (const a of row.actions) {
        if (a.effectId === CLIP_EFFECT) {
          const layer = current.layers.find((l) => CLIP_PREFIX + l.id === a.id)
          if (layer && (Math.abs(a.start - layer.start) > EPS || Math.abs(a.end - layer.start - layer.duration) > EPS)) clips[layer.id] = { start: a.start, end: a.end }
        } else if (a.effectId === AUDIO_EFFECT) {
          audio[a.id] = { start: a.start, end: a.end }
        } else {
          const found = findBlock(current, a.id)
          if (!found) continue
          const start = found.block.start + trackOffset(found.track)
          if (Math.abs(a.start - start) > EPS || Math.abs(a.end - start - found.block.duration) > EPS) blocks[a.id] = { start: a.start, end: a.end }
        }
      }
    if (Object.keys(blocks).length) store.setBlockTimes(blocks)
    if (Object.keys(clips).length) store.setClipTimes(clips)
    if (Object.keys(audio).length && current.audio?.length) store.setAudioTimes(audio)
  }

  const layerOfClip = (actionId: string) => project.layers.find((l) => CLIP_PREFIX + l.id === actionId)
  const hasSelection = !!selectedBlockIds.length || project.layers.some((l) => l.id === selectedTrackId)
  // Oynatma kafası hareket edince "böl" düğmesinin durumu güncellensin.
  const splitEnabled = hasSelection && time >= 0 && canSplit()

  return (
    <div className="timeline-panel" ref={panelRef}>
      <div className="timeline-resizer" onPointerDown={startResize} role="separator" aria-orientation="horizontal" aria-label={t('timeline.resize')} title={t('timeline.resize')} />
      <div className="timeline-toolbar" role="toolbar" aria-label={t('timeline.toolbar')}>
        <button type="button" onClick={() => useProjectStore.temporal.getState().undo()} disabled={!canUndo} title={t('topbar.undoTitle')} aria-label={t('topbar.undo')}>
          <Undo2 size={16} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={() => useProjectStore.temporal.getState().redo()} disabled={!canRedo} title={t('topbar.redoTitle')} aria-label={t('topbar.redo')}>
          <Redo2 size={16} strokeWidth={1.75} />
        </button>
        <span className="tool-sep" />
        <button type="button" onClick={splitSelection} disabled={!splitEnabled} title={`${t('clip.split')} (S)`} aria-label={t('clip.split')}>
          <Scissors size={16} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={duplicateSelection} disabled={!hasSelection} title={`${t('tracks.duplicate')} (Ctrl+D)`} aria-label={t('tracks.duplicate')}>
          <Copy size={16} strokeWidth={1.75} />
        </button>
        <button type="button" onClick={deleteSelection} disabled={!hasSelection} title={`${t('clip.delete')} (Del)`} aria-label={t('clip.delete')}>
          <Trash2 size={16} strokeWidth={1.75} />
        </button>
        <span className="timeline-hint">{t('timeline.hint')}</span>
        <div className="timeline-zoom">
          <button type="button" onClick={() => zoom(1 / 1.25)} title={t('timeline.zoomOut')} aria-label={t('timeline.zoomOut')}>
            <ZoomOut size={16} strokeWidth={1.75} />
          </button>
          <input
            id="timeline-zoom"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            value={scaleWidth}
            onChange={(e) => setScaleWidth(clampZoom(Number(e.target.value)))}
            aria-label={t('timeline.zoom')}
          />
          <button type="button" onClick={() => zoom(1.25)} title={t('timeline.zoomIn')} aria-label={t('timeline.zoomIn')}>
            <ZoomIn size={16} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={zoomToFit} title={t('timeline.fit')} aria-label={t('timeline.fit')}>
            <MoveHorizontal size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <TrackList
        rows={trackRows}
        containerRef={namesRef}
        onContextMenu={layerMenu}
        renamingId={renamingId}
        onRenameStart={setRenamingId}
        onRenameEnd={() => setRenamingId(null)}
      />
      <div className="timeline-wrap" ref={wrapRef}>
        <Timeline
          ref={timelineRef}
          editorData={rows}
          effects={EFFECTS}
          scale={1}
          scaleSplitCount={10}
          scaleWidth={scaleWidth}
          startLeft={START_LEFT}
          rowHeight={ROW.clip}
          minScaleCount={Math.ceil(project.duration) + 1}
          gridSnap
          dragLine
          autoScroll
          onScroll={({ scrollTop, scrollLeft: left }) => {
            if (namesRef.current) namesRef.current.scrollTop = scrollTop
            setScrollLeft(left)
          }}
          style={{ width: '100%', height: '100%' }}
          onChange={applyChanges}
          onClickActionOnly={(e, { action, row }) => {
            if (action.effectId === CLIP_EFFECT) {
              selectBlock(null)
              selectTrack(trackIdOf(row.id))
              return
            }
            selectBlock(action.id, e.shiftKey || e.ctrlKey || e.metaKey)
            selectTrack(trackIdOf(row.id))
          }}
          onDoubleClickAction={(_e, { action }) => {
            const layer = layerOfClip(action.id)
            if (layer) useEditorStore.getState().toggleExpanded(layer.id)
          }}
          onClickRow={(e, { row }) => {
            // Aynı tıklama bloğa da gelir; bloğun seçimini satır tıklaması silmesin.
            if ((e.target as HTMLElement).closest('.timeline-editor-action')) return
            selectBlock(null)
            selectTrack(trackIdOf(row.id))
          }}
          onContextMenuAction={(e, { action }) => {
            const layer = layerOfClip(action.id)
            if (layer) layerMenu(layer, e)
            else blockMenu(action.id, e)
          }}
          getActionRender={(action) => {
            if (action.effectId === CLIP_EFFECT) {
              const layer = layerOfClip(action.id)
              return layer ? <ClipBar layer={layer} selected={!!action.selected} expanded={expanded.includes(layer.id)} /> : null
            }
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
