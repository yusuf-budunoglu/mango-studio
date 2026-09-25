// Uygulamayla birlikte gelen yazı tipleri (SIL OFL 1.1; lisanslar src/assets/fonts/ içinde).
// Dosyalar `python scripts/build-fonts.py` ile Fontsource paketlerinden üretilir: her dosya
// latin + latin-ext (Türkçe harfler) + Noto Sans Symbols 2 sembollerini (◆ ★ ✓) birleştirir,
// çünkü troika tek bir font dosyası kabul ediyor. Böylece metin çizimi internete ihtiyaç duymaz.
// Dosyada olmayan nadir karakterler (emoji, → gibi) troika'nın kendi yedek sunucusuna düşer.
import inter400 from '../assets/fonts/inter-400.woff?url'
import inter700 from '../assets/fonts/inter-700.woff?url'
import mono400 from '../assets/fonts/jetbrains-mono-400.woff?url'
import mono700 from '../assets/fonts/jetbrains-mono-700.woff?url'
import montserrat400 from '../assets/fonts/montserrat-400.woff?url'
import montserrat700 from '../assets/fonts/montserrat-700.woff?url'
import playfair400 from '../assets/fonts/playfair-display-400.woff?url'
import playfair700 from '../assets/fonts/playfair-display-700.woff?url'
import poppins400 from '../assets/fonts/poppins-400.woff?url'
import poppins700 from '../assets/fonts/poppins-700.woff?url'
import space400 from '../assets/fonts/space-grotesk-400.woff?url'
import space700 from '../assets/fonts/space-grotesk-700.woff?url'

type Weight = 400 | 700

interface FontDef {
  id: string
  label: string
  files: Record<Weight, string>
}

export const FONTS: FontDef[] = [
  { id: 'inter', label: 'Inter', files: { 400: inter400, 700: inter700 } },
  { id: 'poppins', label: 'Poppins', files: { 400: poppins400, 700: poppins700 } },
  { id: 'montserrat', label: 'Montserrat', files: { 400: montserrat400, 700: montserrat700 } },
  { id: 'playfair-display', label: 'Playfair Display', files: { 400: playfair400, 700: playfair700 } },
  { id: 'space-grotesk', label: 'Space Grotesk', files: { 400: space400, 700: space700 } },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', files: { 400: mono400, 700: mono700 } },
]

export const DEFAULT_FONT = 'inter'

/** Metin katmanının kullanacağı font dosyasının adresi. */
export function fontUrl(fontId: string | undefined, weight: Weight = 400): string {
  const font = FONTS.find((f) => f.id === fontId) ?? FONTS[0]
  return font.files[weight] ?? font.files[400]
}
