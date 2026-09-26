/**
 * Önizlemede kadraj dışı (taşma): video kadrajının çevresinde ince bir şerit de çizilir; böylece
 * kadraja giren/çıkan nesneler dışarıda da görünür. Şerit her kenarda kadrajın kısa kenarının
 * OVERSCAN_MARGIN katı (dikey videoda kısa kenar genişlik olduğu için şerit daha ince kalır).
 * Kanvas yalnızca kadraj + şerit alanını kaplar; kamera, kadraj içi aynı kalacak şekilde daha geniş
 * açıyla çizer. Video çıktısı ve küçük resim yalnızca kadrajı içerir.
 */

/** Şeridin kalınlığı: kadrajın kısa kenarına oranı (her kenarda). */
export const OVERSCAN_MARGIN = 0.14

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PreviewLayout {
  /** kanvasın önizleme alanındaki yeri (kadraj + şerit), piksel */
  view: FrameRect
  /** kadrajın kanvas içindeki yeri, piksel */
  frame: FrameRect
  /** dikey genişleme katsayısı: kanvas yüksekliği / kadraj yüksekliği */
  k: number
}

/** Önizleme alanına (width × height) sığan kanvas ve kadraj yerleşimi. */
export function previewLayout(width: number, height: number, aspect: number, overscan: boolean): PreviewLayout {
  const m = overscan ? OVERSCAN_MARGIN : 0
  // kısa kenar genişlikse (dikey) şerit = m·genişlik, değilse m·yükseklik
  const fw = aspect >= 1 ? Math.min(width / (1 + (2 * m) / aspect), height / ((1 + 2 * m) / aspect)) : Math.min(width / (1 + 2 * m), height / (1 / aspect + 2 * m))
  const w = Math.max(1, fw)
  const h = w / aspect
  const pad = m * Math.min(w, h)
  const vw = w + 2 * pad
  const vh = h + 2 * pad
  return {
    view: { x: (width - vw) / 2, y: (height - vh) / 2, w: vw, h: vh },
    frame: { x: pad, y: pad, w, h },
    k: vh / h,
  }
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
