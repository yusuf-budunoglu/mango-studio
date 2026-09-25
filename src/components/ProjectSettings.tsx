import { useProjectStore } from '../store/projectStore'

export function ProjectSettings() {
  const project = useProjectStore((s) => s.project)
  const updateProject = useProjectStore((s) => s.updateProject)

  return (
    <section>
      <h2>Proje</h2>
      <label htmlFor="project-name">Ad</label>
      <input id="project-name" value={project.name} onChange={(e) => updateProject({ name: e.target.value })} />
      <div className="row">
        <div>
          <label htmlFor="project-duration">Süre (sn)</label>
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
          <label htmlFor="project-bg">Arka plan</label>
          <input id="project-bg" type="color" value={project.background} onChange={(e) => updateProject({ background: e.target.value })} />
        </div>
      </div>
      <p className="hint">
        {project.width}×{project.height} · {project.fps} fps
      </p>
    </section>
  )
}
