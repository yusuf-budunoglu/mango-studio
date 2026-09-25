import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '../components/LanguageSelect'
import { navigate } from '../router'
import { newId } from '../engine/ids'
import { parseProjectFile, repository, type ProjectSummary } from '../persistence/repository'
import { TEMPLATES, templateDescription, templateName } from '../project/templates'

export function Home() {
  const { t, i18n } = useTranslation()
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => repository.list().then(setProjects)
  useEffect(() => {
    void refresh()
  }, [])

  const createFrom = async (templateId: string) => {
    const template = TEMPLATES.find((t) => t.id === templateId)
    if (!template) return
    const project = template.build()
    await repository.save(project)
    navigate({ screen: 'editor', projectId: project.id })
  }

  const duplicate = async (id: string) => {
    const project = await repository.load(id)
    if (!project) return
    await repository.save({ ...project, id: newId('p'), name: t('home.copyName', { name: project.name }) })
    await refresh()
  }

  const remove = async (id: string) => {
    await repository.remove(id)
    setConfirmDelete(null)
    await refresh()
  }

  const importFile = async (file: File) => {
    setError(null)
    try {
      const project = parseProjectFile(await file.text())
      await repository.save(project)
      navigate({ screen: 'editor', projectId: project.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          motion<span>studio</span>
        </div>
        <div className="controls">
          <button type="button" onClick={() => fileInput.current?.click()}>
            {t('home.openFile')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importFile(file)
              e.target.value = ''
            }}
          />
          <LanguageSelect />
        </div>
      </header>

      <main className="home-main">
        {error && <p className="home-error">{error}</p>}

        <section>
          <h1>{t('home.newVideo')}</h1>
          <p className="hint">{t('home.newVideoHint')}</p>
          <div className="card-grid">
            {TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" className="card template-card" onClick={() => void createFrom(tpl.id)}>
                <span className="card-art" style={{ background: `radial-gradient(circle at 30% 30%, ${tpl.accent}, #0b0e13 75%)` }} />
                <span className="card-title">{templateName(tpl.id)}</span>
                <span className="card-sub">{templateDescription(tpl.id)}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h1>{t('home.myProjects')}</h1>
          {projects === null ? (
            <p className="hint">{t('home.loading')}</p>
          ) : projects.length === 0 ? (
            <p className="hint">{t('home.empty')}</p>
          ) : (
            <div className="card-grid">
              {projects.map((p) => (
                <div key={p.id} className="card project-card">
                  <button type="button" className="card-open" onClick={() => navigate({ screen: 'editor', projectId: p.id })}>
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="card-art" /> : <span className="card-art card-art--empty" />}
                    <span className="card-title">{p.name}</span>
                    <span className="card-sub">{t('home.cardMeta', { duration: p.duration, date: dateFormat.format(p.updatedAt) })}</span>
                  </button>
                  <div className="card-actions">
                    <button type="button" onClick={() => void duplicate(p.id)}>
                      {t('home.duplicate')}
                    </button>
                    {confirmDelete === p.id ? (
                      <>
                        <button type="button" className="danger" onClick={() => void remove(p.id)}>
                          {t('home.confirmDelete')}
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="danger" onClick={() => setConfirmDelete(p.id)}>
                        {t('home.delete')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
