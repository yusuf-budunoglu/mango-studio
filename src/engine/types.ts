// Proje formatı: editör, motor, şablonlar ve (ileride) MCP hepsi bu yapıyı okuyup yazar.

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
  /** görsel katmanı ya da telefon ekranı için resim (data URL veya adres) */
  image?: string
  color: string
  fontSize?: number
  position: Vec3
  /** derece */
  rotation: Vec3
  scale: number
  opacity: number
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
  id: string
  name: string
  /** saniye */
  duration: number
  fps: number
  width: number
  height: number
  background: string
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
