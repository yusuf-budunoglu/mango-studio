import { AudioLines, Pause, Play, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '../billing/plans'
import { assetRef, assets, resolveAssetUrl, StorageQuotaError, type AssetMeta } from '../persistence/assets'
import { storeFile } from '../persistence/storeFile'
import { routeToPath } from '../router'
import { useProfileStore } from '../store/profileStore'
import { matchesSearch, useUiStore } from '../store/uiStore'

const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/**
 * Studio → Sesler: kullanıcının yüklediği ses dosyaları (müzik, ses efekti). Dinle, yükle, sil.
 * Editörde Ses sekmesinden projeye eklenir. Konuşma/seslendirme ayrımı yok: hepsi dosya.
 */
export function SoundsView() {
  const { t, i18n } = useTranslation()
  const search = useUiStore((s) => s.search)
  const [list, setList] = useState<AssetMeta[] | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [quotaFull, setQuotaFull] = useState(false)
  const [confirm, setConfirm] = useState<string | null>(null)
  const player = useRef<HTMLAudioElement | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  const refresh = () => assets.list().then((all) => setList(all.filter((a) => a.kind === 'audio')))
  useEffect(() => {
    void refresh()
    return () => player.current?.pause()
  }, [])

  const toggle = async (a: AssetMeta) => {
    if (playing === a.id) {
      player.current?.pause()
      setPlaying(null)
      return
    }
    const url = await resolveAssetUrl(assetRef(a.id))
    if (!url) return
    player.current?.pause()
    const audio = new Audio(url)
    audio.onended = () => setPlaying((id) => (id === a.id ? null : id))
    player.current = audio
    setPlaying(a.id)
    void audio.play().catch(() => setPlaying(null))
  }

  const upload = async (files: FileList) => {
    setError(null)
    setQuotaFull(false)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/')) {
        setError(t('assetsPage.unsupported', { name: file.name }))
        continue
      }
      try {
        await storeFile(file, 'audio')
      } catch (err) {
        if (err instanceof StorageQuotaError) setQuotaFull(true)
        else setError(err instanceof Error ? err.message : String(err))
        break
      }
    }
    await refresh()
    void useProfileStore.getState().refreshStorage()
  }

  const remove = async (id: string) => {
    if (playing === id) player.current?.pause()
    await assets.remove(id)
    setConfirm(null)
    await refresh()
    void useProfileStore.getState().refreshStorage()
  }

  const visible = list?.filter((a) => matchesSearch(a.name, search)) ?? null

  return (
    <section className="studio-main" aria-label={t('studio.views.sounds')}>
      <div className="studio-bar">
        <button type="button" className="button-primary" onClick={() => fileInput.current?.click()}>
          <Upload size={15} strokeWidth={2} aria-hidden="true" />
          {t('studio.sounds.upload')}
        </button>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="audio/*"
          hidden
          onChange={(e) => {
            if (e.target.files?.length) void upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>
      {quotaFull && (
        <p className="page-error">
          {t('storage.uploadBlocked')} <a href={routeToPath({ screen: 'pricing' })}>{t('storage.upgrade')}</a>
        </p>
      )}
      {error && <p className="page-error">{error}</p>}
      {visible === null ? (
        <p className="hint">{t('studio.loading')}</p>
      ) : list?.length === 0 ? (
        <div className="studio-empty">
          <span className="studio-empty-icon" aria-hidden="true">
            <AudioLines size={20} strokeWidth={1.5} />
          </span>
          <h2>{t('studio.empty.sounds.title')}</h2>
          <p>{t('studio.empty.sounds.body')}</p>
        </div>
      ) : visible.length === 0 ? (
        <p className="hint">{t('search.noResults', { query: search })}</p>
      ) : (
        <ul className="sound-list">
          {visible.map((a) => (
            <li key={a.id} className={`sound-row${playing === a.id ? ' is-playing' : ''}`}>
              <button type="button" className="sound-play" onClick={() => void toggle(a)} aria-label={t(playing === a.id ? 'studio.sounds.pause' : 'studio.sounds.play', { name: a.name })}>
                {playing === a.id ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
              </button>
              <span className="sound-name" title={a.name}>
                {a.name}
              </span>
              <span className="sound-meta">{a.duration ? formatDuration(a.duration) : '–'}</span>
              <span className="sound-meta">{formatBytes(a.size, i18n.language)}</span>
              <span className="sound-meta sound-date">{dateFormat.format(a.createdAt)}</span>
              {confirm === a.id ? (
                <span className="sound-confirm">
                  <button type="button" className="danger" onClick={() => void remove(a.id)}>
                    {t('home.confirmDelete')}
                  </button>
                  <button type="button" onClick={() => setConfirm(null)}>
                    {t('common.cancel')}
                  </button>
                </span>
              ) : (
                <button type="button" className="sound-delete" onClick={() => setConfirm(a.id)} aria-label={t('studio.sounds.delete', { name: a.name })}>
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
