import { useTranslation } from 'react-i18next'
import { PRESETS } from '../engine/presets'
import type { Layer } from '../engine/types'
import { presetLabel } from '../i18n/labels'
import { KIND_ICON } from './kindIcons'

const EDGE = 0.05

/**
 * Timeline'da bir katmanın klibi. Giriş ve çıkış animasyonları klibin kenarlarında gölge olarak,
 * diğer animasyonlar küçük işaretler olarak görünür; ayrıntısı klibin şeridi açılınca.
 */
export function ClipBar({ layer, selected, expanded }: { layer: Layer; selected: boolean; expanded: boolean }) {
  const { t } = useTranslation()
  const Icon = KIND_ICON[layer.kind]
  const pct = (seconds: number) => `${Math.max(0, Math.min(100, (seconds / layer.duration) * 100))}%`
  const categoryOf = (preset: string) => PRESETS[preset]?.category
  const intro = layer.blocks.find((b) => categoryOf(b.preset) === 'in' && Math.abs(b.start) < EDGE)
  const outro = layer.blocks.find((b) => categoryOf(b.preset) === 'out' && Math.abs(b.start + b.duration - layer.duration) < EDGE)
  const marks = layer.blocks.filter((b) => b !== intro && b !== outro)
  const subtitle = layer.kind === 'text' ? layer.text : undefined

  return (
    <div
      className={`clip clip--${layer.kind} ${selected ? 'is-selected' : ''} ${layer.locked ? 'is-locked' : ''} ${layer.hidden ? 'is-hidden' : ''}`}
      title={layer.name}
    >
      {intro && <span className="clip-intro" style={{ width: pct(intro.duration) }} title={`${t('animation.in')}: ${presetLabel(intro.preset)}`} />}
      {outro && <span className="clip-outro" style={{ width: pct(outro.duration) }} title={`${t('animation.out')}: ${presetLabel(outro.preset)}`} />}
      <span className="clip-head">
        <Icon size={13} strokeWidth={1.75} aria-hidden="true" />
        <span className="clip-name">{layer.name}</span>
        {subtitle && subtitle !== layer.name && <span className="clip-sub">{subtitle}</span>}
        {!!layer.blocks.length && !expanded && <span className="clip-count">{t('clip.animations', { count: layer.blocks.length })}</span>}
      </span>
      <span className="clip-marks" aria-hidden="true">
        {marks.map((b) => (
          <i key={b.id} className={`clip-mark clip-mark--${categoryOf(b.preset) ?? 'x'}`} style={{ left: pct(b.start), width: pct(b.duration) }} title={presetLabel(b.preset)} />
        ))}
      </span>
    </div>
  )
}
