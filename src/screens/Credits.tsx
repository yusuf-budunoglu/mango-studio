import { useTranslation } from 'react-i18next'
import { AppShell } from '../layout/AppShell'
import { FONT_CREDITS, MODEL_CREDITS } from '../project/credits'

/** Üçüncü taraf içeriklerin atıfları ve lisansları. */
export function Credits() {
  const { t } = useTranslation()
  return (
    <AppShell current={{ screen: 'credits' }} title={t('credits.title')}>
      <div className="credits">
        <h2>{t('credits.title')}</h2>
        <p className="hint">{t('credits.intro')}</p>

        <h3>{t('credits.models')}</h3>
        <ul>
          {MODEL_CREDITS.map((c) => (
            <li key={c.source}>
              <strong>{t(c.labelKey)}</strong>
              <span>
                {t('credits.by')}{' '}
                <a href={c.authorUrl} target="_blank" rel="noreferrer">
                  {c.author}
                </a>
                {' · '}
                <a href={c.source} target="_blank" rel="noreferrer">
                  {t('credits.source')}
                </a>
                {' · '}
                <a href={c.licenseUrl} target="_blank" rel="noreferrer">
                  {c.license}
                </a>
              </span>
              <span className="hint">{t(c.changesKey)}</span>
            </li>
          ))}
        </ul>
        <p className="hint">{t('credits.trademark')}</p>

        <h3>{t('credits.fonts')}</h3>
        <p>
          {FONT_CREDITS.join(', ')}
          {' · '}
          <a href="https://openfontlicense.org" target="_blank" rel="noreferrer">
            SIL Open Font License 1.1
          </a>
        </p>
      </div>
    </AppShell>
  )
}
