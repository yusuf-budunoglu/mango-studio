// Uygulamayla birlikte gelen yazı tipleri (SIL OFL 1.1; lisanslar src/assets/fonts/ içinde).
// Dosyalar `python scripts/build-fonts.py` ile Fontsource paketlerinden üretilir: her dosya
// latin + latin-ext (Türkçe harfler) + Noto Sans Symbols 2 sembollerini (◆ ★ ✓) birleştirir,
// çünkü troika tek bir font dosyası kabul ediyor. Böylece metin çizimi internete ihtiyaç duymaz.
// Dosyada olmayan nadir karakterler (emoji, → gibi) troika'nın kendi yedek sunucusuna düşer.
// Kullanıcının yüklediği fontlar dosya deposunda; katmanda `fontFamily: 'asset:<id>'` olarak durur.
import { isAssetRef } from '../persistence/assets'

export type FontWeight = 400 | 700
export type FontCategory = 'sans' | 'serif' | 'display' | 'mono'

export interface FontDef {
  id: string
  label: string
  category: FontCategory
  /** Tek kalınlığı olan fontlarda 700 yok; kalın için 400 kullanılır. */
  files: Partial<Record<FontWeight, string>> & { 400: string }
}

const FILES = import.meta.glob<string>('../assets/fonts/*.woff', { query: '?url', import: 'default', eager: true })

const font = (id: string, label: string, category: FontCategory): FontDef => {
  const file = (w: FontWeight) => FILES[`../assets/fonts/${id}-${w}.woff`]
  return { id, label, category, files: { 400: file(400), 700: file(700) } }
}

export const FONTS: FontDef[] = [
  font('inter', 'Inter', 'sans'),
  // Inter Medium: normal = 500, kalın = 600 (SF Pro'ya en yakın ağırlıklar; proje formatı yalnızca 400/700 bilir)
  { id: 'inter-medium', label: 'Inter Medium', category: 'sans', files: { 400: FILES['../assets/fonts/inter-500.woff'], 700: FILES['../assets/fonts/inter-600.woff'] } },
  font('roboto', 'Roboto', 'sans'),
  font('open-sans', 'Open Sans', 'sans'),
  font('dm-sans', 'DM Sans', 'sans'),
  font('manrope', 'Manrope', 'sans'),
  font('plus-jakarta-sans', 'Plus Jakarta Sans', 'sans'),
  font('poppins', 'Poppins', 'sans'),
  font('montserrat', 'Montserrat', 'sans'),
  font('outfit', 'Outfit', 'sans'),
  font('sora', 'Sora', 'sans'),
  font('work-sans', 'Work Sans', 'sans'),
  font('nunito', 'Nunito', 'sans'),
  font('rubik', 'Rubik', 'sans'),
  font('raleway', 'Raleway', 'sans'),
  font('space-grotesk', 'Space Grotesk', 'sans'),
  font('syne', 'Syne', 'display'),
  font('oswald', 'Oswald', 'display'),
  font('bebas-neue', 'Bebas Neue', 'display'),
  font('playfair-display', 'Playfair Display', 'serif'),
  font('fraunces', 'Fraunces', 'serif'),
  font('dm-serif-display', 'DM Serif Display', 'serif'),
  font('instrument-serif', 'Instrument Serif', 'serif'),
  font('jetbrains-mono', 'JetBrains Mono', 'mono'),
]

export const FONT_CATEGORIES: FontCategory[] = ['sans', 'display', 'serif', 'mono']

export const DEFAULT_FONT = 'inter'

/** Paketteki fontun dosyası; bilinmeyen id (ya da yüklenen font) için varsayılan font. */
export function fontUrl(fontId: string | undefined, weight: FontWeight = 400): string {
  const def = FONTS.find((f) => f.id === fontId) ?? FONTS[0]
  return def.files[weight] ?? def.files[400]
}

export const isUploadedFont = (fontId: string | undefined): fontId is string => isAssetRef(fontId)

// Yeni metinlerin fontu: bu tarayıcıda tutulan tercih (proje formatına girmez; katmana yazılır).
const PREFERRED_KEY = 'motion-studio.default-font'

export function preferredFont(): string {
  try {
    return localStorage.getItem(PREFERRED_KEY) || DEFAULT_FONT
  } catch {
    return DEFAULT_FONT
  }
}

export function setPreferredFont(fontId: string) {
  try {
    localStorage.setItem(PREFERRED_KEY, fontId)
  } catch {
    // kaydedilemese de bu oturumda sonraki seçimi etkilemez
  }
}
