import type { Layer, LayerState, Vec3 } from './types'

const RAD_TO_DEG = 180 / Math.PI
const round = (v: number) => Math.round(v * 1000) / 1000

/** Önizlemede elle taşınan nesnenin ekrandaki son hali. */
export interface DisplayedTransform {
  position: Vec3
  /** radyan */
  rotation: Vec3
  scale: number
}

/**
 * Ekranda görünen = katmanın temel değeri + o andaki animasyon etkisi. Kullanıcı nesneyi
 * elle taşıdığında animasyon etkisini koruyup temel değeri değiştiririz: konum ve dönüş
 * farkı eklenir, ölçek oranla çarpılır. Böylece animasyonlar yeni yerde aynen oynar.
 *
 * `evaluated`: aynı andaki motor sonucu (sürüklemeden önceki ekrandaki hal).
 */
export function manualTransformPatch(
  layer: Layer,
  evaluated: LayerState,
  displayed: DisplayedTransform,
): Pick<Layer, 'position' | 'rotation' | 'scale'> {
  const [px, py, pz] = displayed.position
  const [rx, ry, rz] = displayed.rotation
  const scaleFactor = evaluated.scale !== 0 ? displayed.scale / evaluated.scale : 1
  return {
    position: [
      round(layer.position[0] + (px - evaluated.x)),
      round(layer.position[1] + (py - evaluated.y)),
      round(layer.position[2] + (pz - evaluated.z)),
    ],
    rotation: [
      round(layer.rotation[0] + (rx - evaluated.rotX) * RAD_TO_DEG),
      round(layer.rotation[1] + (ry - evaluated.rotY) * RAD_TO_DEG),
      round(layer.rotation[2] + (rz - evaluated.rotZ) * RAD_TO_DEG),
    ],
    scale: round(Math.max(0.01, layer.scale * scaleFactor)),
  }
}

/**
 * Taşınan noktayı yakındaki hizalama çizgilerine yapıştırır (ekran ortası, diğer katmanlar).
 * Yapıştığı çizgileri de döndürür ki kılavuz olarak çizilsin.
 */
export function snapToGuides(
  x: number,
  y: number,
  candidates: { x: number[]; y: number[] },
  threshold: number,
): { x: number; y: number; guideX: number | null; guideY: number | null } {
  const nearest = (value: number, lines: number[]) => {
    let best: number | null = null
    for (const line of lines) {
      if (Math.abs(value - line) <= threshold && (best === null || Math.abs(value - line) < Math.abs(value - best))) best = line
    }
    return best
  }
  const gx = nearest(x, candidates.x)
  const gy = nearest(y, candidates.y)
  return { x: gx ?? x, y: gy ?? y, guideX: gx, guideY: gy }
}
