import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n'

export function LanguageSelect() {
  const { t, i18n } = useTranslation()
  return (
    <label className="language-select">
      <span className="visually-hidden">{t('common.language')}</span>
      <span aria-hidden="true">🌐</span>
      <select
        id="language"
        value={i18n.language}
        onChange={(e) => setLanguage(e.target.value as LanguageCode)}
        title={t('common.language')}
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  )
}
