// Proje formatı: editör, motor, şablonlar ve (ileride) MCP hepsi bu yapıyı okuyup yazar.
// Formatı değiştirirken PROJECT_VERSION'ı artır ve migrate.ts'e bir adım ekle. Varsayılanı olan
// isteğe bağlı yeni alanlar (hidden, locked…) eski projeleri bozmadığı için sürüm gerektirmez.

export const PROJECT_VERSION = 1

export type Vec3 = [number, number, number]

export type LayerKind = 'text' | 'phone' | 'shape' | 'image'

export interface Block {
  id: string
  preset: string
  /** saniye */
  start: number
  /** saniye */
  duration: number
  /** boşsa preset'in varsayılan eğrisi kullanılır */
  easing?: string
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
  /** görsel katmanı ya da telefon ekranı için resim (data URL veya adres) */
  image?: string
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
  /** videodaki sayıların biçimi (count-up), ör. 'en-US' → 1,000 · 'tr-TR' → 1.000; boşsa en-US */
  numberLocale?: string
  layers: Layer[]
  camera: CameraTrack
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
}

export interface CameraState {
  x: number
  y: number
  z: number
  fov: number
  /** kameranın baktığı nokta */
  targetX: number
  targetY: number
}

export interface FrameState {
  time: number
  layers: Record<string, LayerState>
  camera: CameraState
}
