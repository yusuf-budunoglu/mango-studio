import { Pencil, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PRESETS, presetsFor, type Preset } from '../engine/presets'
import type { Block, CameraTrack, Layer } from '../engine/types'
import { presetLabel } from '../i18n/labels'
import { trackOffset, useProjectStore, usePlaybackStore } from '../store/projectStore'

const EDGE = 0.05
const round = (t: number) => Math.round(t * 100) / 100

/** Klibin başındaki giriş ya da sonundaki çıkış animasyonu. */
function edgeBlock(layer: Layer, category: 'in' | 'out') {
  return layer.blocks.find((b) =>
    PRESETS[b.preset]?.category === category && (category === 'in' ? Math.abs(b.start) < EDGE : Math.abs(b.start + b.duration - layer.duration) < EDGE),
  )
}

function PresetChips({ presets, active, onPick }: { presets: [string, Preset][]; active?: string; onPick: (id: string) => void }) {
  return (
    <div className="chips">
      {presets.map(([id, p]) => (
        <button key={id} type="button" className={`chip chip--${p.category} ${active === id ? 'is-on' : ''}`} aria-pressed={active === id} onClick={() => onPick(id)}>
          {presetLabel(id)}
        </button>
      ))}
    </div>
  )
}

/** Giriş/çıkış: klibin kenarına yapışık tek animasyon; yenisi seçilince eskisinin yerini alır. */
function EdgeAnimation({ layer, category }: { layer: Layer; category: 'in' | 'out' }) {
  const { t } = useTranslation()
  const store = useProjectStore.getState()
  const current = edgeBlock(layer, category)
  const presets = presetsFor('layer').filter(([, p]) => p.category === category)
  const maxDuration = Math.max(0.1, Math.min(5, layer.duration))

  const pick = (id: string) => {
    if (current?.preset === id) return store.removeBlocks([current.id])
    // Anlık (0 sn'ye yakın) blok değiştirilirken yeni animasyon kendi varsayılan süresini alır.
    if (current) {
      const duration = current.duration < 0.1 ? Math.min(PRESETS[id].defaultDuration, maxDuration) : current.duration
      const start = category === 'in' ? current.start : round(layer.duration - duration)
      return store.updateBlock(current.id, { preset: id, easing: undefined, params: undefined, duration, start })
    }
    const duration = Math.min(PRESETS[id].defaultDuration, maxDuration)
    store.addBlock(layer.id, id, category === 'in' ? layer.start : layer.start + layer.duration - duration)
  }
  const setDuration = (d: number) => {
    if (!current) return
    const duration = round(Math.min(maxDuration, Math.max(0.1, d)))
    store.updateBlock(current.id, category === 'in' ? { duration } : { duration, start: round(layer.duration - duration) })
  }

  return (
    <section className="anim-group">
      <h3>{t(`animation.${category}`)}</h3>
      <div className="chips">
        <button type="button" className={`chip ${current ? '' : 'is-on'}`} aria-pressed={!current} onClick={() => current && store.removeBlocks([current.id])}>
          {t('animation.none')}
        </button>
      </div>
      <PresetChips presets={presets} active={current?.preset} onPick={pick} />
      {current && (
        <div className="slider">
          <label htmlFor={`anim-${category}-duration`}>
            {t('block.duration')} <span>{current.duration.toFixed(1)} s</span>
          </label>
          <input id={`anim-${category}-duration`} type="range" min={0.1} max={maxDuration} step={0.1} value={current.duration} onChange={(e) => setDuration(Number(e.target.value))} />
        </div>
      )}
    </section>
  )
}

/** Bir satırdaki tüm bloklar: tıklayınca ayrıntılı ayarları açılır. */
export function BlockList({ track }: { track: Layer | CameraTrack }) {
  const { t } = useTranslation()
  const offset = trackOffset(track)
  const blocks = [...track.blocks].sort((a, b) => a.start - b.start)
  const open = (b: Block) => {
    const store = useProjectStore.getState()
    store.selectTrack(track.id)
    store.selectBlock(b.id)
    usePlaybackStore.getState().setTime(b.start + offset)
  }
  if (!blocks.length) return <p className="hint">{t('animation.emptyList')}</p>
  return (
    <ul className="block-list">
      {blocks.map((b) => (
        <li key={b.id}>
          <i className={`dot dot--${PRESETS[b.preset]?.category ?? 'x'}`} aria-hidden="true" />
          <button type="button" className="block-list-open" onClick={() => open(b)} title={t('animation.edit')}>
            <span>{presetLabel(b.preset)}</span>
            <span className="block-list-time">
              {(b.start + offset).toFixed(1)}–{(b.start + offset + b.duration).toFixed(1)} s
            </span>
            <Pencil size={13} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button type="button" className="icon-button" onClick={() => useProjectStore.getState().removeBlocks([b.id])} aria-label={t('block.delete', { count: 1 })} title={t('block.delete', { count: 1 })}>
            <X size={14} strokeWidth={1.75} />
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Klibin animasyonları: CapCut'taki gibi giriş / çıkış seçimi, üstüne serbest animasyonlar. */
export function AnimationPanel({ layer }: { layer: Layer }) {
  const { t } = useTranslation()
  const addAtPlayhead = (id: string) => useProjectStore.getState().addBlock(layer.id, id, usePlaybackStore.getState().time)
  const groups = (['emphasis', 'move', ...(layer.kind === 'text' ? ['text'] : [])] as const).map((category) => ({
    category,
    presets: presetsFor('layer').filter(([, p]) => p.category === category && (!p.kinds || p.kinds.includes(layer.kind))),
  }))

  return (
    <>
      <EdgeAnimation layer={layer} category="in" />
      <EdgeAnimation layer={layer} category="out" />
      {groups.map(({ category, presets }) => (
        <section key={category} className="anim-group">
          <h3>{t(`animation.${category}`)}</h3>
          <p className="hint">{t('animation.addHint')}</p>
          <PresetChips presets={presets} onPick={addAtPlayhead} />
        </section>
      ))}
      <section className="anim-group">
        <h3>{t('animation.all')}</h3>
        <BlockList track={layer} />
      </section>
    </>
  )
}
