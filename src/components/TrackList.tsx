import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Box, Eye, EyeOff, GripVertical, Image, Lock, LockOpen, Smartphone, Type, Video, type LucideIcon } from 'lucide-react'
import { useState, type MouseEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { CameraTrack, Layer, LayerKind } from '../engine/types'
import { useProjectStore } from '../store/projectStore'

const KIND_ICON: Record<LayerKind, LucideIcon> = { text: Type, phone: Smartphone, image: Image, shape: Box }

export interface TrackRow {
  track: Layer | CameraTrack
  /** timeline'da kaç satır (şerit) kapladığı */
  lanes: number
}

interface Props {
  rows: TrackRow[]
  rowHeight: number
  containerRef: RefObject<HTMLDivElement | null>
  onContextMenu: (track: Layer, e: MouseEvent) => void
  renamingId: string | null
  onRenameEnd: () => void
  onRenameStart: (id: string) => void
}

function NameEditor({ layer, onDone }: { layer: Layer; onDone: () => void }) {
  const [value, setValue] = useState(layer.name)
  const commit = () => {
    const name = value.trim()
    if (name && name !== layer.name) useProjectStore.getState().updateLayer(layer.id, { name })
    onDone()
  }
  return (
    <input
      id={`rename-${layer.id}`}
      className="track-rename"
      value={value}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') onDone()
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function LayerRow({ layer, height, onContextMenu, renaming, onRenameStart, onRenameEnd }: {
  layer: Layer
  height: number
  onContextMenu: Props['onContextMenu']
  renaming: boolean
  onRenameStart: () => void
  onRenameEnd: () => void
}) {
  const { t } = useTranslation()
  const selected = useProjectStore((s) => s.selectedTrackId === layer.id)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id, disabled: renaming })
  const Icon = KIND_ICON[layer.kind]
  const update = (patch: Partial<Layer>) => useProjectStore.getState().updateLayer(layer.id, patch)

  return (
    <div
      ref={setNodeRef}
      className={`track-name ${selected ? 'is-selected' : ''} ${layer.hidden ? 'is-hidden' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={{ height, transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined, transition }}
      onClick={() => useProjectStore.getState().selectTrack(layer.id)}
      onDoubleClick={onRenameStart}
      onContextMenu={(e) => onContextMenu(layer, e)}
    >
      <button type="button" className="track-grip" {...attributes} {...listeners} aria-label={t('tracks.reorder')} title={t('tracks.reorder')}>
        <GripVertical size={13} strokeWidth={1.75} />
      </button>
      <Icon size={13} strokeWidth={1.75} className="track-kind" aria-hidden="true" />
      {renaming ? <NameEditor layer={layer} onDone={onRenameEnd} /> : <span className="track-label" title={layer.name}>{layer.name}</span>}
      <button
        type="button"
        className={`track-toggle ${layer.hidden ? 'is-on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          update({ hidden: !layer.hidden })
        }}
        aria-pressed={!!layer.hidden}
        aria-label={layer.hidden ? t('tracks.show') : t('tracks.hide')}
        title={layer.hidden ? t('tracks.show') : t('tracks.hide')}
      >
        {layer.hidden ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
      </button>
      <button
        type="button"
        className={`track-toggle ${layer.locked ? 'is-on' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          update({ locked: !layer.locked })
        }}
        aria-pressed={!!layer.locked}
        aria-label={layer.locked ? t('tracks.unlock') : t('tracks.lock')}
        title={layer.locked ? t('tracks.unlock') : t('tracks.lock')}
      >
        {layer.locked ? <Lock size={13} strokeWidth={1.75} /> : <LockOpen size={13} strokeWidth={1.75} />}
      </button>
    </div>
  )
}

/** Timeline'ın sol sütunu: katman adları. Sürükleyerek sıralanır; üstteki katman öndedir. */
export function TrackList({ rows, rowHeight, containerRef, onContextMenu, renamingId, onRenameStart, onRenameEnd }: Props) {
  const { t } = useTranslation()
  const cameraSelected = useProjectStore((s) => s.selectedTrackId === 'camera')
  // 4 px hareket etmeden sürükleme başlamasın; tıklama ve çift tıklama bozulmasın.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const layerRows = rows.filter((r): r is TrackRow & { track: Layer } => r.track.id !== 'camera')
  const cameraRow = rows.find((r) => r.track.id === 'camera')

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const to = layerRows.findIndex((r) => r.track.id === over.id)
    useProjectStore.getState().moveLayer(String(active.id), to)
  }

  return (
    <div className="track-names" ref={containerRef}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={layerRows.map((r) => r.track.id)} strategy={verticalListSortingStrategy}>
          {layerRows.map(({ track, lanes }) => (
            <LayerRow
              key={track.id}
              layer={track}
              height={rowHeight * lanes}
              onContextMenu={onContextMenu}
              renaming={renamingId === track.id}
              onRenameStart={() => onRenameStart(track.id)}
              onRenameEnd={onRenameEnd}
            />
          ))}
        </SortableContext>
      </DndContext>
      {cameraRow && (
        <div
          className={`track-name track-name--camera ${cameraSelected ? 'is-selected' : ''}`}
          style={{ height: rowHeight * cameraRow.lanes }}
          onClick={() => useProjectStore.getState().selectTrack('camera')}
        >
          <span className="track-grip" aria-hidden="true" />
          <Video size={13} strokeWidth={1.75} className="track-kind" aria-hidden="true" />
          <span className="track-label">{cameraRow.track.name || t('layer.defaults.camera')}</span>
        </div>
      )}
    </div>
  )
}
