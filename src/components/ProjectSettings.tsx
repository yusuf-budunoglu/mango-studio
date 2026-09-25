import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../store/projectStore'

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
