import { useTranslation } from 'react-i18next'
import { AppShell } from '../layout/AppShell'
import { routeToPath } from '../router'

/** Sayfalarda görünen iletişim adresi ve son güncelleme tarihi; metinler `legal.*` çevirilerinde. */
export const LEGAL_CONTACT = 'yusufbudunoglucrs@gmail.com'
const UPDATED = new Date(2026, 9, 5)

/** Bölüm sırası; her bölümün `title` ve `body` metni çeviri dosyasında (`body`: satır başına bir paragraf). */
const SECTIONS = {
  privacy: ['who', 'collect', 'use', 'google', 'providers', 'sharing', 'retention', 'rights', 'children', 'changes'],
  terms: ['service', 'account', 'content', 'exports', 'acceptable', 'plans', 'thirdParty', 'availability', 'liability', 'ending', 'changes'],
} as const

/** Gizlilik politikası (`/privacy`) ve kullanım koşulları (`/terms`): herkese açık, giriş gerekmez. */
export function Legal({ doc }: { doc: keyof typeof SECTIONS }) {
  const { t, i18n } = useTranslation()
  const other = doc === 'privacy' ? 'terms' : 'privacy'
  return (
    <AppShell current={{ screen: doc }} title={t(`legal.${doc}.title`)}>
      <article className="legal">
        <h2>{t(`legal.${doc}.title`)}</h2>
        <p className="hint">{t('legal.updated', { date: UPDATED.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long', day: 'numeric' }) })}</p>
        <p>{t(`legal.${doc}.intro`)}</p>
        {SECTIONS[doc].map((id) => (
          <section key={id}>
            <h3>{t(`legal.${doc}.${id}.title`)}</h3>
            {t(`legal.${doc}.${id}.body`)
              .split('\n')
              .map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
          </section>
        ))}
        <section>
          <h3>{t('legal.contactTitle')}</h3>
          <p>
            {t('legal.contactBody')} <a href={`mailto:${LEGAL_CONTACT}`}>{LEGAL_CONTACT}</a>
          </p>
          <p>
            <a href={routeToPath({ screen: other })}>{t(`legal.${other}.title`)}</a>
          </p>
        </section>
      </article>
    </AppShell>
  )
}
