import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cameraPosition, layerExtent } from '../editor/sceneLink'
import { restackFactor, type Extent } from '../editor/stacking'
import type { Layer, Vec3 } from '../engine/types'
import { useProjectStore } from '../store/projectStore'
import { KIND_ICON } from './kindIcons'

/**
 * Katmanı listede `to` sırasına taşır ve görüntüde de o sıraya getirir: yukarı alınan katman, ekranda üstüne bindiği
 * alttaki katmanların önüne geçecek kadar kameraya yaklaştırılır; aşağı alınan, üstündekilerin arkasına gidecek kadar
 * uzaklaştırılır. Aynı oranda ölçeklendiği için ekrandaki yeri ve boyu değişmez (`editor/stacking.ts`).
 */
function restack(layer: Layer, to: number) {
  const store = useProjectStore.getState()
  const layers = store.project.layers
  const from = layers.findIndex((l) => l.id === layer.id)
  const target = Math.max(0, Math.min(layers.length - 1, to))
  if (from === -1 || from === target) return
  const order = layers.filter((l) => l.id !== layer.id)
  order.splice(target, 0, layer)
  // listede üstte olan önde: yukarı taşınan katman altındakilerin önüne, aşağı taşınan üstündekilerin arkasına
  const direction = target < from ? 'front' : 'back'
  const others = (direction === 'front' ? order.slice(target + 1) : order.slice(0, target)).map((l) => layerExtent(l.id)).filter((e): e is Extent => !!e)
  const self = layerExtent(layer.id)
  const eye = cameraPosition()
  const f = self && eye ? restackFactor(self, others, direction) : 1
  if (!eye || Math.abs(f - 1) < 1e-4) return void store.moveLayer(layer.id, target)
  const position = layer.position.map((v, i) => eye[i] + (v - eye[i]) * f) as Vec3
  store.moveLayer(layer.id, target, { position, scale: layer.scale * f })
}

function Row({ layer, index, count, selected }: { layer: Layer; index: number; count: number; selected: boolean }) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: layer.id })
  const update = (patch: Partial<Layer>) => useProjectStore.getState().updateLayer(layer.id, patch)
  const Icon = KIND_ICON[layer.kind]
  return (
    <li
      ref={setNodeRef}
      className={`dlayer${selected ? ' is-selected' : ''}${layer.hidden ? ' is-hidden' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: transform ? `translate3d(0, ${Math.round(transform.y)}px, 0)` : undefined, transition }}
    >
      {/* Satır adından tutulup sürüklenir; 4 pikselden kısa hareket tıklama sayılır (seçer). */}
      <button
        type="button"
        className="dlayer-name"
        {...attributes}
        {...listeners}
        aria-pressed={selected}
        title={t('design.dragToReorder')}
        onClick={() => {
          const store = useProjectStore.getState()
          store.selectBlock(null)
          store.selectTrack(layer.id)
        }}
      >
        <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
        <span>{layer.name}</span>
      </button>
      <span className="dlayer-tools">
        <button type="button" disabled={index === 0} onClick={() => restack(layer, index - 1)} aria-label={t('design.forward', { name: layer.name })} title={t('design.forward', { name: layer.name })}>
          <ChevronUp size={13} strokeWidth={1.75} />
        </button>
        <button type="button" disabled={index === count - 1} onClick={() => restack(layer, index + 1)} aria-label={t('design.backward', { name: layer.name })} title={t('design.backward', { name: layer.name })}>
          <ChevronDown size={13} strokeWidth={1.75} />
        </button>
        <button type="button" className={layer.hidden ? 'is-on' : ''} aria-pressed={!!layer.hidden} onClick={() => update({ hidden: !layer.hidden })} aria-label={layer.hidden ? t('tracks.show') : t('tracks.hide')} title={layer.hidden ? t('tracks.show') : t('tracks.hide')}>
          {layer.hidden ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
        </button>
        <button type="button" className={layer.locked ? 'is-on' : ''} aria-pressed={!!layer.locked} onClick={() => update({ locked: !layer.locked })} aria-label={layer.locked ? t('tracks.unlock') : t('tracks.lock')} title={layer.locked ? t('tracks.unlock') : t('tracks.lock')}>
          {layer.locked ? <Lock size={13} strokeWidth={1.75} /> : <LockOpen size={13} strokeWidth={1.75} />}
        </button>
      </span>
    </li>
  )
}

/**
 * Tasarım modunun katman listesi (timeline olmadığı için): üstteki katman önde, görüntüde de. Tıklayınca seçer;
 * satır sürüklenerek ya da oklarla sıralanır; göz / kilit. Silme ve çoğaltma editörün kısayollarıyla (Delete, Ctrl+D).
 */
export function DesignLayers() {
  const { t } = useTranslation()
  const layers = useProjectStore((s) => s.project.layers)
  const selected = useProjectStore((s) => s.selectedTrackId)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const layer = layers.find((l) => l.id === active.id)
    const to = layers.findIndex((l) => l.id === over.id)
    if (layer && to !== -1) restack(layer, to)
  }

  return (
    <section className="dlayers" aria-label={t('design.layers')}>
      <h2>{t('design.layers')}</h2>
      {layers.length === 0 ? (
        <p className="hint">{t('design.noLayers')}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={layers.map((l) => l.id)} strategy={verticalListSortingStrategy}>
            <ul>
              {layers.map((layer, i) => (
                <Row key={layer.id} layer={layer} index={i} count={layers.length} selected={selected === layer.id} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  )
}
