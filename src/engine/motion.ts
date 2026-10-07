import { evaluate } from './evaluate'
import type { Project } from './types'

/** Katmanın dönerken/ölçeklenirken en uzak noktasının merkeze uzaklığı için kaba üst sınır (birim, ölçek 1 iken) */
const REACH = 3
/** Alt kareler arasında kabul edilen en büyük kayma (çıktı pikseli): bunun üstünde bulanıklık basamaklı görünür */
const STEP_PX = 1.5
const DEG = Math.PI / 180

/**
 * `t` ile `t + span` arasında ekranda en çok kaç piksel hareket olduğunun kaba üst sınırı (çıktı `height` piksel
 * yüksekliğinde). Katmanların ve kameranın iki andaki durumundan hesaplanır; görünmeyen katmanlar sayılmaz.
 */
export function frameMotion(project: Project, t: number, span: number, height: number) {
  const a = evaluate(project, t)
  const b = evaluate(project, t + span)
  const distance = Math.max(0.5, Math.abs(a.camera.z))
  const perUnit = height / (2 * distance * Math.tan((a.camera.fov * DEG) / 2))
  const cam =
    Math.hypot(b.camera.x - a.camera.x, b.camera.y - a.camera.y) +
    Math.hypot(b.camera.targetX - a.camera.targetX, b.camera.targetY - a.camera.targetY) +
    // yaklaşma/uzaklaşma ve açı değişimi kadrajın kenarını bu oranda kaydırır
    (Math.abs(b.camera.z - a.camera.z) / distance + Math.abs(b.camera.fov - a.camera.fov) / a.camera.fov) * distance
  let most = cam
  for (const layer of project.layers) {
    const p = a.layers[layer.id]
    const q = b.layers[layer.id]
    if (!p || !q || layer.hidden || (p.opacity <= 0 && q.opacity <= 0)) continue
    const reach = REACH * Math.max(p.scale, q.scale)
    const turn = Math.abs(q.rotX - p.rotX) + Math.abs(q.rotY - p.rotY) + Math.abs(q.rotZ - p.rotZ) + Math.abs(q.fold - p.fold) * DEG
    const moved = Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) + reach * turn + REACH * Math.abs(q.scale - p.scale)
    most = Math.max(most, cam + moved)
  }
  return most * perUnit
}

/**
 * Hareket bulanıklığında bu kare için gereken alt kare sayısı: hareket yoksa 1, hızlı harekette `max`.
 * Örnek sayısı sabit olunca duran karelerde boşa çizim yapılıyor, hızlı dönüşlerde ise kopyalar tek tek seçiliyordu.
 */
export function motionSamples(project: Project, t: number, fps: number, max: number, shutter: number, height: number) {
  if (max <= 1) return 1
  const motion = frameMotion(project, t, shutter / fps, height)
  if (motion < 0.25) return 1
  return Math.min(max, Math.max(2, Math.ceil(motion / STEP_PX)))
}

/** Hareket bulanıklığında bir karenin alt kare zamanları: kare anından ileriye, deklanşör süresince. */
export function subframeTimes(t: number, fps: number, samples: number, shutter: number) {
  if (samples <= 1) return [t]
  return Array.from({ length: samples }, (_, k) => t + (k / samples) * (shutter / fps))
}
