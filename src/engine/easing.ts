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

export const EASINGS: Record<string, { label: string; fn: EasingFn }> = {
  linear: { label: 'Doğrusal', fn: (p) => p },
  'ease-in': { label: 'Yavaş başla', fn: easeIn },
  'ease-out': { label: 'Yavaş bitir', fn: easeOut },
  'ease-in-out': { label: 'Yumuşak', fn: easeInOut },
  'ease-out-expo': { label: 'Sert fren (expo)', fn: cubicBezier(0.16, 1, 0.3, 1) },
  'ease-out-circ': { label: 'Dairesel', fn: circOut },
  'ease-out-back': { label: 'Hafif taşma', fn: backOut },
  anticipate: { label: 'Geri çekil, fırla', fn: anticipate },
  'spring-gentle': { label: 'Yay · yumuşak', fn: normalizedSpring(0.15) },
  'spring-snappy': { label: 'Yay · canlı', fn: normalizedSpring(0.3) },
  'spring-bouncy': { label: 'Yay · zıplayan', fn: normalizedSpring(0.5) },
}

export function getEasing(name: string | undefined): EasingFn {
  return (name && EASINGS[name]?.fn) || EASINGS.linear.fn
}
