import { useState } from 'react'
import { EASINGS } from '../engine/easing'
import { PRESETS, presetsFor } from '../engine/presets'
import { findBlock, useProjectStore, usePlaybackStore } from '../store/projectStore'
import { LayerPanel } from './LayerPanel'
import { ProjectSettings } from './ProjectSettings'

export function Inspector({ selectedTrackId, onSelectTrack }: { selectedTrackId: string; onSelectTrack: (id: string) => void }) {
  const project = useProjectStore((s) => s.project)
  const selectedBlockIds = useProjectStore((s) => s.selectedBlockIds)
  const updateBlock = useProjectStore((s) => s.updateBlock)
  const removeBlocks = useProjectStore((s) => s.removeBlocks)
  const addBlock = useProjectStore((s) => s.addBlock)

  const track = selectedTrackId === 'camera' ? project.camera : project.layers.find((l) => l.id === selectedTrackId)
  const target = selectedTrackId === 'camera' ? 'camera' : 'layer'
  const available = presetsFor(target)
  const [presetToAdd, setPresetToAdd] = useState('')
  const chosenPreset = available.some(([id]) => id === presetToAdd) ? presetToAdd : available[0]?.[0]

  const found = selectedBlockIds.length ? findBlock(project, selectedBlockIds[0]) : null
  const block = found?.block
  const preset = block ? PRESETS[block.preset] : undefined

  return (
    <aside className="inspector">
      <LayerPanel selectedTrackId={selectedTrackId} onSelectTrack={onSelectTrack} />

      <section>
        <h2>Blok ekle</h2>
        <p className="hint">
          Satır: <b>{track?.name ?? '—'}</b> · oynatma kafasının olduğu yere eklenir
        </p>
        <label htmlFor="add-preset">Animasyon</label>
        <select id="add-preset" value={chosenPreset} onChange={(e) => setPresetToAdd(e.target.value)}>
          {available.map(([id, p]) => (
            <option key={id} value={id}>
              {p.category} · {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary"
          disabled={!track || !chosenPreset}
          onClick={() => chosenPreset && addBlock(selectedTrackId, chosenPreset, +usePlaybackStore.getState().time.toFixed(2))}
        >
          Ekle
        </button>
      </section>

      <section>
        <h2>Seçili blok</h2>
        {selectedBlockIds.length > 1 && (
          <p className="hint">
            <b>{selectedBlockIds.length} blok seçili.</b> Ok tuşlarıyla kaydırın, Ctrl+C / Ctrl+D ile kopyalayın ya da çoğaltın.
          </p>
        )}
        {!block || !preset ? (
          <p className="hint">Timeline'da bir bloğa tıklayın. Shift ile birden fazla seçebilirsiniz.</p>
        ) : (
          <>
            <p className="block-title">
              {preset.label} <span>· {found?.track.name}</span>
            </p>
            <label htmlFor="block-easing">Hız eğrisi</label>
            <select
              id="block-easing"
              value={block.easing ?? ''}
              onChange={(e) => updateBlock(block.id, { easing: e.target.value || undefined })}
            >
              <option value="">Varsayılan ({EASINGS[preset.defaultEasing]?.label})</option>
              {Object.entries(EASINGS).map(([id, e]) => (
                <option key={id} value={id}>
                  {e.label}
                </option>
              ))}
            </select>
            <div className="row">
              <div>
                <label htmlFor="block-start">Başlangıç (sn)</label>
                <input
                  id="block-start"
                  type="number"
                  step={0.1}
                  min={0}
                  value={block.start}
                  onChange={(e) => updateBlock(block.id, { start: Math.max(0, Number(e.target.value)) })}
                />
              </div>
              <div>
                <label htmlFor="block-duration">Süre (sn)</label>
                <input
                  id="block-duration"
                  type="number"
                  step={0.1}
                  min={0.05}
                  value={block.duration}
                  onChange={(e) => updateBlock(block.id, { duration: Math.max(0.05, Number(e.target.value)) })}
                />
              </div>
            </div>
            {Object.entries(block.params ?? {}).map(([key, value]) => (
              <div key={key}>
                <label htmlFor={`param-${key}`}>{key}</label>
                <input
                  id={`param-${key}`}
                  type="number"
                  step={0.1}
                  value={value}
                  onChange={(e) => updateBlock(block.id, { params: { ...block.params, [key]: Number(e.target.value) } })}
                />
              </div>
            ))}
            <button type="button" className="danger" onClick={() => removeBlocks(selectedBlockIds)}>
              {selectedBlockIds.length > 1 ? `${selectedBlockIds.length} bloğu sil` : 'Bloğu sil'}
            </button>
          </>
        )}
      </section>

      <ProjectSettings />
    </aside>
  )
}
