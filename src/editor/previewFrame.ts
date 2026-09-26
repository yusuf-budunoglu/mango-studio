/**
 * Önizlemede kadraj dışı (taşma): kanvas tüm önizleme alanını kaplar, video kadrajı ortada bir
 * dikdörtgendir. Kamera, kadraj içi aynı kalacak şekilde daha geniş açıyla çizer; böylece kadraja
 * giren/çıkan nesneler dışarıda da görünür. Video çıktısı ve küçük resim yalnızca kadrajı içerir.
 */

/** Kadrajın önizleme alanında kapladığı oran (taşma açıkken); kalan kısım kadraj dışı. */
export const OVERSCAN_FIT = 0.72

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

/** Kadraj dikdörtgeni (piksel) ve dikey genişleme katsayısı k = alan yüksekliği / kadraj yüksekliği. */
export function previewFrame(width: number, height: number, aspect: number, overscan: boolean): FrameRect & { k: number } {
  const fit = overscan ? OVERSCAN_FIT : 1
  const w = Math.max(1, Math.min(width * fit, height * fit * aspect))
  const h = w / aspect
  return { x: (width - w) / 2, y: (height - h) / 2, w, h, k: height > 0 ? height / h : 1 }
}

/** Kadrajın dikey görüş açısı `fov` iken, k kat yüksek alanı kaplayan görüş açısı (derece). */
export function overscanFov(fov: number, k: number): number {
  if (k <= 1) return fov
  return (2 * Math.atan(k * Math.tan((fov * Math.PI) / 360)) * 180) / Math.PI
}

/**
 * Stage'in ölçtüğü güncel değerler; sahne her karede okur (React yeniden çizilmeden).
 * `frame` kanvasa göre oransal (0..1): küçük resim bu bölgeden kırpılır.
 */
export const previewView: { k: number; frame: FrameRect } = { k: 1, frame: { x: 0, y: 0, w: 1, h: 1 } }
