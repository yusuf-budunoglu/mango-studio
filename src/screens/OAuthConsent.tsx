import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { AppShell } from '../layout/AppShell'
import { routeToPath } from '../router'
import { useAuthStore } from '../store/authStore'

const PERMISSIONS = ['read', 'write', 'upload'] as const

type Request = { state: 'loading' } | { state: 'ready'; client: string; redirectHost: string } | { state: 'error' } | { state: 'leaving' }

/** Yalnızca http(s) adresine gidilir: istemcinin kayıtlı dönüş adresi `javascript:` gibi bir şey olamaz. */
function leaveTo(url: string) {
  const { protocol } = new URL(url)
  if (protocol === 'http:' || protocol === 'https:') window.location.href = url
  else throw new Error('unsupported redirect')
}

/**
 * Claude Code (MCP) bağlantısının onay sayfası: Supabase Auth (OAuth sunucusu) kullanıcıyı buraya
 * `?authorization_id=` ile gönderir. Giriş yapmış kullanıcı hangi uygulamanın neye erişeceğini görür;
 * onaylarsa ya da reddederse Supabase'in verdiği adrese (istemcinin dönüş adresi) gidilir.
 * Girişsiz ziyaretçi önce üyelik sayfasını görür (`App` `MEMBERS_ONLY`), girişten sonra buraya döner.
 */
export function OAuthConsent() {
  const { t } = useTranslation()
  const email = useAuthStore((s) => s.user?.email)
  const [authorizationId] = useState(() => new URLSearchParams(window.location.search).get('authorization_id'))
  const [request, setRequest] = useState<Request>(() => ({ state: supabase && authorizationId ? 'loading' : 'error' }))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase || !authorizationId) return
    let cancelled = false
    void supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error }) => {
      if (cancelled) return
      try {
        if (error || !data) return setRequest({ state: 'error' })
        // daha önce onay verilmiş: Supabase doğrudan dönüş adresini verir
        if (!('authorization_id' in data)) {
          setRequest({ state: 'leaving' })
          return leaveTo(data.redirect_url)
        }
        setRequest({ state: 'ready', client: data.client.name, redirectHost: new URL(data.redirect_uri).host })
      } catch {
        setRequest({ state: 'error' })
      }
    })
    return () => {
      cancelled = true
    }
  }, [authorizationId])

  const decide = async (approve: boolean) => {
    if (!supabase || !authorizationId || busy) return
    setBusy(true)
    try {
      const { data, error } = approve ? await supabase.auth.oauth.approveAuthorization(authorizationId) : await supabase.auth.oauth.denyAuthorization(authorizationId)
      if (error || !data) throw error ?? new Error('no redirect')
      setRequest({ state: 'leaving' })
      leaveTo(data.redirect_url)
    } catch {
      setBusy(false)
      setRequest({ state: 'error' })
    }
  }

  return (
    <AppShell current={{ screen: 'oauth' }} title={t('oauth.title')} bare>
      <div className="consent">
        <section className="signup-card consent-card" aria-labelledby="consent-title">
          <img className="consent-mark" src={`${import.meta.env.BASE_URL}brand/mango-mark-96.png`} alt="" />
          {request.state === 'ready' && (
            <>
              <h1 id="consent-title">{t('oauth.heading', { client: request.client })}</h1>
              <p className="signup-lead">{t('oauth.lead', { client: request.client, email: email ?? '' })}</p>
              <ul className="signup-perks">
                {PERMISSIONS.map((id) => (
                  <li key={id}>
                    <Check size={15} strokeWidth={2.5} aria-hidden="true" />
                    {t(`oauth.permissions.${id}`)}
                  </li>
                ))}
              </ul>
              <p className="signup-note">{t('oauth.returnsTo', { host: request.redirectHost })}</p>
              <div className="consent-actions">
                <button type="button" className="x-btn x-btn--accent" disabled={busy} onClick={() => void decide(true)}>
                  {t('oauth.approve')}
                </button>
                <button type="button" className="x-btn x-btn--ghost" disabled={busy} onClick={() => void decide(false)}>
                  {t('oauth.deny')}
                </button>
              </div>
              <p className="signup-note">{t('oauth.revokeNote')}</p>
            </>
          )}
          {(request.state === 'loading' || request.state === 'leaving') && (
            <p id="consent-title" className="signup-lead" role="status">
              {t(request.state === 'loading' ? 'oauth.loading' : 'oauth.leaving')}
            </p>
          )}
          {request.state === 'error' && (
            <>
              <h1 id="consent-title">{t('oauth.errorTitle')}</h1>
              <p className="signup-lead" role="alert">
                {t('oauth.errorBody')}
              </p>
              <a className="signup-back" href={routeToPath({ screen: 'home' })}>
                {t('oauth.home')}
              </a>
            </>
          )}
        </section>
      </div>
    </AppShell>
  )
}
