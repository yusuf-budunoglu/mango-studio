import type { CameraState, LayerState } from './types'

/**
 * Her animasyon bloğu küçük bir formül: e = eğriden geçmiş ilerleme (0..1),
 * p = ham ilerleme. Blok başlamadan önce e=0, bittikten sonra e=1 ile çağrılır;
 * böylece giriş animasyonları başlamadan önce katmanı gizli tutar.
 */
/** Bloğun ayarlanabilir bir sayısı. Adı çeviri dosyasında: `params.<key>`. */
export interface ParamSpec {
  key: string
  default: number
  min?: number
  max?: number
  step: number
}

interface PresetBase {
  /** adı ve kategori adı çeviri dosyalarında: `presets.<id>`, `categories.<category>` */
  category: 'in' | 'out' | 'emphasis' | 'text' | 'camera'
  defaultEasing: string
  defaultDuration: number
  /** paneldeki ayarlar; `apply` bunların varsayılanlarla birleşmiş halini alır */
  params?: ParamSpec[]
}

export interface LayerPreset extends PresetBase {
  target: 'layer'
  apply: (s: LayerState, e: number, p: number, params: Record<string, number>) => void
}

export interface CameraPreset extends PresetBase {
  target: 'camera'
  apply: (s: CameraState, e: number, p: number, params: Record<string, number>) => void
}

export type Preset = LayerPreset | CameraPreset

const DEG = Math.PI / 180
const distance = (d: number): ParamSpec => ({ key: 'distance', default: d, min: -20, max: 20, step: 0.1 })

export const PRESETS: Record<string, Preset> = {
  'fade-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out', defaultDuration: 0.6,
    apply: (s, e) => { s.opacity *= e },
  },
  'slide-up': {
    target: 'layer', category: 'in', defaultEasing: 'spring-gentle', defaultDuration: 0.9,
    params: [distance(1.2)],
    apply: (s, e, _p, { distance }) => { s.y -= (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'slide-down': {
    target: 'layer', category: 'in', defaultEasing: 'spring-gentle', defaultDuration: 0.9,
    params: [distance(1.2)],
    apply: (s, e, _p, { distance }) => { s.y += (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'slide-left': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 0.9,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.x += (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'scale-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 0.8,
    apply: (s, e) => { s.scale *= 0.6 + 0.4 * e; s.opacity *= e },
  },
  pop: {
    target: 'layer', category: 'in', defaultEasing: 'spring-bouncy', defaultDuration: 0.7,
    apply: (s, e) => { s.scale *= Math.max(0, e) },
  },
  'rotate-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 1.2,
    params: [{ key: 'angle', default: -70, min: -360, max: 360, step: 5 }],
    apply: (s, e, _p, { angle }) => { s.rotY += (1 - e) * angle * DEG; s.opacity *= Math.min(1, e * 2) },
  },
  'fade-out': {
    target: 'layer', category: 'out', defaultEasing: 'ease-in', defaultDuration: 0.5,
    apply: (s, e) => { s.opacity *= 1 - e },
  },
  'scale-out': {
    target: 'layer', category: 'out', defaultEasing: 'ease-in', defaultDuration: 0.5,
    apply: (s, e) => { s.scale *= 1 - 0.4 * e; s.opacity *= 1 - e },
  },
  float: {
    target: 'layer', category: 'emphasis', defaultEasing: 'linear', defaultDuration: 3,
    params: [{ key: 'amount', default: 0.12, min: 0, max: 3, step: 0.02 }, { key: 'cycles', default: 1, min: 0.5, max: 20, step: 0.5 }],
    apply: (s, _e, p, { amount, cycles }) => { s.y += Math.sin(p * Math.PI * 2 * cycles) * amount },
  },
  spin: {
    target: 'layer', category: 'emphasis', defaultEasing: 'ease-in-out', defaultDuration: 1.5,
    apply: (s, e) => { s.rotY += e * Math.PI * 2 },
  },
  typewriter: {
    target: 'layer', category: 'text', defaultEasing: 'linear', defaultDuration: 1.2,
    apply: (s, e) => { s.textReveal = Math.min(s.textReveal, e) },
  },
  'count-up': {
    target: 'layer', category: 'text', defaultEasing: 'ease-out-expo', defaultDuration: 1.5,
    params: [{ key: 'from', default: 0, step: 1 }, { key: 'to', default: 100, step: 1 }, { key: 'decimals', default: 0, min: 0, max: 4, step: 1 }],
    apply: (s, e, _p, { from, to, decimals }) => {
      const f = 10 ** decimals
      s.numberValue = Math.round((from + (to - from) * e) * f) / f
    },
  },
  'camera-push': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.z -= e * distance },
  },
  'camera-pull': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.z += e * distance },
  },
  'camera-orbit': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [{ key: 'angle', default: 25, min: -180, max: 180, step: 5 }],
    apply: (s, e, _p, { angle }) => {
      const a = e * angle * DEG
      const r = Math.hypot(s.x - s.targetX, s.z)
      s.x = s.targetX + Math.sin(a) * r
      s.z = Math.cos(a) * r
    },
  },
  'focus-pull': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 1.5,
    params: [{ key: 'from', default: -3, min: -20, max: 10, step: 0.25 }, { key: 'to', default: 0, min: -20, max: 10, step: 0.25 }],
    apply: (s, e, _p, { from, to }) => { s.focusZ = from + (to - from) * e },
  },
  'camera-pan': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 3,
    params: [distance(1.5)],
    apply: (s, e, _p, { distance }) => { s.x += e * distance; s.targetX += e * distance },
  },
}

/** Bloğun kayıtlı ayarlarını preset'in varsayılanlarıyla birleştirir. */
export function resolveParams(preset: Preset, params: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const spec of preset.params ?? []) out[spec.key] = params?.[spec.key] ?? spec.default
  return { ...out, ...params }
}

export function presetsFor(target: 'layer' | 'camera') {
  return Object.entries(PRESETS).filter(([, p]) => p.target === target)
}
