import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_BEZIER, EASINGS, easingFor } from '../engine/easing'
import { PRESETS } from '../engine/presets'
import type { Block, CameraTrack, Layer } from '../engine/types'
import { categoryLabel, easingLabel, paramLabel, presetLabel } from '../i18n/labels'
import { useEditorStore, type LayerTab, type ProjectTab } from '../store/editorStore'
import { findAudio, findBlock, trackOffset, useProjectStore } from '../store/projectStore'
import { AnimationPanel, BlockList } from './AnimationPanel'
import { AudioPanel } from './AudioPanel'
import { CurveEditor } from './CurveEditor'
import { EffectsPanel } from './EffectsPanel'
import { LayerFields } from './LayerPanel'
import { ProjectSettings } from './ProjectSettings'

function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="props-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} className={value === tab.id ? 'is-on' : ''} onClick={() => onChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

/** Seçili bloğun ayrıntıları: eğri, zaman ve preset ayarları. Zaman videoya göre gösterilir. */
function BlockPanel({ block, track, count }: { block: Block; track: Layer | CameraTrack; count: number }) {
  const { t } = useTranslation()
  const { updateBlock, removeBlocks, selectBlock } = useProjectStore.getState()
  const preset = PRESETS[block.preset]
  const offset = trackOffset(track)
  if (!preset) return null
  const isLayer = 'kind' in track

  return (
    <section>
      <button type="button" className="props-back" onClick={() => selectBlock(null)}>
        <ArrowLeft size={14} strokeWidth={1.75} /> {isLayer ? track.name : t('props.backToProject')}
      </button>
      <p className="block-title">
        {presetLabel(block.preset)} <span>· {categoryLabel(preset.category)}</span>
      </p>
      {count > 1 && (
        <p className="hint">
          <b>{t('block.multiSelected', { count })}</b> {t('block.multiHint')}
        </p>
      )}
      <div className="row">
        <div>
          <label htmlFor="block-start">{t('block.start')}</label>
          <input
            id="block-start"
            type="number"
            step={0.1}
            min={offset}
            value={+(block.start + offset).toFixed(3)}
            onChange={(e) => updateBlock(block.id, { start: Math.max(0, Number(e.target.value) - offset) })}
          />
        </div>
        <div>
          <label htmlFor="block-duration">{t('block.duration')}</label>
          <input id="block-duration" type="number" step={0.1} min={0.05} value={block.duration} onChange={(e) => updateBlock(block.id, { duration: Math.max(0.05, Number(e.target.value)) })} />
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
      <label htmlFor="block-easing">{t('block.easing')}</label>
      <select
        id="block-easing"
        value={block.easing ?? ''}
        onChange={(e) =>
          updateBlock(block.id, {
            easing: e.target.value || undefined,
            // Özel eğriye ilk geçişte, o ana kadarki eğriye yakın bir başlangıç ver.
            ...(e.target.value === 'custom' && !block.bezier ? { bezier: DEFAULT_BEZIER } : {}),
          })
        }
      >
        <option value="">{t('block.defaultEasing', { easing: easingLabel(preset.defaultEasing) })}</option>
        {Object.keys(EASINGS).map((id) => (
          <option key={id} value={id}>
            {easingLabel(id)}
          </option>
        ))}
        <option value="custom">{easingLabel('custom')}</option>
      </select>
      <CurveEditor fn={easingFor(block, preset.defaultEasing)} bezier={block.easing === 'custom' ? (block.bezier ?? DEFAULT_BEZIER) : undefined} onChange={(bezier) => updateBlock(block.id, { bezier })} />
      <button type="button" className="danger" onClick={() => removeBlocks(useProjectStore.getState().selectedBlockIds)}>
        {t('block.delete', { count })}
      </button>
    </section>
  )
}

/** Klibin videodaki yeri: başlangıç ve süre. */
function ClipTiming({ layer }: { layer: Layer }) {
  const { t } = useTranslation()
  const total = useProjectStore((s) => s.project.duration)
  const set = (start: number, duration: number) => useProjectStore.getState().setClipTimes({ [layer.id]: { start, end: start + duration } })
  return (
    <div className="row">
      <div>
        <label htmlFor="clip-start">{t('clip.start')}</label>
        <input id="clip-start" type="number" step={0.1} min={0} max={total} value={layer.start} onChange={(e) => set(Math.max(0, Number(e.target.value)), layer.duration)} />
      </div>
      <div>
        <label htmlFor="clip-duration">{t('clip.duration')}</label>
        <input id="clip-duration" type="number" step={0.1} min={0.1} value={layer.duration} onChange={(e) => set(layer.start, Math.max(0.1, Number(e.target.value)))} />
      </div>
    </div>
  )
}

/**
 * Sağ panel: seçime göre blok, ses parçası, klip (Temel / Animasyon) ya da proje (Proje / Efektler)
 * ayarları. Timeline'da ve önizlemede yapılan seçim burada açılır.
 */
export function PropertiesPanel() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const selectedTrackId = useProjectStore((s) => s.selectedTrackId)
  const selectedBlockIds = useProjectStore((s) => s.selectedBlockIds)
  const layerTab = useEditorStore((s) => s.layerTab)
  const projectTab = useEditorStore((s) => s.projectTab)
  const { setLayerTab, setProjectTab } = useEditorStore.getState()

  const first = selectedBlockIds[0]
  const audioClip = first ? findAudio(project, first) : undefined
  const found = first ? findBlock(project, first) : null
  const layer = project.layers.find((l) => l.id === selectedTrackId)

  let content
  if (audioClip) {
    content = <AudioPanel key={audioClip.id} clip={audioClip} />
  } else if (found) {
    content = <BlockPanel key={found.block.id} block={found.block} track={found.track} count={selectedBlockIds.length} />
  } else if (layer) {
    content = (
      <>
        <Tabs<LayerTab>
          label={layer.name}
          value={layerTab}
          onChange={setLayerTab}
          tabs={[
            { id: 'basic', label: t('props.basic') },
            { id: 'animation', label: t('props.animation') },
          ]}
        />
        {layerTab === 'basic' ? (
          <section key={layer.id}>
            <ClipTiming layer={layer} />
            <LayerFields layer={layer} />
          </section>
        ) : (
          <AnimationPanel layer={layer} />
        )}
      </>
    )
  } else {
    content = (
      <>
        <Tabs<ProjectTab>
          label={t('project.title')}
          value={projectTab}
          onChange={setProjectTab}
          tabs={[
            { id: 'project', label: t('props.project') },
            { id: 'effects', label: t('props.effects') },
          ]}
        />
        {projectTab === 'project' ? (
          <>
            <ProjectSettings />
            {selectedTrackId === 'camera' && (
              <section>
                <h2>{t('props.cameraBlocks')}</h2>
                <BlockList track={project.camera} />
              </section>
            )}
          </>
        ) : (
          <EffectsPanel />
        )}
      </>
    )
  }

  return <aside className="inspector">{content}</aside>
}
