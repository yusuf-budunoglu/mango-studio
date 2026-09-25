import { useEffect, useRef, useState } from 'react'
import { navigate } from '../router'
import { newId } from '../engine/ids'
import { parseProjectFile, repository, type ProjectSummary } from '../persistence/repository'
import { TEMPLATES } from '../project/templates'

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })

export function Home() {
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
    await repository.save({ ...project, id: newId('p'), name: `${project.name} (kopya)` })
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
            Dosyadan aç…
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
      </header>

      <main className="home-main">
        {error && <p className="home-error">{error}</p>}

        <section>
          <h1>Yeni video</h1>
          <p className="hint">Bir şablonla başlayın; metinleri, görselleri ve zamanlamayı sonra değiştirirsiniz.</p>
          <div className="card-grid">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className="card template-card" onClick={() => void createFrom(t.id)}>
                <span className="card-art" style={{ background: `radial-gradient(circle at 30% 30%, ${t.accent}, #0b0e13 75%)` }} />
                <span className="card-title">{t.name}</span>
                <span className="card-sub">{t.description}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h1>Projelerim</h1>
          {projects === null ? (
            <p className="hint">Yükleniyor…</p>
          ) : projects.length === 0 ? (
            <p className="hint">Henüz proje yok. Yukarıdan bir şablon seçin.</p>
          ) : (
            <div className="card-grid">
              {projects.map((p) => (
                <div key={p.id} className="card project-card">
                  <button type="button" className="card-open" onClick={() => navigate({ screen: 'editor', projectId: p.id })}>
                    {p.thumbnail ? <img src={p.thumbnail} alt="" className="card-art" /> : <span className="card-art card-art--empty" />}
                    <span className="card-title">{p.name}</span>
                    <span className="card-sub">
                      {p.duration} sn · {dateFormat.format(p.updatedAt)}
                    </span>
                  </button>
                  <div className="card-actions">
                    <button type="button" onClick={() => void duplicate(p.id)}>
                      Çoğalt
                    </button>
                    {confirmDelete === p.id ? (
                      <>
                        <button type="button" className="danger" onClick={() => void remove(p.id)}>
                          Evet, sil
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)}>
                          Vazgeç
                        </button>
                      </>
                    ) : (
                      <button type="button" className="danger" onClick={() => setConfirmDelete(p.id)}>
                        Sil
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
