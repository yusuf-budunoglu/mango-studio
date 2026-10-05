import { Mail } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { routeToPath } from '../router'
import { AUTH_PROVIDERS, MIN_PASSWORD_LENGTH, useAuthStore, type AuthProvider } from '../store/authStore'
import { GoogleButton } from './GoogleButton'

const COOLDOWN_SECONDS = 60
/** Google istemci kimliği (herkese açık değer; Supabase'deki Google sağlayıcısında da kayıtlı olmalı). */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

/** `signin` / `signup`: e-posta + parola; `link`: parolasız giriş bağlantısı; `forgot`: parola sıfırlama bağlantısı. */
type Mode = 'signin' | 'signup' | 'link' | 'forgot'
type Sent = { kind: 'confirm' | 'link' | 'reset'; email: string }

const PROVIDER_ICONS: Record<AuthProvider, ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.800 3.300-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.500-1 7.300-2.700l-3.600-2.700c-1 .700-2.300 1.100-3.700 1.100-2.900 0-5.300-1.900-6.200-4.500H2.100v2.800A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.800 14.200a6.600 6.600 0 0 1 0-4.400V7H2.100a11 11 0 0 0 0 10l3.700-2.800z" />
      <path fill="#EA4335" d="M12 5.300c1.600 0 3.100.6 4.200 1.700l3.200-3.200A11 11 0 0 0 2.100 7l3.700 2.800C6.700 7.200 9.100 5.300 12 5.300z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1.500a10.500 10.500 0 0 0-3.300 20.500c.5.1.7-.2.7-.5v-1.900c-2.900.6-3.500-1.300-3.500-1.300-.5-1.200-1.200-1.500-1.200-1.500-1-.6.1-.6.1-.6 1 .1 1.600 1.100 1.600 1.100.9 1.600 2.500 1.100 3.100.9.1-.7.4-1.100.7-1.400-2.300-.3-4.800-1.200-4.800-5.200 0-1.100.4-2.100 1.100-2.800-.1-.3-.5-1.300.1-2.800 0 0 .9-.3 2.900 1.100a10 10 0 0 1 5.200 0c2-1.400 2.900-1.100 2.900-1.100.6 1.500.2 2.500.1 2.800.7.700 1.100 1.700 1.100 2.800 0 4-2.500 4.900-4.800 5.200.4.300.7 1 .7 2v2.900c0 .3.2.6.7.5A10.500 10.500 0 0 0 12 1.500z"
      />
    </svg>
  ),
}

let providersRequest: Promise<AuthProvider[]> | undefined

/** Supabase'de açık olan sağlayıcılar (herkese açık ayar ucu): panelden açılınca düğmesi kendiliğinden görünür. */
function enabledProviders(): Promise<AuthProvider[]> {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key) return Promise.resolve([])
  providersRequest ??= fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
    .then((res) => (res.ok ? (res.json() as Promise<{ external?: Record<string, boolean> }>) : {}))
    .then((settings: { external?: Record<string, boolean> }) => AUTH_PROVIDERS.filter((p) => settings.external?.[p]))
    .catch(() => {
      providersRequest = undefined
      return []
    })
  return providersRequest
}

/**
 * Giriş / üyelik formu (giriş penceresi ve üyelik sayfası paylaşır): Google ve GitHub düğmeleri, e-posta + parola,
 * parolasız giriş bağlantısı ve parola sıfırlama. Başarılı girişte pencereyi `authStore` kapatır.
 */
