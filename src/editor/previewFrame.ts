/**
 * Önizlemede kadraj dışı (taşma): kanvas tüm önizleme alanını kaplar, video kadrajı ortada büyükçe
 * durur. Proje arka planı yalnızca kadrajın içinde çizilir; dışarısı editörün koyu zemini, kadraja
 * giren/çıkan nesneler orada soluk (hayalet gibi) görünür. Kamera, kadraj içi aynı kalacak şekilde
 * daha geniş açıyla çizer. Video çıktısı ve küçük resim yalnızca kadrajı içerir.
 */

/** Taşma açıkken kadrajın önizleme alanında kapladığı oran (kısıtlayan kenarda). */
export const OVERSCAN_FIT = 0.9

export interface FrameRect {
  x: number
  y: number
  w: number
  h: number
}

export interface PreviewLayout {
  /** kanvasın önizleme alanındaki yeri, piksel */
  view: FrameRect
  /** kadrajın kanvas içindeki yeri, piksel */
  frame: FrameRect
  /** dikey genişleme katsayısı: kanvas yüksekliği / kadraj yüksekliği */
  k: number
}

/** Önizleme alanına (width × height) sığan kanvas ve kadraj yerleşimi. */
export function previewLayout(width: number, height: number, aspect: number, overscan: boolean): PreviewLayout {
  const fit = overscan ? OVERSCAN_FIT : 1
  const w = Math.max(1, Math.min(width * fit, height * fit * aspect))
  const h = w / aspect
  if (!overscan) return { view: { x: (width - w) / 2, y: (height - h) / 2, w, h }, frame: { x: 0, y: 0, w, h }, k: 1 }
  return {
    view: { x: 0, y: 0, w: width, h: height },
    frame: { x: (width - w) / 2, y: (height - h) / 2, w, h },
    k: height / h,
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
 * `overscan`: proje arka planı yalnızca kadraja çizilsin mi.
 */
export const previewView: { k: number; frame: FrameRect; overscan: boolean } = { k: 1, frame: { x: 0, y: 0, w: 1, h: 1 }, overscan: false }
