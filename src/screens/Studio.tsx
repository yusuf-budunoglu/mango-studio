import {
  AudioLines,
  Check,
  Clapperboard,
  FileUp,
  Folder as FolderIcon,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Link2,
  MoreHorizontal,
  Plus,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmDialog, NameDialog } from '../components/Dialog'
import { PublishDialog } from '../components/PublishDialog'
import { ShareDialog } from '../components/ShareDialog'
import { StorageMeter } from '../components/StorageMeter'
import { supabase } from '../cloud/client'
import { newId } from '../engine/ids'
import { AppShell } from '../layout/AppShell'
import { projectFromFile } from '../persistence/projectFile'
import { repository, type Folder, type ProjectSummary } from '../persistence/repository'
import { navigate, routeToPath, type StudioView } from '../router'
import { useAuthStore } from '../store/authStore'
import { useProfileStore } from '../store/profileStore'
import { matchesSearch, useUiStore } from '../store/uiStore'
import { inStudioView } from './studioViews'
import { SoundsView } from './StudioSounds'

type Sort = 'edited' | 'name'
const SORT_KEY = 'motion-studio.studio-sort'
/** Sürüklenen projenin id'si bu türle taşınır (başka sürüklemeler klasöre bırakılamaz). */
const DRAG_TYPE = 'application/x-mango-project'

type DialogState =
  | { kind: 'new-folder' }
  | { kind: 'rename-folder'; folder: Folder }
  | { kind: 'delete-folder'; folder: Folder }
  | { kind: 'rename-project'; project: ProjectSummary }
  | { kind: 'delete-project'; project: ProjectSummary }
  | { kind: 'share'; project: ProjectSummary }
  | { kind: 'publish'; project: ProjectSummary }

/** Studio'nun sol menüsündeki bölümler (ilki Tümü). */
const SECTIONS: { view?: StudioView; labelKey: string; icon: LucideIcon }[] = [
  { labelKey: 'studio.all', icon: LayoutGrid },
  { view: 'videos', labelKey: 'studio.views.videos', icon: Clapperboard },
  { view: 'images', labelKey: 'studio.views.images', icon: ImageIcon },
  { view: 'sounds', labelKey: 'studio.views.sounds', icon: AudioLines },
  { view: 'templates', labelKey: 'studio.views.templates', icon: LayoutTemplate },
]

function readSort(): Sort {
  try {
    return localStorage.getItem(SORT_KEY) === 'name' ? 'name' : 'edited'
  } catch {
    return 'edited'
  }
}

