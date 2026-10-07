// Tasarımda katman listesi yığın sırasıdır: üstteki katman görüntüde de üstte olmalı. Sahne 3B olduğu için sırayı
// asıl belirleyen derinliktir (önde duran arkadakini örter; liste sırası yalnızca aynı derinlikte ayırır). Bu yüzden
// listede yeri değişen katman, bakış ışını boyunca kameraya yaklaştırılır ya da uzaklaştırılır ve aynı oranda
// ölçeklenir: ekrandaki yeri ve boyu aynı kalır, yalnızca neyin önünde durduğu değişir.

/** Bir katmanın kameraya göre kapladığı yer: derinlik aralığı (bakış yönünde uzaklık) ve ekrandaki kutusu (-1..1). */
export interface Extent {
  near: number
  far: number
  rect: { x0: number; y0: number; x1: number; y1: number }
}

/** katmanlar arasında bırakılan derinlik payı (sahne birimi) */
const GAP = 0.05
/** kameraya bundan fazla yaklaşılmaz (yakın kesme düzlemine girmesin) */
const CLOSEST = 0.6

const overlaps = (a: Extent['rect'], b: Extent['rect']) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/**
 * Katmanın kameraya uzaklığının çarpılacağı oran (1 = yerinde kalır). `front`: katman, ekranda üstüne bindiği
 * `others` katmanlarının hepsinin önüne geçecek kadar yaklaşır. `back`: hepsinin arkasına geçecek kadar uzaklaşır.
 * Ekranda üstüne binmeyen katmanlar sayılmaz (yan yana duran iki nesnenin sırası görüntüyü değiştirmez).
 */
export function restackFactor(self: Extent, others: Extent[], direction: 'front' | 'back') {
  const touching = others.filter((o) => overlaps(self.rect, o.rect))
  if (!touching.length) return 1
  if (direction === 'front') {
    const limit = Math.min(...touching.map((o) => o.near)) - GAP
    if (self.far <= limit) return 1
    return Math.max(CLOSEST / self.near, limit / self.far)
  }
  const limit = Math.max(...touching.map((o) => o.far)) + GAP
  return self.near >= limit ? 1 : limit / self.near
}
