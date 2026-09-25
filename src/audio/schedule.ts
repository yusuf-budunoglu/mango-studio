import type { AudioClip } from '../engine/types'

/** Bir ses parçasının, videonun `from` anından itibaren nasıl çalınacağı. */
export interface ClipPlan {
  /** çalmaya başlamadan önce ne kadar beklenecek (sn) */
  delay: number
  /** kaynak dosyada nereden başlanacak (sn) */
  sourceOffset: number
  /** ne kadar çalınacak (sn) */
  length: number
  /** ses seviyesi noktaları: çalma başından itibaren (sn) → kazanç; aralar doğrusal */
  envelope: { at: number; gain: number }[]
}

/** Parçanın kendi zamanında (0..duration) ses seviyesi: açılış/kapanış dahil. */
export function clipGainAt(clip: AudioClip, local: number): number {
  const fadeIn = clip.fadeIn > 0 ? Math.min(1, local / clip.fadeIn) : 1
  const fadeOut = clip.fadeOut > 0 ? Math.min(1, (clip.duration - local) / clip.fadeOut) : 1
  return clip.volume * Math.max(0, Math.min(fadeIn, fadeOut))
}

/**
 * Önizleme ve video çıktısı bu planı kullanır; böylece ikisi aynı sesi üretir.
 * Parça `from`'dan önce bitmişse null döner.
 */
export function planClip(clip: AudioClip, from: number): ClipPlan | null {
  const end = clip.start + clip.duration
  if (end <= from + 1e-6 || clip.duration <= 0) return null
  const localStart = Math.max(0, from - clip.start)
  const delay = Math.max(0, clip.start - from)
  const length = clip.duration - localStart
  // Seviye değişim noktaları: şu an, açılışın sonu, kapanışın başı, bitiş.
  const marks = [localStart, clip.fadeIn, clip.duration - clip.fadeOut, clip.duration]
    .filter((m) => m >= localStart - 1e-9 && m <= clip.duration + 1e-9)
    .sort((a, b) => a - b)
    .filter((m, i, arr) => i === 0 || m - arr[i - 1] > 1e-6)
  return {
    delay,
    sourceOffset: clip.offset + localStart,
    length,
    envelope: marks.map((m) => ({ at: m - localStart, gain: clipGainAt(clip, m) })),
  }
}

/** Ses dosyasından küçük bir dalga görüntüsü: her kova için en yüksek genlik (0..1). */
export function computePeaks(channels: Float32Array[], buckets: number): number[] {
  const length = channels[0]?.length ?? 0
  const size = Math.max(1, Math.floor(length / buckets))
  const peaks: number[] = []
  for (let b = 0; b < buckets; b++) {
    let max = 0
    const startIndex = b * size
    const endIndex = Math.min(length, startIndex + size)
    for (const data of channels) {
      for (let i = startIndex; i < endIndex; i += 4) {
        const v = Math.abs(data[i])
        if (v > max) max = v
      }
    }
    peaks.push(max)
  }
  return peaks
}
