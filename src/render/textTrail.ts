import { Color } from 'three'

/**
 * Daktilonun renkli izi: en son yazılan harf `hue` tonunda, gerisi metnin rengine doğru karışır.
 * troika `colorRanges` bir harf sırasından itibaren rengi değiştirir; iz dışında kalan harfler temel renk.
 */
export function trailColorRanges(text: string, base: string, trail: number, hue: number): Record<number, number> | null {
  const body = text.endsWith('|') ? text.length - 1 : text.length
  if (trail <= 0 || body <= 0) return null
  const baseColor = new Color(base)
  const accent = new Color().setHSL(hue / 360, 0.8, 0.52)
  const ranges: Record<number, number> = { 0: baseColor.getHex() }
  for (let k = 0; k < Math.min(trail, body); k++) {
    ranges[body - 1 - k] = accent.clone().lerp(baseColor, k / trail).getHex()
  }
  if (body < text.length) ranges[body] = baseColor.getHex()
  return ranges
}
