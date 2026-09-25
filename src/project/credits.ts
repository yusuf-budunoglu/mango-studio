// Uygulamada kullanılan üçüncü taraf içerikler ve lisansları (Katkılar ve lisanslar sayfası).
// Model başlıkları gösterilmez (marka adı içeriyorlar); yazar, kaynak bağlantısı ve lisans yeterli.

export interface Credit {
  /** i18n anahtarı: ne olduğu ("Telefon modeli") */
  labelKey: string
  author: string
  authorUrl: string
  source: string
  license: string
  licenseUrl: string
  /** i18n anahtarı: yapılan değişiklikler */
  changesKey: string
}

export const MODEL_CREDITS: Credit[] = [
  {
    labelKey: 'credits.items.phone',
    author: 'shig0',
    authorUrl: 'https://sketchfab.com/shig0',
    source: 'https://sketchfab.com/3d-models/iphone-16-pro-max-56f0840754654be3a9e4679c84d4ed64',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    changesKey: 'credits.changes.phone',
  },
  {
    labelKey: 'credits.items.tablet',
    author: 'polyman',
    authorUrl: 'https://sketchfab.com/Polyman_3D',
    source: 'https://sketchfab.com/3d-models/ipad-pro-13in-silver-m4-8a113340443e49d3b905ab9f0b45efd6',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    changesKey: 'credits.changes.tablet',
  },
  {
    labelKey: 'credits.items.laptop',
    author: 'apple-user',
    authorUrl: 'https://sketchfab.com/apple-user',
    source: 'https://sketchfab.com/3d-models/macbook-pro-14-inch-m5-652a992f4f244122ae251f9cbb81da1e',
    license: 'Sketchfab Standard',
    licenseUrl: 'https://sketchfab.com/licenses',
    changesKey: 'credits.changes.laptop',
  },
]

export const FONT_CREDITS = ['Inter', 'JetBrains Mono', 'Montserrat', 'Noto Sans Symbols 2', 'Playfair Display', 'Poppins', 'Space Grotesk']