/** Dışarı tıklayınca ya da Esc ile kapanan küçük açılır menü. */
function Menu({ label, children, className = '' }: { label: string; children: (close: () => void) => ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={root} className={`menu ${className}`}>
      <button type="button" className="menu-trigger" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={15} strokeWidth={1.75} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({
  project,
  folders,
  dateFormat,
  canShare,
  isAdmin,
  onMove,
  onDuplicate,
  onRename,
  onDelete,
  onShare,
  onTemplate,
  onUse,
  onPublish,
}: {
  project: ProjectSummary
  folders: Folder[]
  dateFormat: Intl.DateTimeFormat
  canShare: boolean
  isAdmin: boolean
  onMove: (folderId: string | undefined) => void
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
  onShare: () => void
  onTemplate: (isTemplate: boolean) => void
  onUse: () => void
  onPublish: () => void
}) {
  const { t } = useTranslation()
  const href = routeToPath({ screen: 'editor', projectId: project.id })
  const vertical = (project.height ?? 0) > (project.width ?? 1)
  return (
    <article
      className="pcard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, project.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
    >
      <a className="pcard-media" href={href} draggable={false}>
        {project.thumbnail ? <img src={project.thumbnail} alt="" draggable={false} className={vertical ? 'is-vertical' : ''} /> : <span className="pcard-empty" />}
      </a>
      <div className="pcard-info">
        {/* video / tasarım (tek kare) */}
        <span className={`pcard-icon${project.mode === 'design' ? ' pcard-icon--design' : ''}`} title={t(project.mode === 'design' ? 'design.badge' : 'studio.video')}>
          {project.mode === 'design' ? <ImageIcon size={12} strokeWidth={2} aria-hidden="true" /> : <Clapperboard size={12} strokeWidth={2} aria-hidden="true" />}
        </span>
        <a className="pcard-text" href={href} draggable={false}>
          <span className="pcard-title">{project.name}</span>
          <span className="pcard-date">
            {dateFormat.format(project.updatedAt)}
            {project.source === 'mcp' && (
              <span className="pcard-tag pcard-tag--claude" title={t('studio.fromClaudeTitle')}>
                <Sparkles size={10} strokeWidth={2} aria-hidden="true" />
                Claude
              </span>
            )}
            {project.shareId && (
              <span className="pcard-tag" title={t('studio.sharedTitle')}>
                <Link2 size={10} strokeWidth={2} aria-hidden="true" />
                {t('studio.shared')}
              </span>
            )}
          </span>
        </a>
        <Menu label={t('studio.menu', { name: project.name })}>
          {(close) => (
            <>
              {project.isTemplate && (
                <button type="button" role="menuitem" onClick={() => (close(), onUse())}>
                  {t('studio.useTemplate')}
                </button>
              )}
              <a role="menuitem" href={href}>
                {t(project.isTemplate ? 'studio.editTemplate' : 'studio.open')}
              </a>
              {canShare && (
                <button type="button" role="menuitem" onClick={() => (close(), onShare())}>
                  {t('studio.share')}
                </button>
              )}
              <button type="button" role="menuitem" onClick={() => (close(), onRename())}>
                {t('studio.rename')}
              </button>
              <button type="button" role="menuitem" onClick={() => (close(), onDuplicate())}>
                {t('studio.duplicate')}
              </button>
              <button type="button" role="menuitem" onClick={() => (close(), onTemplate(!project.isTemplate))}>
                {t(project.isTemplate ? 'studio.unmarkTemplate' : 'studio.saveAsTemplate')}
              </button>
              {isAdmin && (
                <button type="button" role="menuitem" onClick={() => (close(), onPublish())}>
                  {t('studio.publish')}
                </button>
              )}
              <div className="menu-sep" role="separator" />
              <div className="menu-heading">{t('studio.moveTo')}</div>
              <button type="button" role="menuitemradio" aria-checked={!project.folderId} onClick={() => (close(), onMove(undefined))}>
                <LayoutGrid size={13} strokeWidth={1.75} aria-hidden="true" />
                {t('studio.noFolder')}
                {!project.folderId && <Check size={13} strokeWidth={2} className="menu-check" aria-hidden="true" />}
              </button>
              {folders.map((f) => (
                <button key={f.id} type="button" role="menuitemradio" aria-checked={project.folderId === f.id} onClick={() => (close(), onMove(f.id))}>
                  <FolderIcon size={13} strokeWidth={1.75} aria-hidden="true" />
                  <span className="menu-ellipsis">{f.name}</span>
                  {project.folderId === f.id && <Check size={13} strokeWidth={2} className="menu-check" aria-hidden="true" />}
                </button>
              ))}
              <div className="menu-sep" role="separator" />
              <button type="button" role="menuitem" className="menu-danger" onClick={() => (close(), onDelete())}>
                {t('studio.delete')}
              </button>
            </>
          )}
        </Menu>
      </div>
    </article>
  )
}

/**
 * Kullanıcının Studio'su: solda klasörler (Tümü + kullanıcının klasörleri), sağda projeler kart olarak.
 * Projeler klasörlere menüden ya da sürükleyip bırakarak taşınır; klasörler yalnızca düzen içindir.
 */
export function Studio({ folderId, view }: { folderId?: string; view?: StudioView }) {
  const { t, i18n } = useTranslation()
  const canShare = useAuthStore((s) => !!supabase && s.status === 'in')
  const isAdmin = useProfileStore((s) => s.isAdmin)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const search = useUiStore((s) => s.search)
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [sort, setSort] = useState<Sort>(readSort)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = () => Promise.all([repository.list(), repository.listFolders()])
  const refresh = async () => {
    const [list, folderList] = await load()
    setProjects(list)
    setFolders(folderList)
  }

  useEffect(() => {
    let alive = true
    void load().then(([list, folderList]) => {
      if (!alive) return
      setProjects(list)
      setFolders(folderList)
      // silinmiş bir klasörün adresi açıldıysa Tümü'ne dön
      if (folderId && !folderList.some((f) => f.id === folderId)) navigate({ screen: 'studio' })
    })
    return () => {
      alive = false
    }
  }, [folderId, view])

  const changeSort = (value: Sort) => {
    setSort(value)
    try {
      localStorage.setItem(SORT_KEY, value)
    } catch {
      // tercih kaydedilemese de bu oturumda çalışır
    }
  }

  const move = async (projectId: string, target: string | undefined) => {
    await repository.moveToFolder(projectId, target)
    await refresh()
  }

  const duplicate = async (id: string) => {
    const project = await repository.load(id)
    const summary = projects?.find((p) => p.id === id)
    if (!project) return
    const copy = { ...project, id: newId('p'), name: t('home.copyName', { name: project.name }) }
    await repository.save(copy, summary?.thumbnail)
    if (summary?.folderId) await repository.moveToFolder(copy.id, summary.folderId)
    if (summary?.isTemplate) await repository.setTemplate(copy.id, true)
    await refresh()
  }

  // "Şablon olarak kaydet" kopyasını Şablonlarım'a koyar (proje olduğu gibi kalır); "Şablonlardan çıkar" yerinde değiştirir.
  const setTemplate = async (p: ProjectSummary, isTemplate: boolean) => {
    if (!isTemplate) {
      await repository.setTemplate(p.id, false)
      await refresh()
      return
    }
    const project = await repository.load(p.id)
    if (!project) return
    const copy = { ...project, id: newId('p') }
    await repository.save(copy, p.thumbnail)
    await repository.setTemplate(copy.id, true)
    navigate({ screen: 'studio', view: 'templates' })
  }

  // Şablonu kullan: kopyası normal proje olarak editörde açılır, şablon değişmez.
  const startFromTemplate = async (p: ProjectSummary) => {
    const project = await repository.load(p.id)
    if (!project) return
    const copy = { ...project, id: newId('p') }
    await repository.save(copy, p.thumbnail)
    navigate({ screen: 'editor', projectId: copy.id })
  }

  const importFile = async (file: File) => {
    setError(null)
    try {
      const project = await projectFromFile(await file.text())
      await repository.save(project)
      if (folderId) await repository.moveToFolder(project.id, folderId)
      navigate({ screen: 'editor', projectId: project.id })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const closeDialog = () => setDialog(null)
  const runDialog = async (action: () => Promise<unknown>) => {
    await action()
    setDialog(null)
    await refresh()
  }

  const folder = folders.find((f) => f.id === folderId)
  const section = SECTIONS.find((sec) => sec.view === view) ?? SECTIONS[0]
  const inView = (projects ?? []).filter((p) => (folderId ? p.folderId === folderId : inStudioView(p, view)) && matchesSearch(p.name, search))
  const visible = sort === 'name' ? [...inView].sort((a, b) => a.name.localeCompare(b.name, i18n.language)) : inView

  // Klasöre bırakma: yalnızca proje kartı sürüklenirken kabul et.
  const dropProps = (target: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropTarget(target)
    },
    onDragLeave: () => setDropTarget((current) => (current === target ? null : current)),
    onDrop: (e: DragEvent) => {
      const id = e.dataTransfer.getData(DRAG_TYPE)
      setDropTarget(null)
      if (!id) return
      e.preventDefault()
      if (target === 'templates') {
        const p = projects?.find((x) => x.id === id)
        if (p && !p.isTemplate) void setTemplate(p, true)
        return
      }
      void move(id, target === 'all' ? undefined : target)
    },
  })

  const empty = projects !== null && visible.length === 0
  const title = folder?.name ?? t(section.labelKey)
  const emptyKey = folderId ? 'folder' : (view ?? 'all')
  const SectionIcon = section.icon

  return (
    <AppShell current={{ screen: 'studio' }} title={t('studio.title')}>
      <div className="studio">
        <nav className="studio-nav" aria-label={t('studio.projects')}>
          <div className="studio-nav-heading">{t('studio.title')}</div>
          {SECTIONS.map((sec) => {
            const active = !folderId && view === sec.view
            const Icon = sec.icon
            const target = sec.view ?? 'all'
            // proje bırakılınca: Tümü klasörden çıkarır, Şablonlarım şablon kopyası yapar
            const drop = target === 'all' || target === 'templates' ? dropProps(target) : {}
            return (
              <a
                key={sec.labelKey}
                className={`studio-nav-item${active ? ' is-active' : ''}${dropTarget === target ? ' is-drop' : ''}`}
                href={routeToPath({ screen: 'studio', view: sec.view })}
                aria-current={active ? 'page' : undefined}
                {...drop}
              >
                <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
                <span className="studio-nav-label">{t(sec.labelKey)}</span>
              </a>
            )
          })}
          <div className="studio-nav-heading studio-nav-heading--sub">{t('studio.folders')}</div>
          {folders.map((f) => (
            <div key={f.id} className={`studio-nav-row${folderId === f.id ? ' is-active' : ''}${dropTarget === f.id ? ' is-drop' : ''}`} {...dropProps(f.id)}>
              <a className="studio-nav-item" href={routeToPath({ screen: 'studio', folderId: f.id })} aria-current={folderId === f.id ? 'page' : undefined}>
                {folderId === f.id ? <FolderOpen size={15} strokeWidth={1.75} aria-hidden="true" /> : <FolderIcon size={15} strokeWidth={1.75} aria-hidden="true" />}
                <span className="studio-nav-label">{f.name}</span>
              </a>
              <Menu label={t('studio.folderMenu', { name: f.name })} className="studio-nav-menu">
                {(close) => (
                  <>
                    <button type="button" role="menuitem" onClick={() => (close(), setDialog({ kind: 'rename-folder', folder: f }))}>
                      {t('studio.rename')}
                    </button>
                    <button type="button" role="menuitem" className="menu-danger" onClick={() => (close(), setDialog({ kind: 'delete-folder', folder: f }))}>
                      {t('studio.delete')}
                    </button>
                  </>
                )}
              </Menu>
            </div>
          ))}
          <button type="button" className="studio-nav-item studio-nav-add" onClick={() => setDialog({ kind: 'new-folder' })}>
            <Plus size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="studio-nav-label">{t('studio.newFolder')}</span>
          </button>
          <StorageMeter />
        </nav>

        {view === 'sounds' && !folderId ? (
          <SoundsView />
        ) : (
        <section className="studio-main" aria-label={title}>
          <div className="studio-bar">
            <a className="button-primary" href={routeToPath({ screen: 'new', folderId })}>
              <Plus size={15} strokeWidth={2} aria-hidden="true" />
              {t('studio.newProject')}
            </a>
            <button type="button" className="studio-bar-button" onClick={() => fileInput.current?.click()}>
              <FileUp size={14} strokeWidth={1.75} aria-hidden="true" />
              {t('studio.openFile')}
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
            <label className="studio-sort">
              <span className="visually-hidden">{t('studio.sortLabel')}</span>
              <select value={sort} onChange={(e) => changeSort(e.target.value as Sort)}>
                <option value="edited">{t('studio.sort.edited')}</option>
                <option value="name">{t('studio.sort.name')}</option>
              </select>
            </label>
          </div>

          {error && <p className="page-error">{error}</p>}

          {projects === null ? (
            <p className="hint">{t('studio.loading')}</p>
          ) : empty && search.trim() ? (
            <p className="hint">{t('search.noResults', { query: search })}</p>
          ) : empty ? (
            <div className="studio-empty">
              <span className="studio-empty-icon" aria-hidden="true">
                {folderId ? <FolderOpen size={20} strokeWidth={1.5} /> : <SectionIcon size={20} strokeWidth={1.5} />}
              </span>
              <h2>{t(`studio.empty.${emptyKey}.title`)}</h2>
              <p>{t(`studio.empty.${emptyKey}.body`)}</p>
              <a className="button-primary" href={routeToPath({ screen: 'new', folderId })}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                {t('studio.newProject')}
              </a>
            </div>
          ) : (
            <div className="pcard-grid">
              {visible.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  folders={folders}
                  dateFormat={dateFormat}
                  onMove={(target) => void move(p.id, target)}
                  onDuplicate={() => void duplicate(p.id)}
                  onRename={() => setDialog({ kind: 'rename-project', project: p })}
                  onDelete={() => setDialog({ kind: 'delete-project', project: p })}
                  canShare={canShare}
                  isAdmin={isAdmin}
                  onShare={() => setDialog({ kind: 'share', project: p })}
                  onTemplate={(on) => void setTemplate(p, on)}
                  onUse={() => void startFromTemplate(p)}
                  onPublish={() => setDialog({ kind: 'publish', project: p })}
                />
              ))}
            </div>
          )}
        </section>
        )}
      </div>

      {dialog?.kind === 'new-folder' && (
        <NameDialog
          title={t('studio.folderDialog.title')}
          placeholder={t('studio.folderDialog.placeholder')}
          submitLabel={t('studio.folderDialog.create')}
          onClose={closeDialog}
          onSubmit={(name) =>
            void runDialog(async () => {
              const created = await repository.createFolder(name)
              navigate({ screen: 'studio', folderId: created.id })
            })
          }
        />
      )}
      {dialog?.kind === 'rename-folder' && (
        <NameDialog
          title={t('studio.folderDialog.renameTitle')}
          placeholder={t('studio.folderDialog.placeholder')}
          submitLabel={t('studio.folderDialog.save')}
          initial={dialog.folder.name}
          onClose={closeDialog}
          onSubmit={(name) => void runDialog(() => repository.renameFolder(dialog.folder.id, name))}
        />
      )}
      {dialog?.kind === 'delete-folder' && (
        <ConfirmDialog
          title={t('studio.deleteFolderDialog.title', { name: dialog.folder.name })}
          body={t('studio.deleteFolderDialog.body')}
          confirmLabel={t('studio.deleteFolderDialog.confirm')}
          onClose={closeDialog}
          onConfirm={() =>
            void runDialog(async () => {
              await repository.removeFolder(dialog.folder.id)
              if (folderId === dialog.folder.id) navigate({ screen: 'studio' })
            })
          }
        />
      )}
      {dialog?.kind === 'rename-project' && (
        <NameDialog
          title={t('studio.renameDialog.title')}
          placeholder={t('studio.renameDialog.placeholder')}
          submitLabel={t('studio.renameDialog.save')}
          initial={dialog.project.name}
          onClose={closeDialog}
          onSubmit={(name) => void runDialog(() => repository.rename(dialog.project.id, name))}
        />
      )}
      {dialog?.kind === 'delete-project' && (
        <ConfirmDialog
          title={t('studio.deleteDialog.title', { name: dialog.project.name })}
          body={t('studio.deleteDialog.body')}
          confirmLabel={t('studio.deleteDialog.confirm')}
          onClose={closeDialog}
          onConfirm={() => void runDialog(() => repository.remove(dialog.project.id))}
        />
      )}
      {dialog?.kind === 'share' && <ShareDialog projectId={dialog.project.id} name={dialog.project.name} onClose={closeDialog} onChange={() => void refresh()} />}
      {dialog?.kind === 'publish' && <PublishDialog projectId={dialog.project.id} name={dialog.project.name} onClose={closeDialog} />}
    </AppShell>
  )
}
