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
