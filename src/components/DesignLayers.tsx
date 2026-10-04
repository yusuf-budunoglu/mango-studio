import { ChevronDown, ChevronUp, Eye, EyeOff, Lock, LockOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { Layer } from '../engine/types'
import { useProjectStore } from '../store/projectStore'
import { KIND_ICON } from './kindIcons'

/**
 * Tasarım modunun katman listesi (timeline olmadığı için): üstteki katman önde. Tıklayınca seçer;
 * göz / kilit, öne-arkaya taşıma. Silme ve çoğaltma editörün kısayollarıyla (Delete, Ctrl+D).
 */
export function DesignLayers() {
  const { t } = useTranslation()
  const layers = useProjectStore((s) => s.project.layers)
  const selected = useProjectStore((s) => s.selectedTrackId)
  const update = (layer: Layer, patch: Partial<Layer>) => useProjectStore.getState().updateLayer(layer.id, patch)
  const move = (layer: Layer, to: number) => useProjectStore.getState().moveLayer(layer.id, to)

  return (
    <section className="dlayers" aria-label={t('design.layers')}>
      <h2>{t('design.layers')}</h2>
      {layers.length === 0 ? (
        <p className="hint">{t('design.noLayers')}</p>
      ) : (
        <ul>
          {layers.map((layer, i) => {
            const Icon = KIND_ICON[layer.kind]
            return (
              <li key={layer.id} className={`dlayer${selected === layer.id ? ' is-selected' : ''}${layer.hidden ? ' is-hidden' : ''}`}>
                <button
                  type="button"
                  className="dlayer-name"
                  aria-pressed={selected === layer.id}
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
                  <button type="button" disabled={i === 0} onClick={() => move(layer, i - 1)} aria-label={t('design.forward', { name: layer.name })} title={t('design.forward', { name: layer.name })}>
                    <ChevronUp size={13} strokeWidth={1.75} />
                  </button>
                  <button type="button" disabled={i === layers.length - 1} onClick={() => move(layer, i + 1)} aria-label={t('design.backward', { name: layer.name })} title={t('design.backward', { name: layer.name })}>
                    <ChevronDown size={13} strokeWidth={1.75} />
                  </button>
                  <button type="button" className={layer.hidden ? 'is-on' : ''} aria-pressed={!!layer.hidden} onClick={() => update(layer, { hidden: !layer.hidden })} aria-label={layer.hidden ? t('tracks.show') : t('tracks.hide')} title={layer.hidden ? t('tracks.show') : t('tracks.hide')}>
                    {layer.hidden ? <EyeOff size={13} strokeWidth={1.75} /> : <Eye size={13} strokeWidth={1.75} />}
                  </button>
                  <button type="button" className={layer.locked ? 'is-on' : ''} aria-pressed={!!layer.locked} onClick={() => update(layer, { locked: !layer.locked })} aria-label={layer.locked ? t('tracks.unlock') : t('tracks.lock')} title={layer.locked ? t('tracks.unlock') : t('tracks.lock')}>
                    {layer.locked ? <Lock size={13} strokeWidth={1.75} /> : <LockOpen size={13} strokeWidth={1.75} />}
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
