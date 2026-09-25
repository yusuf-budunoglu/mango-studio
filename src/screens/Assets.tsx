import { Film, Music, PenTool, Upload, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppShell } from '../layout/AppShell'
import { assetRef, assets, resolveAssetUrl, type AssetKind, type AssetMeta } from '../persistence/assets'
import { collectAssetRefs } from '../persistence/projectFile'
import { repository } from '../persistence/repository'
import { storeFile } from '../persistence/storeFile'
import { matchesSearch, useUiStore } from '../store/uiStore'

const KIND_ICON: Record<Exclude<AssetKind, 'image'>, LucideIcon> = { audio: Music, video: Film, svg: PenTool }

function kindOf(file: File): AssetKind | null {
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) return 'svg'
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('audio/')) return 'audio'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

const formatSize = (bytes: number) => (bytes > 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`)

function Preview({ asset }: { asset: AssetMeta }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (asset.kind === 'image' || asset.kind === 'svg') void resolveAssetUrl(assetRef(asset.id)).then(setUrl)
  }, [asset])
  if (url) return <img className="tile-art tile-art--contain" src={url} alt="" />
  const Icon = asset.kind === 'image' ? PenTool : KIND_ICON[asset.kind]
  return (
    <span className="tile-art tile-art--icon">
      <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
    </span>
  )
}

/** Dosya kütüphanesi: yüklenen görsel, ses, video ve SVG'ler; hangi projede kullanıldığı. */
export function Assets() {
  const { t, i18n } = useTranslation()
  const search = useUiStore((s) => s.search)
  const [list, setList] = useState<AssetMeta[] | null>(null)
  const [usage, setUsage] = useState<Record<string, number>>({})
  const [confirm, setConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  // Dosyalar ve hangisinin kaç projede geçtiği (tüm projeler taranır).
  const load = async () => {
    const counts: Record<string, number> = {}
    for (const summary of await repository.list()) {
      const project = await repository.load(summary.id).catch(() => undefined)
      if (!project) continue
      for (const ref of collectAssetRefs(project)) counts[ref] = (counts[ref] ?? 0) + 1
    }
    return { files: await assets.list(), counts }
  }
  const refresh = () =>
    load().then(({ files, counts }) => {
      setList(files)
      setUsage(counts)
    })
  useEffect(() => {
    void load().then(({ files, counts }) => {
      setList(files)
      setUsage(counts)
    })
  }, [])

  const upload = async (files: FileList) => {
    setError(null)
    for (const file of Array.from(files)) {
      const kind = kindOf(file)
      if (!kind) {
        setError(t('assetsPage.unsupported', { name: file.name }))
        continue
      }
      await storeFile(file, kind)
    }
    await refresh()
  }

  const visible = list?.filter((a) => matchesSearch(a.name, search)) ?? null

  return (
    <AppShell current={{ screen: 'assets' }} title={t('nav.assets')}>
      <div className="page-column">
        <div className="page-actions">
          <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
            <Upload size={15} strokeWidth={2} aria-hidden="true" />
            {t('assetsPage.upload')}
          </button>
          <input
            ref={fileInput}
            id="assets-upload"
            type="file"
            multiple
            accept="image/*,audio/*,video/*,.svg"
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void upload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        <p className="hint">{t('assetsPage.hint')}</p>
        {error && <p className="page-error">{error}</p>}
        {visible === null ? (
          <p className="hint">{t('home.loading')}</p>
        ) : list?.length === 0 ? (
          <p className="hint">{t('assetsPage.empty')}</p>
        ) : visible.length === 0 ? (
          <p className="hint">{t('search.noResults', { query: search })}</p>
        ) : (
          <div className="tile-grid">
            {visible.map((a) => {
              const used = usage[assetRef(a.id)] ?? 0
              return (
                <div key={a.id} className="tile tile--project">
                  <Preview asset={a} />
                  <span className="tile-title" title={a.name}>
                    {a.name}
                  </span>
                  <span className="tile-sub">
                    {t(`assetsPage.kinds.${a.kind}`)} · {formatSize(a.size)}
                    {a.duration ? ` · ${a.duration.toFixed(1)} s` : ''} · {dateFormat.format(a.createdAt)}
                  </span>
                  <span className="tile-sub">{used ? t('assetsPage.usedIn', { count: used }) : t('assetsPage.unused')}</span>
                  <div className="tile-actions">
                    {confirm === a.id ? (
                      <>
                        <button
                          type="button"
                          className="danger"
                          onClick={async () => {
                            await assets.remove(a.id)
                            setConfirm(null)
                            await refresh()
                          }}
                        >
                          {t('home.confirmDelete')}
                        </button>
                        <button type="button" onClick={() => setConfirm(null)}>
                          {t('common.cancel')}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="danger" onClick={() => setConfirm(a.id)}>
                        {t('home.delete')}
                      </button>
                    )}
                  </div>
                  {confirm === a.id && used > 0 && <span className="tile-warning">{t('assetsPage.deleteWarning', { count: used })}</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppShell>
  )
}
