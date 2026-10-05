import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AppShell } from '../layout/AppShell'
import { navigate, routeToPath } from '../router'
import { MIN_PASSWORD_LENGTH, useAuthStore } from '../store/authStore'

/**
 * Yeni parola belirleme (`/reset-password`): e-postadaki sıfırlama bağlantısı kullanıcıyı giriş yapmış olarak
 * buraya getirir. Giriş yapmış herkes buradan parola belirleyebilir (bağlantıyla ya da Google/GitHub ile üye olan da).
 * Oturum yoksa bağlantının süresi dolmuştur: yeniden istemesi söylenir.
 */
export function ResetPassword() {
  const { t } = useTranslation()
  const signedIn = useAuthStore((s) => s.status === 'in')
  const email = useAuthStore((s) => s.user?.email)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const openSignIn = useAuthStore((s) => s.openSignIn)
  const [password, setPassword] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle')
  const [error, setError] = useState<string>()

  const submit = async () => {
    if (state === 'saving') return
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('account.errorWeakPassword', { count: MIN_PASSWORD_LENGTH }))
    setState('saving')
    setError(undefined)
    try {
      await updatePassword(password)
      setState('done')
    } catch (err) {
      setState('idle')
      const message = err instanceof Error ? err.message.toLowerCase() : ''
      setError(message.includes('different') ? t('account.errorSamePassword') : message.includes('password') ? t('account.errorWeakPassword', { count: MIN_PASSWORD_LENGTH }) : t('account.errorGeneric'))
    }
  }

  return (
    <AppShell current={{ screen: 'reset' }} title={t('account.resetTitle')} bare>
      <div className="consent">
        <section className="signup-card consent-card" aria-labelledby="reset-title">
          <img className="consent-mark" src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          <h1 id="reset-title">{t('account.resetTitle')}</h1>
          {!signedIn ? (
            <>
              <p className="signup-lead">{t('account.resetExpired')}</p>
              <button type="button" className="x-btn x-btn--accent" onClick={openSignIn}>
                {t('account.signIn')}
              </button>
            </>
          ) : state === 'done' ? (
            <>
              <p className="signup-lead" role="status">
                {t('account.resetDone')}
              </p>
              <button type="button" className="x-btn x-btn--accent" onClick={() => navigate({ screen: 'studio' })}>
                {t('account.resetContinue')}
              </button>
            </>
          ) : (
            <>
              <p className="signup-lead">{t('account.resetBody', { email: email ?? '' })}</p>
              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void submit()
                }}
              >
                {/* parola yöneticileri hangi hesabın parolası olduğunu bilsin */}
                <input type="email" name="email" autoComplete="username" value={email ?? ''} readOnly hidden />
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  maxLength={72}
                  value={password}
                  placeholder={t('account.newPasswordPlaceholder', { count: MIN_PASSWORD_LENGTH })}
                  aria-label={t('account.passwordLabel')}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {error && (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                )}
                <button type="submit" className="x-btn x-btn--accent auth-submit" disabled={!password || state === 'saving'}>
                  {state === 'saving' ? t('account.sending') : t('account.resetSave')}
                </button>
              </form>
            </>
          )}
          <a className="signup-back" href={routeToPath({ screen: 'home' })}>
            {t('oauth.home')}
          </a>
        </section>
      </div>
    </AppShell>
  )
}
