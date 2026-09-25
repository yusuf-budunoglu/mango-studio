import type { Layer, LayerKind, Vec3 } from '../engine/types'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

const ADDABLE: { kind: LayerKind; label: string }[] = [
  { kind: 'text', label: '+ Metin' },
  { kind: 'image', label: '+ Görsel' },
  { kind: 'phone', label: '+ Telefon' },
  { kind: 'shape', label: '+ Şekil' },
]

/** Yüklenen görseli en fazla 2048 px'e küçültüp data URL'e çevirir; proje dosyası şişmesin. */
async function readImage(file: File, maxSize = 2048): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9)
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
      <label htmlFor="layer-name">Ad</label>
      <input id="layer-name" value={layer.name} onChange={(e) => update({ name: e.target.value })} />

      {layer.kind === 'text' && (
        <>
          <label htmlFor="layer-text">Metin</label>
          <textarea id="layer-text" rows={2} value={layer.text ?? ''} onChange={(e) => update({ text: e.target.value })} />
          <NumberField id="layer-font" label="Yazı boyutu" value={layer.fontSize ?? 0.4} step={0.05} onChange={(v) => update({ fontSize: Math.max(0.05, v) })} />
        </>
      )}

      {(layer.kind === 'image' || layer.kind === 'phone') && (
        <>
          <label htmlFor="layer-image">{layer.kind === 'phone' ? 'Ekran görüntüsü' : 'Görsel'}</label>
          <input
            id="layer-image"
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) update({ image: await readImage(file) })
              e.target.value = ''
            }}
          />
          {layer.image && (
            <button type="button" onClick={() => update({ image: undefined })}>
              Görseli kaldır
            </button>
          )}
        </>
      )}

      {layer.kind !== 'image' && (
        <>
          <label htmlFor="layer-color">{layer.kind === 'phone' ? 'Ekran rengi' : 'Renk'}</label>
          <input id="layer-color" type="color" value={layer.color} onChange={(e) => update({ color: e.target.value })} />
        </>
      )}

      <div className="row">
        <NumberField id="layer-x" label="X" value={layer.position[0]} onChange={(v) => setVec('position', 0, v)} />
        <NumberField id="layer-y" label="Y" value={layer.position[1]} onChange={(v) => setVec('position', 1, v)} />
      </div>
      <div className="row">
        <NumberField id="layer-z" label="Derinlik (Z)" value={layer.position[2]} onChange={(v) => setVec('position', 2, v)} />
        <NumberField id="layer-roty" label="Y dönüşü (°)" value={layer.rotation[1]} step={1} onChange={(v) => setVec('rotation', 1, v)} />
      </div>
      <div className="row">
        <NumberField id="layer-scale" label="Ölçek" value={layer.scale} step={0.05} onChange={(v) => update({ scale: Math.max(0.01, v) })} />
        <NumberField id="layer-opacity" label="Opaklık" value={layer.opacity} step={0.05} onChange={(v) => update({ opacity: Math.min(1, Math.max(0, v)) })} />
      </div>
      <button type="button" className="danger" onClick={() => removeLayer(layer.id)}>
        Katmanı sil
      </button>
    </>
  )
}

export function LayerPanel({ selectedTrackId, onSelectTrack }: { selectedTrackId: string; onSelectTrack: (id: string) => void }) {
  const layer = useProjectStore((s) => s.project.layers.find((l) => l.id === selectedTrackId))
  const addLayer = useProjectStore((s) => s.addLayer)

  return (
    <section>
      <h2>Katman</h2>
      <div className="add-layer">
        {ADDABLE.map(({ kind, label }) => (
          <button key={kind} type="button" onClick={() => onSelectTrack(addLayer(kind, +usePlaybackStore.getState().time.toFixed(2)))}>
            {label}
          </button>
        ))}
      </div>
      {layer ? <LayerFields key={layer.id} layer={layer} /> : <p className="hint">Soldaki listeden bir katman seçin.</p>}
    </section>
  )
}
