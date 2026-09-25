import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../store/projectStore'

/** Video formatları: en-boy oranı → 1080 tabanlı boyut. */
const FORMATS = [
  { id: '16x9', width: 1920, height: 1080 },
  { id: '9x16', width: 1080, height: 1920 },
  { id: '1x1', width: 1080, height: 1080 },
  { id: '4x5', width: 1080, height: 1350 },
] as const

export function ProjectSettings() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const updateProject = useProjectStore((s) => s.updateProject)

  return (
    <section>
      <h2>{t('project.title')}</h2>
      <label htmlFor="project-name">{t('project.name')}</label>
      <input id="project-name" value={project.name} onChange={(e) => updateProject({ name: e.target.value })} />
      <div className="row">
        <div>
          <label htmlFor="project-duration">{t('project.duration')}</label>
          <input
            id="project-duration"
            type="number"
            min={1}
            max={120}
            step={0.5}
            value={project.duration}
            onChange={(e) => updateProject({ duration: Number(e.target.value) })}
          />
        </div>
        <div>
          <label htmlFor="project-bg">{t('project.background')}</label>
          <input id="project-bg" type="color" value={project.background} onChange={(e) => updateProject({ background: e.target.value })} />
        </div>
      </div>
      <div className="row">
        <div>
          <label htmlFor="project-bg-style">{t('project.backgroundStyle')}</label>
          <select id="project-bg-style" value={project.backgroundStyle ?? 'solid'} onChange={(e) => updateProject({ backgroundStyle: e.target.value as 'solid' | 'linear' | 'radial', background2: project.background2 ?? '#1f2a44' })}>
            <option value="solid">{t('project.bgSolid')}</option>
            <option value="linear">{t('project.bgLinear')}</option>
            <option value="radial">{t('project.bgRadial')}</option>
          </select>
        </div>
        {(project.backgroundStyle ?? 'solid') !== 'solid' && (
          <div>
            <label htmlFor="project-bg2">{t('project.background2')}</label>
            <input id="project-bg2" type="color" value={project.background2 ?? '#1f2a44'} onChange={(e) => updateProject({ background2: e.target.value })} />
          </div>
        )}
        <div>
          <label htmlFor="project-light">{t('project.accentLight')}</label>
          <input id="project-light" type="color" value={project.accentLight ?? '#6c5ce7'} onChange={(e) => updateProject({ accentLight: e.target.value })} />
        </div>
      </div>
      <label htmlFor="project-format">{t('project.format')}</label>
      <select
        id="project-format"
        value={FORMATS.find((f) => f.width === project.width && f.height === project.height)?.id ?? 'custom'}
        onChange={(e) => {
          const f = FORMATS.find((x) => x.id === e.target.value)
          if (f) updateProject({ width: f.width, height: f.height })
        }}
      >
        {FORMATS.map((f) => (
          <option key={f.id} value={f.id}>
            {t(`project.formats.${f.id}`)}
          </option>
        ))}
        {!FORMATS.some((f) => f.width === project.width && f.height === project.height) && (
          <option value="custom">
            {project.width}×{project.height}
          </option>
        )}
      </select>
      <label htmlFor="project-number-format">{t('project.numberFormat')}</label>
      <select
        id="project-number-format"
        value={project.numberLocale ?? 'en-US'}
        onChange={(e) => updateProject({ numberLocale: e.target.value })}
      >
        <option value="en-US">{t('project.numberFormatEn')}</option>
        <option value="tr-TR">{t('project.numberFormatTr')}</option>
      </select>
      <p className="hint">{t('project.meta', { width: project.width, height: project.height, fps: project.fps })}</p>
    </section>
  )
}
