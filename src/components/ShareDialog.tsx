import { Check, Copy, Link2, Link2Off } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { repository } from '../persistence/repository'
import { shareUrl } from '../project/sharing'
import { useAuthStore } from '../store/authStore'
import { Dialog } from './Dialog'

/**
 * Paylaş penceresi (editörün sağ üstü ve Studio kartının menüsü): bağlantıyı açar, kopyalatır ya da kapatır.
 * Bağlantıyı bilen herkes projeyi izleyebilir ve üyeyse kendi Studio'suna kopyalayabilir; düzenleyemez.
 */
export function ShareDialog({ projectId, name, onClose, onChange }: { projectId: string; name: string; onClose: () => void; onChange?: (shareId: string | undefined) => void }) {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => !!supabase && s.status === 'in')
  const [shareId, setShareId] = useState<string | undefined>()
  const [state, setState] = useState<'loading' | 'ready' | 'busy' | 'error'>('loading')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let alive = true
    void repository.list().then((list) => {
      if (!alive) return
      setShareId(list.find((p) => p.id === projectId)?.shareId)
      setState('ready')
    }, () => alive && setState('error'))
    return () => {
      alive = false
    }
  }, [projectId, signedIn])

  const run = async (action: () => Promise<string | undefined>) => {
    setState('busy')
    try {
      const next = await action()
      setShareId(next)
      onChange?.(next)
      setState('ready')
    } catch {
      setState('error')
    }
  }

  const link = shareId ? shareUrl(shareId) : ''
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      // pano izni yoksa kullanıcı kutudan seçip kopyalar
    }
  }

  return (
    <Dialog title={t('share.title', { name })} onClose={onClose}>
      {!signedIn ? (
        <p className="modal-text">{t('share.needsAccount')}</p>
      ) : state === 'loading' ? (
        <p className="modal-text">{t('studio.loading')}</p>
      ) : shareId ? (
        <div className="share">
          <p className="modal-text">{t('share.onBody')}</p>
          <div className="share-link">
            <input className="modal-input" readOnly value={link} aria-label={t('share.link')} onFocus={(e) => e.currentTarget.select()} data-autofocus />
            <button type="button" className="primary" onClick={() => void copy()}>
              {copied ? <Check size={14} strokeWidth={2} aria-hidden="true" /> : <Copy size={14} strokeWidth={2} aria-hidden="true" />}
              {copied ? t('share.copied') : t('share.copy')}
            </button>
          </div>
          <div className="modal-actions">
            <button type="button" className="share-off" disabled={state === 'busy'} onClick={() => void run(async () => (await repository.unshare(projectId), undefined))}>
              <Link2Off size={14} strokeWidth={1.75} aria-hidden="true" />
              {t('share.turnOff')}
            </button>
          </div>
        </div>
      ) : (
        <div className="share">
          <p className="modal-text">{t('share.offBody')}</p>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="button" className="primary" data-autofocus disabled={state === 'busy'} onClick={() => void run(() => repository.share(projectId))}>
              <Link2 size={14} strokeWidth={2} aria-hidden="true" />
              {t('share.turnOn')}
            </button>
          </div>
        </div>
      )}
      {state === 'error' && <p className="page-error">{t('share.error')}</p>}
    </Dialog>
  )
}
