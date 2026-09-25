import { useTranslation } from 'react-i18next'
import { resolveEffects, type ProjectEffects } from '../engine/effects'
import { useProjectStore } from '../store/projectStore'

type Group = keyof ProjectEffects

function Slider({ id, label, value, min, max, step, onChange }: { id: string; label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div className="slider">
      <label htmlFor={id}>
        {label} <span>{value.toFixed(2)}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

/** Projenin görüntü efektleri: aç/kapa ve ayarlar. */
export function EffectsPanel() {
  const { t } = useTranslation()
  const effects = resolveEffects(useProjectStore((s) => s.project.effects))
  const update = useProjectStore((s) => s.updateEffects)
  const toggle = (group: Exclude<Group, 'color'>) => (
    <input
      id={`fx-${group}`}
      type="checkbox"
      checked={effects[group].enabled}
      onChange={(e) => update({ [group]: { enabled: e.target.checked } })}
    />
  )

  return (
    <section className="effects">
      <h2>{t('effects.title')}</h2>

      <label className="fx-toggle" htmlFor="fx-bloom">
        {toggle('bloom')} {t('effects.bloom')}
      </label>
      {effects.bloom.enabled && (
        <>
          <Slider id="fx-bloom-intensity" label={t('effects.intensity')} value={effects.bloom.intensity} min={0} max={3} step={0.05} onChange={(v) => update({ bloom: { intensity: v } })} />
          <Slider id="fx-bloom-threshold" label={t('effects.threshold')} value={effects.bloom.threshold} min={0} max={1} step={0.01} onChange={(v) => update({ bloom: { threshold: v } })} />
        </>
      )}

      <label className="fx-toggle" htmlFor="fx-dof">
        {toggle('dof')} {t('effects.dof')}
      </label>
      {effects.dof.enabled && (
        <>
          <Slider id="fx-dof-bokeh" label={t('effects.bokeh')} value={effects.dof.bokeh} min={0} max={10} step={0.1} onChange={(v) => update({ dof: { bokeh: v } })} />
          <Slider id="fx-dof-range" label={t('effects.range')} value={effects.dof.range} min={0.2} max={10} step={0.1} onChange={(v) => update({ dof: { range: v } })} />
          <p className="hint">{t('effects.dofHint')}</p>
        </>
      )}

      <label className="fx-toggle" htmlFor="fx-grain">
        {toggle('grain')} {t('effects.grain')}
      </label>
      {effects.grain.enabled && (
        <Slider id="fx-grain-amount" label={t('effects.amount')} value={effects.grain.amount} min={0} max={0.6} step={0.01} onChange={(v) => update({ grain: { amount: v } })} />
      )}

      <label className="fx-toggle" htmlFor="fx-vignette">
        {toggle('vignette')} {t('effects.vignette')}
      </label>
      {effects.vignette.enabled && (
        <Slider id="fx-vignette-darkness" label={t('effects.darkness')} value={effects.vignette.darkness} min={0} max={1} step={0.01} onChange={(v) => update({ vignette: { darkness: v } })} />
      )}

      <label className="fx-toggle" htmlFor="fx-motionBlur">
        {toggle('motionBlur')} {t('effects.motionBlur')}
      </label>
      {effects.motionBlur.enabled && (
        <>
          <Slider id="fx-mb-samples" label={t('effects.samples')} value={effects.motionBlur.samples} min={2} max={16} step={1} onChange={(v) => update({ motionBlur: { samples: v } })} />
          <Slider id="fx-mb-shutter" label={t('effects.shutter')} value={effects.motionBlur.shutter} min={0.1} max={1} step={0.05} onChange={(v) => update({ motionBlur: { shutter: v } })} />
          <p className="hint">{t('effects.motionBlurHint')}</p>
        </>
      )}

      <h3>{t('effects.color')}</h3>
      <Slider id="fx-saturation" label={t('effects.saturation')} value={effects.color.saturation} min={-1} max={1} step={0.01} onChange={(v) => update({ color: { saturation: v } })} />
      <Slider id="fx-contrast" label={t('effects.contrast')} value={effects.color.contrast} min={-1} max={1} step={0.01} onChange={(v) => update({ color: { contrast: v } })} />
      <Slider id="fx-brightness" label={t('effects.brightness')} value={effects.color.brightness} min={-1} max={1} step={0.01} onChange={(v) => update({ color: { brightness: v } })} />
    </section>
  )
}
