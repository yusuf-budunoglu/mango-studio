import { useTranslation } from 'react-i18next'
import type { Layer, LayerKind, Vec3 } from '../engine/types'
import { AssetPicker } from './AssetPicker'
import { FontPicker } from './FontPicker'
import { isUploadedFont } from '../render/fonts'
import { useProjectStore } from '../store/projectStore'

const DEVICE_KINDS: LayerKind[] = ['phone', 'laptop', 'tablet']

function NumberField({ id, label, value, step = 0.1, onChange }: { id: string; label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" step={step} value={Number(value.toFixed(3))} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

/** Seçili katmanın (klibin) içerik ve konum ayarları. */
export function LayerFields({ layer }: { layer: Layer }) {
  const { t } = useTranslation()
  const updateLayer = useProjectStore((s) => s.updateLayer)
  const removeLayer = useProjectStore((s) => s.removeLayer)
  const setScreenImage = useProjectStore((s) => s.setScreenImage)
  // Aynı ekranı paylaşan cihazlar (ör. şablonda her çekim ayrı telefon katmanı) birlikte değişir.
  const sharedScreens = useProjectStore((s) =>
    DEVICE_KINDS.includes(layer.kind) && layer.image ? s.project.layers.filter((l) => l.kind === layer.kind && l.image === layer.image).length : 1,
  )
  const update = (patch: Partial<Layer>) => updateLayer(layer.id, patch)
  const setVec = (key: 'position' | 'rotation', index: number, v: number) => {
    const next = [...layer[key]] as Vec3
    next[index] = v
    update({ [key]: next })
  }

  return (
    <>
      <label htmlFor="layer-name">{t('layer.name')}</label>
      <input id="layer-name" value={layer.name} onChange={(e) => update({ name: e.target.value })} />

      {layer.kind === 'text' && (
        <>
          <label htmlFor="layer-text">{t('layer.text')}</label>
          <textarea id="layer-text" rows={2} value={layer.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
          <NumberField id="layer-font" label={t('layer.fontSize')} value={layer.fontSize ?? 0.4} step={0.05} onChange={(v) => update({ fontSize: Math.max(0.05, v) })} />
          <label htmlFor="layer-font-family">{t('layer.font')}</label>
          <FontPicker id="layer-font-family" value={layer.fontFamily} onChange={(fontFamily) => update({ fontFamily })} />
          <label htmlFor="layer-font-weight">{t('layer.weight')}</label>
          {/* yüklenen font tek dosya: kalınlığı dosyanın kendisi */}
          <select
            id="layer-font-weight"
            value={layer.fontWeight ?? 400}
            disabled={isUploadedFont(layer.fontFamily)}
            onChange={(e) => update({ fontWeight: Number(e.target.value) as 400 | 700 })}
          >
            <option value={400}>{t('layer.weightRegular')}</option>
            <option value={700}>{t('layer.weightBold')}</option>
          </select>
          <div className="row">
            <NumberField id="layer-text-width" label={t('layer.textWidth')} value={layer.textWidth ?? 5} step={0.25} onChange={(v) => update({ textWidth: Math.max(0.5, v) })} />
            <NumberField id="layer-line-height" label={t('layer.lineHeight')} value={layer.lineHeight ?? 1.2} step={0.05} onChange={(v) => update({ lineHeight: Math.max(0.5, v) })} />
          </div>
          <NumberField id="layer-letter-spacing" label={t('layer.letterSpacing')} value={layer.letterSpacing ?? 0} step={0.01} onChange={(v) => update({ letterSpacing: Math.min(1, Math.max(-0.2, v)) })} />
          <label htmlFor="layer-align">{t('layer.align')}</label>
          <select id="layer-align" value={layer.align ?? 'center'} onChange={(e) => update({ align: e.target.value as Layer['align'] })}>
            <option value="left">{t('layer.alignLeft')}</option>
            <option value="center">{t('layer.alignCenter')}</option>
            <option value="right">{t('layer.alignRight')}</option>
          </select>
        </>
      )}

      {layer.kind === 'image' && <AssetPicker id="layer-image" label={t('layer.image')} kind="image" value={layer.image} onChange={(image) => update({ image })} />}

      {DEVICE_KINDS.includes(layer.kind) && (
        <>
          <AssetPicker id="layer-image" label={t('layer.screenshot')} kind="image" value={layer.image} onChange={(image) => setScreenImage(layer.id, image)} />
          {sharedScreens > 1 && <p className="hint">{t('layer.sharedScreen', { count: sharedScreens })}</p>}
        </>
      )}

      {DEVICE_KINDS.includes(layer.kind) && (
        <div className="row">
          <div>
            <label htmlFor="layer-finish">{t('layer.finish')}</label>
            <select id="layer-finish" value={layer.deviceFinish ?? (layer.kind === 'phone' ? 'space' : 'silver')} onChange={(e) => update({ deviceFinish: e.target.value as Layer['deviceFinish'] })}>
              {(['silver', 'space', 'titanium', 'blue'] as const).map((f) => (
                <option key={f} value={f}>
                  {t(`layer.finishes.${f}`)}
                </option>
              ))}
            </select>
          </div>
          {layer.kind === 'laptop' && (
            <NumberField id="layer-lid" label={t('layer.lidAngle')} value={layer.lidAngle ?? 105} step={5} onChange={(v) => update({ lidAngle: Math.min(180, Math.max(0, v)) })} />
          )}
        </div>
      )}

      {layer.kind === 'svg' && (
        <>
          <AssetPicker id="layer-svg" label={t('layer.svgFile')} kind="svg" value={layer.media} onChange={(media) => update({ media })} />
          <label className="fx-toggle" htmlFor="layer-tint">
            <input id="layer-tint" type="checkbox" checked={!!layer.tint} onChange={(e) => update({ tint: e.target.checked })} /> {t('layer.tint')}
          </label>
          <NumberField id="layer-extrude" label={t('layer.extrude')} value={layer.extrude ?? 0} step={0.05} onChange={(v) => update({ extrude: Math.min(2, Math.max(0, v)) })} />
        </>
      )}

      {layer.kind === 'video' && (
        <>
          <AssetPicker id="layer-video" label={t('layer.videoFile')} kind="video" value={layer.media} onChange={(media) => update({ media })} />
          <NumberField id="layer-media-offset" label={t('layer.videoOffset')} value={layer.mediaOffset ?? 0} onChange={(v) => update({ mediaOffset: Math.max(0, v) })} />
          <p className="hint">{t('layer.videoHint')}</p>
        </>
      )}

      {layer.kind === 'shape' && (
        <>
          <label htmlFor="layer-shape">{t('layer.shapeType')}</label>
          <select id="layer-shape" value={layer.shape ?? 'cube'} onChange={(e) => update({ shape: e.target.value as Layer['shape'] })}>
            {(['cube', 'rect', 'rounded', 'circle'] as const).map((shape) => (
              <option key={shape} value={shape}>
                {t(`shapes.${shape}`)}
              </option>
            ))}
          </select>
          <div className="row">
            <NumberField id="layer-shape-w" label={t('layer.width')} value={layer.shapeWidth ?? 1} onChange={(v) => update({ shapeWidth: Math.max(0.05, v) })} />
            <NumberField id="layer-shape-h" label={t('layer.height')} value={layer.shapeHeight ?? 1} onChange={(v) => update({ shapeHeight: Math.max(0.05, v) })} />
          </div>
        </>
      )}

      {layer.kind !== 'image' && layer.kind !== 'video' && (layer.kind !== 'svg' || layer.tint) && (
        <>
          <label htmlFor="layer-color">{DEVICE_KINDS.includes(layer.kind) ? t('layer.screenColor') : t('layer.color')}</label>
          <input id="layer-color" type="color" value={layer.color} onChange={(e) => update({ color: e.target.value })} />
        </>
      )}

      <div className="row">
        <NumberField id="layer-x" label={t('layer.x')} value={layer.position[0]} onChange={(v) => setVec('position', 0, v)} />
        <NumberField id="layer-y" label={t('layer.y')} value={layer.position[1]} onChange={(v) => setVec('position', 1, v)} />
      </div>
      <div className="row">
        <NumberField id="layer-z" label={t('layer.depth')} value={layer.position[2]} onChange={(v) => setVec('position', 2, v)} />
        <NumberField id="layer-roty" label={t('layer.rotationY')} value={layer.rotation[1]} step={1} onChange={(v) => setVec('rotation', 1, v)} />
      </div>
      <div className="row">
        <NumberField id="layer-scale" label={t('layer.scale')} value={layer.scale} step={0.05} onChange={(v) => update({ scale: Math.max(0.01, v) })} />
        <NumberField id="layer-opacity" label={t('layer.opacity')} value={layer.opacity} step={0.05} onChange={(v) => update({ opacity: Math.min(1, Math.max(0, v)) })} />
      </div>
      <button type="button" className="danger" onClick={() => removeLayer(layer.id)}>
        {t('layer.delete')}
      </button>
    </>
  )
}
