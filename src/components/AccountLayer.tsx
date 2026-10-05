import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { copyLocalToCloud, countLocal, dismissLocalCopy, isLocalCopyDone } from '../cloud/copyLocalToCloud'
import { useAuthStore } from '../store/authStore'
import { AuthForm } from './AuthForm'
import { Dialog } from './Dialog'

/** Giriş penceresi: Google / GitHub, e-posta + parola ya da parolasız giriş bağlantısı (`AuthForm`). */
function SignInDialog() {
  const { t } = useTranslation()
  const closeSignIn = useAuthStore((s) => s.closeSignIn)

  return (
    <Dialog title={t('account.signInTitle')} onClose={closeSignIn}>
      <AuthForm intent="signin" autoFocus />
    </Dialog>
  )
}

/** İlk girişte, bu tarayıcıdaki projeleri hesaba kopyalamayı önerir. */
function CopyLocalDialog({ userId, counts, onClose }: { userId: string; counts: { projects: number; assets: number }; onClose: () => void }) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<'ask' | 'copying' | 'done'>('ask')
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState<string>()

  const copy = async () => {
    if (!supabase) return
    setPhase('copying')
    setError(undefined)
    try {
      await copyLocalToCloud(supabase, userId, (done, total) => setProgress({ done, total }))
      setPhase('done')
      // Ekranlar yeni depodan okusun.
      useAuthStore.setState((s) => ({ version: s.version + 1 }))
    } catch (err) {
      setPhase('ask')
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog title={t('account.copyTitle')} onClose={phase === 'copying' ? () => undefined : onClose}>
      {phase === 'done' ? (
        <>
          <p className="modal-text">{t('account.copyDone')}</p>
          <div className="modal-actions">
            <button type="button" className="primary" data-autofocus onClick={onClose}>
              {t('account.close')}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="modal-text">{t('account.copyBody', counts)}</p>
          {phase === 'copying' && <p className="modal-text">{t('account.copying', progress)}</p>}
          {error && (
            <p className="modal-text modal-error" role="alert">
              {t('account.copyFailed', { reason: error })}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              disabled={phase === 'copying'}
              onClick={() => {
                dismissLocalCopy(userId)
                onClose()
              }}
            >
              {t('account.copyNever')}
            </button>
            <button type="button" disabled={phase === 'copying'} onClick={onClose}>
              {t('account.copyLater')}
            </button>
            <button type="button" className="primary" data-autofocus disabled={phase === 'copying'} onClick={() => void copy()}>
              {t('account.copyConfirm')}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}

/** Hesapla ilgili pencereler; uygulamanın kökünde bir kez durur. */
export function AccountLayer() {
  const signInOpen = useAuthStore((s) => s.signInOpen)
  const user = useAuthStore((s) => s.user)
  const [copy, setCopy] = useState<{ userId: string; projects: number; assets: number } | null>(null)
  const userId = user?.id

  // Giriş yapıldığında, bu tarayıcıda kopyalanmamış yerel veri varsa sor.
  useEffect(() => {
    if (!userId || isLocalCopyDone(userId)) return
    let cancelled = false
    void countLocal().then((counts) => {
      if (!cancelled && (counts.projects > 0 || counts.assets > 0)) setCopy({ userId, ...counts })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  return (
    <>
      {signInOpen && <SignInDialog />}
      {copy && <CopyLocalDialog userId={copy.userId} counts={copy} onClose={() => setCopy(null)} />}
    </>
  )
}
