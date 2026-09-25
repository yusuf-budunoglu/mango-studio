import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { readAudioDuration } from '../audio/engine'
import type { Layer, LayerKind, Vec3 } from '../engine/types'
import { assetRef, assets } from '../persistence/assets'
import { DEFAULT_FONT, FONTS } from '../render/fonts'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

const ADDABLE: LayerKind[] = ['text', 'image', 'phone', 'shape']

/** Yüklenen görseli en fazla 2048 px'e küçültüp dosya deposuna koyar, referansını döndürür. */
async function storeImage(file: File, maxSize = 2048): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, 0.9))
  const meta = await assets.put(blob, { name: file.name, kind: 'image' })
  return assetRef(meta.id)
}

function NumberField({ id, label, value, step = 0.1, onChange }: { id: string; label: string; value: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" step={step} value={Number(value.toFixed(3))} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  )
}

function LayerFields({ layer }: { layer: Layer }) {
  const { t } = useTranslation()
  const updateLayer = useProjectStore((s) => s.updateLayer)
  const removeLayer = useProjectStore((s) => s.removeLayer)
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
          <div className="row">
            <div>
              <label htmlFor="layer-font-family">{t('layer.font')}</label>
              <select id="layer-font-family" value={layer.fontFamily ?? DEFAULT_FONT} onChange={(e) => update({ fontFamily: e.target.value })}>
                {FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="layer-font-weight">{t('layer.weight')}</label>
              <select id="layer-font-weight" value={layer.fontWeight ?? 400} onChange={(e) => update({ fontWeight: Number(e.target.value) as 400 | 700 })}>
                <option value={400}>{t('layer.weightRegular')}</option>
                <option value={700}>{t('layer.weightBold')}</option>
              </select>
            </div>
          </div>
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

      {(layer.kind === 'image' || layer.kind === 'phone') && (
        <>
          <label htmlFor="layer-image">{layer.kind === 'phone' ? t('layer.screenshot') : t('layer.image')}</label>
          <input
            id="layer-image"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) update({ image: await storeImage(file) })
              e.target.value = ''
            }}
          />
          {layer.image && (
            <button type="button" onClick={() => update({ image: undefined })}>
              {t('layer.removeImage')}
            </button>
          )}
        </>
      )}

      {layer.kind !== 'image' && (
        <>
          <label htmlFor="layer-color">{layer.kind === 'phone' ? t('layer.screenColor') : t('layer.color')}</label>
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

export function LayerPanel() {
  const layer = useProjectStore((s) => s.project.layers.find((l) => l.id === s.selectedTrackId))
  const addLayer = useProjectStore((s) => s.addLayer)
  const { t } = useTranslation()
  const audioInput = useRef<HTMLInputElement>(null)

  // Ses dosyası: süresini oku, depoya koy, oynatma kafasına parça olarak ekle.
  const addAudio = async (file: File) => {
    const duration = await readAudioDuration(file)
    const meta = await assets.put(file, { name: file.name, kind: 'audio', duration })
    useProjectStore.getState().addAudioClip(assetRef(meta.id), file.name.replace(/\.[^.]+$/, ''), duration, usePlaybackStore.getState().time)
  }

  return (
    <section>
      <h2>{t('layer.title')}</h2>
      <div className="add-layer">
        {ADDABLE.map((kind) => (
          <button key={kind} type="button" onClick={() => addLayer(kind, +usePlaybackStore.getState().time.toFixed(2))}>
            {t(`layer.add.${kind}`)}
          </button>
        ))}
        <button type="button" onClick={() => audioInput.current?.click()}>
          {t('layer.add.audio')}
        </button>
        <input
          ref={audioInput}
          id="audio-file"
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void addAudio(file)
            e.target.value = ''
          }}
        />
      </div>
      {layer ? <LayerFields key={layer.id} layer={layer} /> : <p className="hint">{t('layer.empty')}</p>}
    </section>
  )
}
