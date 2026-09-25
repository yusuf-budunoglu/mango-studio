import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en'
import tr from './locales/tr'

/**
 * Desteklenen diller. Yeni dil eklemek için: `locales/<kod>.ts` dosyasını `Translation`
 * tipinde yaz, buraya ve `resources`'a ekle. Sayı biçimi için `numberLocale` ver.
 */
export const LANGUAGES = [
  { code: 'en', label: 'English', numberLocale: 'en-US' },
  { code: 'tr', label: 'Türkçe', numberLocale: 'tr-TR' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'en'
const STORAGE_KEY = 'motion-studio.language'

function storedLanguage(): LanguageCode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (LANGUAGES.some((l) => l.code === saved)) return saved as LanguageCode
  } catch {
    // Depolama kapalı ya da (testlerde) yok: varsayılan dile düş.
  }
  return DEFAULT_LANGUAGE
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, tr: { translation: tr } },
  lng: storedLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
  initAsync: false,
})

if (typeof document !== 'undefined') document.documentElement.lang = i18n.language

export function setLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code)
  document.documentElement.lang = code
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // Kaydedilemese de bu oturum için dil değişir.
  }
}

/** Seçili dile göre yeni projelerde kullanılacak sayı biçimi. */
export function currentNumberLocale(): string {
  return LANGUAGES.find((l) => l.code === i18n.language)?.numberLocale ?? 'en-US'
}

export default i18n
