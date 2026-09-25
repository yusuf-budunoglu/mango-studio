import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EASINGS } from '../engine/easing'
import { PRESETS, presetsFor } from '../engine/presets'
import { categoryLabel, easingLabel, paramLabel, presetLabel } from '../i18n/labels'
import { findAudio, findBlock, useProjectStore, usePlaybackStore } from '../store/projectStore'
import { AudioPanel } from './AudioPanel'
import { LayerPanel } from './LayerPanel'
import { ProjectSettings } from './ProjectSettings'

export function Inspector() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const selectedBlockIds = useProjectStore((s) => s.selectedBlockIds)
  const updateBlock = useProjectStore((s) => s.updateBlock)
  const removeBlocks = useProjectStore((s) => s.removeBlocks)
  const addBlock = useProjectStore((s) => s.addBlock)

  const track = selectedTrackId === 'camera' ? project.camera : project.layers.find((l) => l.id === selectedTrackId)
  const target = selectedTrackId === 'camera' ? 'camera' : 'layer'
  const available = presetsFor(target)
  const [presetToAdd, setPresetToAdd] = useState('')
  const chosenPreset = available.some(([id]) => id === presetToAdd) ? presetToAdd : available[0]?.[0]

  const audioClip = selectedBlockIds.length ? findAudio(project, selectedBlockIds[0]) : undefined
  const found = selectedBlockIds.length ? findBlock(project, selectedBlockIds[0]) : null
  const block = found?.block
  const preset = block ? PRESETS[block.preset] : undefined

  return (
    <aside className="inspector">
      <LayerPanel />

      {audioClip && <AudioPanel key={audioClip.id} clip={audioClip} />}

      {selectedTrackId !== 'audio' && (
      <section>
        <h2>{t('block.addTitle')}</h2>
        <p className="hint">{t('block.addHint', { track: track?.name ?? '—' })}</p>
        <label htmlFor="add-preset">{t('block.animation')}</label>
        <select id="add-preset" value={chosenPreset} onChange={(e) => setPresetToAdd(e.target.value)}>
          {available.map(([id, p]) => (
            <option key={id} value={id}>
              {categoryLabel(p.category)} · {presetLabel(id)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="primary"
          disabled={!track || !chosenPreset}
          onClick={() => chosenPreset && addBlock(selectedTrackId, chosenPreset, +usePlaybackStore.getState().time.toFixed(2))}
        >
          {t('block.add')}
        </button>
      </section>
      )}

      {!audioClip && (
      <section>
        <h2>{t('block.selectedTitle')}</h2>
        {selectedBlockIds.length > 1 && (
          <p className="hint">
            <b>{t('block.multiSelected', { count: selectedBlockIds.length })}</b> {t('block.multiHint')}
          </p>
        )}
        {!block || !preset ? (
          <p className="hint">{t('block.empty')}</p>
        ) : (
          <>
            <p className="block-title">
              {presetLabel(block.preset)} <span>· {found?.track.name}</span>
            </p>
            <label htmlFor="block-easing">{t('block.easing')}</label>
            <select
              id="block-easing"
              value={block.easing ?? ''}
              onChange={(e) => updateBlock(block.id, { easing: e.target.value || undefined })}
            >
              <option value="">{t('block.defaultEasing', { easing: easingLabel(preset.defaultEasing) })}</option>
              {Object.keys(EASINGS).map((id) => (
                <option key={id} value={id}>
                  {easingLabel(id)}
                </option>
              ))}
            </select>
            <div className="row">
              <div>
                <label htmlFor="block-start">{t('block.start')}</label>
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
                <label htmlFor="block-duration">{t('block.duration')}</label>
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
            {(preset.params ?? []).map((spec) => (
              <div key={spec.key}>
                <label htmlFor={`param-${spec.key}`}>{paramLabel(spec.key)}</label>
                <input
                  id={`param-${spec.key}`}
                  type="number"
                  step={spec.step}
                  min={spec.min}
                  max={spec.max}
                  value={block.params?.[spec.key] ?? spec.default}
                  onChange={(e) => {
                    const raw = Number(e.target.value)
                    if (!Number.isFinite(raw)) return
                    const value = Math.min(spec.max ?? Infinity, Math.max(spec.min ?? -Infinity, raw))
                    updateBlock(block.id, { params: { ...block.params, [spec.key]: value } })
                  }}
                />
              </div>
            ))}
            <button type="button" className="danger" onClick={() => removeBlocks(selectedBlockIds)}>
              {t('block.delete', { count: selectedBlockIds.length })}
            </button>
          </>
        )}
      </section>
      )}

      <ProjectSettings />
    </aside>
  )
}
