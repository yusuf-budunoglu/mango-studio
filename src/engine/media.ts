import type { Layer } from './types'

/** Video katmanı: proje zamanı → videonun kaynak zamanı (sn), videonun sınırları içinde. */
export function videoSourceTime(layer: Pick<Layer, 'start' | 'mediaOffset'>, time: number, duration: number) {
  const t = time - layer.start + (layer.mediaOffset ?? 0)
  return Math.min(Math.max(0, t), Math.max(0, duration - 0.02))
}