export function AuthForm({ intent, autoFocus = false }: { intent: 'signin' | 'signup'; autoFocus?: boolean }) {
  const { t } = useTranslation()
  const auth = useAuthStore()
  const [mode, setMode] = useState<Mode>(intent)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState<Sent>()
  const [wait, setWait] = useState(0)
  const [providers, setProviders] = useState<AuthProvider[]>([])

  useEffect(() => {
    let cancelled = false
    void enabledProviders().then((list) => {
      if (!cancelled) setProviders(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  // Google düğmesi kendi çerçevesinde çalışır; hata buraya bildirilir (sabit işlev: düğme yeniden kurulmasın).
  const showError = useCallback(() => setError(t('account.errorGeneric')), [t])

  if (!supabase) return null

  const trimmed = email.trim()
  const needsPassword = mode === 'signin' || mode === 'signup'
  const switchTo = (next: Mode) => {
    setMode(next)
    setError(undefined)
  }

  const explain = (err: unknown) => {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    if (message.includes('rate') || message.includes('security purposes')) return t('account.errorRateLimit')
    if (message.includes('invalid login')) return t('account.errorCredentials')
    if (message.includes('not confirmed')) return t('account.errorUnconfirmed')
    if (message.includes('password')) return t('account.errorWeakPassword', { count: MIN_PASSWORD_LENGTH })
    if (message.includes('invalid')) return t('account.errorInvalid')
    return t('account.errorGeneric')
  }

  const run = async (action: () => Promise<Sent | void>) => {
    if (busy) return
    setBusy(true)
    setError(undefined)
    try {
      const result = await action()
      if (result) {
        setSent(result)
        setWait(COOLDOWN_SECONDS)
      }
    } catch (err) {
      setError(explain(err))
    } finally {
      setBusy(false)
    }
  }

  const submit = () => {
    if (!trimmed || wait > 0) return
    if (mode === 'signup' && password.length < MIN_PASSWORD_LENGTH) return setError(t('account.errorWeakPassword', { count: MIN_PASSWORD_LENGTH }))
    void run(async () => {
      if (mode === 'signin') return auth.signInWithPassword(trimmed, password)
      if (mode === 'signup') return (await auth.signUpWithPassword(trimmed, password)) === 'confirm' ? { kind: 'confirm', email: trimmed } : undefined
      if (mode === 'link') {
        await auth.sendMagicLink(trimmed)
        return { kind: 'link', email: trimmed }
      }
      await auth.sendPasswordReset(trimmed)
      return { kind: 'reset', email: trimmed }
    })
  }

  if (sent) {
    return (
      <div className="auth">
        <div className="auth-sent" role="status">
          <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
          <div>
            <strong>{t('account.linkSentTitle')}</strong>
            <p>{t(`account.sent.${sent.kind}`, { email: sent.email })}</p>
            <div className="auth-links">
              <button type="button" onClick={() => setSent(undefined)}>
                {t('account.useOtherEmail')}
              </button>
              {sent.kind !== 'confirm' && (
                <button type="button" disabled={wait > 0 || busy} onClick={submit}>
                  {wait > 0 ? t('account.resendIn', { seconds: wait }) : t('account.sendAgain')}
                </button>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const submitLabel = { signin: 'account.signIn', signup: 'account.createAccount', link: 'account.sendLink', forgot: 'account.sendReset' }[mode]

  return (
    <div className="auth">
      {providers.length > 0 && mode !== 'forgot' && (
        <>
          <div className="auth-providers">
            {providers.map((provider) => {
              const button = (
                <button key={provider} type="button" className="auth-provider" disabled={busy} onClick={() => void run(() => auth.signInWithProvider(provider))}>
                  {PROVIDER_ICONS[provider]}
                  {t(`account.continueWith.${provider}`)}
                </button>
              )
              // Google: kendi düğmesiyle (onay ekranında bizim alan adımız görünür); istemci kimliği yoksa yönlendirmeli akış.
              return provider === 'google' && GOOGLE_CLIENT_ID ? <GoogleButton key={provider} clientId={GOOGLE_CLIENT_ID} onError={showError} fallback={button} /> : button
            })}
          </div>
          <p className="auth-divider">{t('account.or')}</p>
        </>
      )}

      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {mode === 'link' && <p className="auth-hint">{t('account.signInBody')}</p>}
        {mode === 'forgot' && <p className="auth-hint">{t('account.forgotBody')}</p>}
        <input
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          required
          data-autofocus={autoFocus ? '' : undefined}
          value={email}
          placeholder={t('account.emailPlaceholder')}
          aria-label={t('account.emailLabel')}
          maxLength={254}
          onChange={(e) => setEmail(e.target.value)}
        />
        {needsPassword && (
          <input
            type="password"
            name="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
            value={password}
            placeholder={mode === 'signup' ? t('account.newPasswordPlaceholder', { count: MIN_PASSWORD_LENGTH }) : t('account.passwordPlaceholder')}
            aria-label={t('account.passwordLabel')}
            maxLength={72}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="x-btn x-btn--accent auth-submit" disabled={!trimmed || busy || (mode !== 'signin' && mode !== 'signup' && wait > 0) || (needsPassword && !password)}>
          {busy ? t('account.sending') : t(submitLabel)}
        </button>
      </form>

      <div className="auth-links">
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => switchTo('forgot')}>
              {t('account.forgotPassword')}
            </button>
            <button type="button" onClick={() => switchTo('link')}>
              {t('account.useLink')}
            </button>
            <button type="button" onClick={() => switchTo('signup')}>
              {t('account.noAccount')}
            </button>
          </>
        )}
        {mode === 'signup' && (
          <>
            <button type="button" onClick={() => switchTo('link')}>
              {t('account.useLink')}
            </button>
            <button type="button" onClick={() => switchTo('signin')}>
              {t('account.haveAccount')}
            </button>
          </>
        )}
        {(mode === 'link' || mode === 'forgot') && (
          <button type="button" onClick={() => switchTo(intent)}>
            {t('account.usePassword')}
          </button>
        )}
      </div>
      <p className="auth-legal">
        {t('legal.footer.agree')} <a href={routeToPath({ screen: 'terms' })}>{t('legal.footer.terms')}</a> · <a href={routeToPath({ screen: 'privacy' })}>{t('legal.footer.privacy')}</a>
      </p>
    </div>
  )
}
