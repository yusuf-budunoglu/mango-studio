import { anticipate, backOut, circOut, cubicBezier, easeIn, easeInOut, easeOut, spring } from 'motion'

export type EasingFn = (p: number) => number

/**
 * Motion'ın spring'i zamana bağlı çalışır. Bloğun süresinden bağımsız olsun diye
 * yayı bir kez örnekleyip toplam süresini buluyor, sonra 0..1 ilerlemeye ölçekliyoruz.
 */
function normalizedSpring(bounce: number): EasingFn {
  const generator = spring({ keyframes: [0, 1], visualDuration: 1, bounce })
  let totalMs = 0
  while (!generator.next(totalMs).done && totalMs < 10_000) totalMs += 10
  return (p) => (p >= 1 ? 1 : generator.next(p * totalMs).value)
}

/** Adları çeviri dosyalarında: `easings.<id>`. */
export const EASINGS: Record<string, EasingFn> = {
  linear: (p) => p,
  'ease-in': easeIn,
  'ease-out': easeOut,
  'ease-in-out': easeInOut,
  'ease-out-expo': cubicBezier(0.16, 1, 0.3, 1),
  'ease-out-circ': circOut,
  'ease-out-back': backOut,
  anticipate,
  'spring-gentle': normalizedSpring(0.15),
  'spring-snappy': normalizedSpring(0.3),
  'spring-bouncy': normalizedSpring(0.5),
}

export function getEasing(name: string | undefined): EasingFn {
  return (name && EASINGS[name]) || EASINGS.linear
}

/** Varsayılan özel eğri: CSS'teki ease-in-out. */
export const DEFAULT_BEZIER: [number, number, number, number] = [0.42, 0, 0.58, 1]

/**
 * Hassas kübik bezier (CSS cubic-bezier). Motion'ın çözücüsü sınırlı adımla ~1e-3 hata yapabiliyor;
 * kare kare ölçülen şablonlarda bloğun sonuna çok yakın anlarda bu fark görünür sapma yaratıyordu.
 * Newton adımları + ikiye bölme yedeği ile x'ten t'yi 1e-10 hassasiyetle bulur.
 */
export function preciseCubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFn {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx
  return (p) => {
    if (p <= 0) return 0
    if (p >= 1) return 1
    let t = p
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - p
      if (Math.abs(err) < 1e-10) return sampleY(t)
      const d = slopeX(t)
      if (Math.abs(d) < 1e-7) break
      t -= err / d
    }
    // Newton yakınsamadıysa (düz eğim) ikiye bölme
    let lo = 0
    let hi = 1
    t = p
    for (let i = 0; i < 60; i++) {
      const x = sampleX(t)
      if (Math.abs(x - p) < 1e-10) break
      if (x < p) lo = t
      else hi = t
      t = (lo + hi) / 2
    }
    return sampleY(t)
  }
}

const bezierCache = new Map<string, EasingFn>()

/** Bloğun eğrisi: özel (bezier) ya da isimli; boşsa preset'in varsayılanı. */
export function easingFor(block: { easing?: string; bezier?: [number, number, number, number] }, fallback: string): EasingFn {
  if (block.easing === 'custom') {
    const [x1, y1, x2, y2] = block.bezier ?? DEFAULT_BEZIER
    const key = `${x1},${y1},${x2},${y2}`
    let fn = bezierCache.get(key)
    if (!fn) {
      fn = preciseCubicBezier(Math.min(1, Math.max(0, x1)), y1, Math.min(1, Math.max(0, x2)), y2)
      bezierCache.set(key, fn)
    }
    return fn
  }
  return getEasing(block.easing ?? fallback)
}
