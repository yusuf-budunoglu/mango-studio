import type { EffectsPatch } from './effects'

// Proje formatı: editör, motor, şablonlar ve (ileride) MCP hepsi bu yapıyı okuyup yazar.
// Formatı değiştirirken PROJECT_VERSION'ı artır ve migrate.ts'e bir adım ekle. Varsayılanı olan
// isteğe bağlı yeni alanlar (hidden, locked…) eski projeleri bozmadığı için sürüm gerektirmez.

export const PROJECT_VERSION = 1

export type Vec3 = [number, number, number]

export type LayerKind = 'text' | 'phone' | 'laptop' | 'tablet' | 'shape' | 'image' | 'svg' | 'video'

export type ShapeType = 'cube' | 'rect' | 'rounded' | 'circle'

/** Cihaz maketlerinin gövde rengi. */
export type DeviceFinish = 'silver' | 'space' | 'titanium' | 'blue'

export interface Block {
  id: string
  preset: string
  /** saniye */
  start: number
  /** saniye */
  duration: number
  /** boşsa preset'in varsayılan eğrisi kullanılır; 'custom' ise `bezier` */
  easing?: string
  /** özel hız eğrisi (CSS cubic-bezier gibi): x1, y1, x2, y2 */
  bezier?: [number, number, number, number]
  params?: Record<string, number>
}

export interface Layer {
  id: string
  name: string
  kind: LayerKind
  text?: string
  /** metin hizası; boşsa ortalı */
  align?: 'left' | 'center' | 'right'
  /** yazı tipi kimliği (render/fonts.ts); boşsa Inter */
  fontFamily?: string
  fontWeight?: 400 | 700
  /** metin kutusu genişliği (sahne birimi); bu genişlikte satır atlar */
  textWidth?: number
  /** harf aralığı, yazı boyutuna oranla (ör. 0.05) */
  letterSpacing?: number
  /** satır yüksekliği, yazı boyutuna oranla */
  lineHeight?: number
  /** görsel katmanı ya da cihaz ekranı için resim (asset:<id>, data URL veya adres) */
  image?: string
  /** SVG logo ya da video katmanının dosyası (asset:<id>) */
  media?: string
  /** video: videonun başladığı proje anı (sn) */
  mediaStart?: number
  /** video: kaynakta nereden başladığı (sn) */
  mediaOffset?: number
  /** SVG: orijinal renkler yerine katman rengiyle boya */
  tint?: boolean
  /** SVG: 3D kalınlık (0 = düz) */
  extrude?: number
  /** cihaz maketi: gövde rengi */
  deviceFinish?: DeviceFinish
  /** laptop: kapak açısı (derece; 90 dik, 105 hafif geriye yatık) */
  lidAngle?: number
  /** şekil katmanının türü ve boyutu (sahne birimi) */
  shape?: ShapeType
  shapeWidth?: number
  shapeHeight?: number
  color: string
  fontSize?: number
  position: Vec3
  /** derece */
  rotation: Vec3
  scale: number
  opacity: number
  /** gizli katman önizlemede ve videoda çizilmez */
  hidden?: boolean
  /** kilitli katman timeline'da ve önizlemede sürüklenemez */
  locked?: boolean
  blocks: Block[]
}

export interface CameraTrack {
  id: 'camera'
  name: string
  position: Vec3
  fov: number
  blocks: Block[]
}

/** Timeline'daki bir ses parçası (müzik, efekt, seslendirme). */
export interface AudioClip {
  id: string
  name: string
  /** dosya deposu referansı: `asset:<id>` */
  asset: string
  /** videodaki başlangıç (sn) */
  start: number
  /** kaynak dosyada nereden başladığı (sn); soldan kırpınca artar */
  offset: number
  /** videoda ne kadar çaldığı (sn) */
  duration: number
  /** kaynak dosyanın toplam süresi (sn); kırpma sınırı */
  sourceDuration: number
  /** 0..1 */
  volume: number
  fadeIn: number
  fadeOut: number
}

export interface Project {
  /** format sürümü; eski projeler açılırken migrate.ts ile güncellenir */
  version: number
  id: string
  name: string
  /** saniye */
  duration: number
  fps: number
  width: number
  height: number
  background: string
  /** arka plan: düz renk ya da iki renkli degrade (`background` → `background2`) */
  backgroundStyle?: 'solid' | 'linear' | 'radial'
  background2?: string
  /** sol alttan gelen vurgu ışığının rengi (boşsa mor #6c5ce7) */
  accentLight?: string
  /** ışık düzeni: yumuşak oda ışığı (varsayılan) ya da ürün çekimi stüdyosu (softbox + kenar ışıkları) */
  lighting?: 'soft' | 'studio'
  /** videodaki sayıların biçimi (count-up), ör. 'en-US' → 1,000 · 'tr-TR' → 1.000; boşsa en-US */
  numberLocale?: string
  layers: Layer[]
  camera: CameraTrack
  /** ses parçaları; boşsa sessiz */
  audio?: AudioClip[]
  /** görüntü efektleri; boşsa varsayılanlar (bloom + kenar karartma) */
  effects?: EffectsPatch
}

/** Motorun belirli bir anda bir katman için hesapladığı değerler. */
export interface LayerState {
  x: number
  y: number
  z: number
  rotX: number
  rotY: number
  rotZ: number
  scale: number
  opacity: number
  /** 0..1 arası: metnin ne kadarı görünüyor (typewriter) */
  textReveal: number
  /** count-up bloğu varsa gösterilecek sayı */
  numberValue: number | null
  /** 0..1: kelime kelime belirme (word-reveal) */
  wordReveal: number
  /** 0..1: metnin soldan sağa görünen kısmı (wipe-in) */
  wipe: number
  /** 0..1: harfler soldan sağa yumuşak kenarla belirir (soft-reveal) */
  softReveal: number
  /** soft-reveal kenarının genişliği, metin genişliğine oranla */
  revealSoftness: number
  /** harf aralığına eklenen (tracking-in) */
  letterSpacing: number
}

export interface CameraState {
  x: number
  y: number
  z: number
  fov: number
  /** kameranın baktığı nokta */
  targetX: number
  targetY: number
  /** alan derinliği açıkken netlik düzleminin z konumu */
  focusZ: number
  /** alan derinliği bulanıklığının çarpanı (0 = tamamen net) */
  focusBlur: number
  /** geçiş örtüsü: 0 = görünmez, 1 = ekran tamamen kaplı */
  overlayOpacity: number
  /** örtü rengi: 0 = siyah, 1 = beyaz */
  overlayWhite: number
}

export interface FrameState {
  time: number
  layers: Record<string, LayerState>
  camera: CameraState
}
