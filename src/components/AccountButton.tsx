import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { routeToPath } from '../router'
import { useAuthStore } from '../store/authStore'

/** Üst çubuktaki hesap düğmeleri: girişsizken "Giriş yap" + "Üye ol", girişliyken profile giden baş harf. */
export function AccountButton() {
  const { t } = useTranslation()
  const status = useAuthStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const openSignIn = useAuthStore((s) => s.openSignIn)

  // Bulut ayarı yoksa uygulama yalnızca yerel çalışır; giriş gösterilmez.
  if (!supabase || status === 'loading') return null

  if (status === 'out') {
    return (
      <span className="account-guest">
        <button type="button" className="account-login" onClick={openSignIn}>
          {t('account.signIn')}
        </button>
        <a className="account-signin" href={routeToPath({ screen: 'signup' })}>
          {t('account.signUp')}
        </a>
      </span>
    )
  }

  const email = user?.email ?? ''
  // Baş harf profile götürür; çıkış profil sayfasında.
  return (
    <a className="account-chip" href={routeToPath({ screen: 'profile' })} title={t('account.signedInAs', { email })} aria-label={t('profile.title')}>
      {(email[0] ?? '?').toUpperCase()}
    </a>
  )
}
