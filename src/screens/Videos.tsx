import { FileUp, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { newId } from '../engine/ids'
import { AppShell } from '../layout/AppShell'
import { parseProjectFile, repository, type ProjectSummary } from '../persistence/repository'
import { navigate, routeToHash } from '../router'
import { matchesSearch, useUiStore } from '../store/uiStore'

export function Videos() {
  const { t, i18n } = useTranslation()
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
  const search = useUiStore((s) => s.search)
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const refresh = () => repository.list().then(setProjects)
  useEffect(() => {
    void refresh()
  }, [])

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

  const visible = projects?.filter((p) => matchesSearch(p.name, search)) ?? null

  return (
    <AppShell current={{ screen: 'videos' }} title={t('videos.title')}>
      <div className="page-column">
        <div className="page-actions">
          <a className="button-primary" href={routeToHash({ screen: 'templates' })}>
            <Plus size={15} strokeWidth={2} aria-hidden="true" />
            {t('videos.newVideo')}
          </a>
          <button type="button" onClick={() => fileInput.current?.click()}>
            <FileUp size={15} strokeWidth={1.75} aria-hidden="true" />
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
        </div>

        {error && <p className="page-error">{error}</p>}

        {visible === null ? (
          <p className="hint">{t('home.loading')}</p>
        ) : projects?.length === 0 ? (
          <p className="hint">{t('videos.empty')}</p>
        ) : visible.length === 0 ? (
          <p className="hint">{t('search.noResults', { query: search })}</p>
        ) : (
          <div className="tile-grid">
            {visible.map((p) => (
              <div key={p.id} className="tile tile--project">
                <a className="tile-open" href={routeToHash({ screen: 'editor', projectId: p.id })}>
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="tile-art" /> : <span className="tile-art tile-art--empty" />}
                  <span className="tile-title">{p.name}</span>
                  <span className="tile-sub">{t('home.cardMeta', { duration: p.duration, date: dateFormat.format(p.updatedAt) })}</span>
                </a>
                <div className="tile-actions">
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
      </div>
    </AppShell>
  )
}
