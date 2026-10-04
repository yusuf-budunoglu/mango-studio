import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { publishTemplate } from '../project/publishedTemplates'
import { navigate } from '../router'
import { Dialog } from './Dialog'

/**
 * Yönetici: Studio'daki bir projeyi sitenin Şablonlar sayfasına genel şablon olarak yayınlar.
 * Pencere yalnızca yöneticiye gösterilir; yetkiyi asıl denetleyen sunucudur (RLS).
 */
export function PublishDialog({ projectId, name, onClose }: { projectId: string; name: string; onClose: () => void }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(name)
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const poster = useRef<HTMLInputElement>(null)
  const loop = useRef<HTMLInputElement>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const id = await publishTemplate({
        projectId,
        name: title.trim(),
        description: description.trim(),
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 8),
        poster: poster.current?.files?.[0],
        loop: loop.current?.files?.[0],
      })
      navigate({ screen: 'template', templateId: id })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Dialog title={t('publish.title')} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (title.trim() && !busy) void submit()
        }}
      >
        <p className="modal-text">{t('publish.body')}</p>
        <label className="modal-field">
          <span>{t('publish.name')}</span>
          <input className="modal-input" data-autofocus value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="modal-field">
          <span>{t('publish.description')}</span>
          <textarea className="modal-input" rows={3} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="modal-field">
          <span>{t('publish.tags')}</span>
          <input className="modal-input" value={tags} placeholder={t('publish.tagsPlaceholder')} onChange={(e) => setTags(e.target.value)} />
        </label>
        <label className="modal-field">
          <span>{t('publish.poster')}</span>
          <input ref={poster} type="file" accept="image/jpeg,image/png" />
        </label>
        <label className="modal-field">
          <span>{t('publish.loop')}</span>
          <input ref={loop} type="file" accept="video/mp4,video/webm" />
        </label>
        {error && <p className="page-error">{t('publish.error', { message: error })}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!title.trim() || busy}>
            {busy ? t('publish.publishing') : t('publish.submit')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
