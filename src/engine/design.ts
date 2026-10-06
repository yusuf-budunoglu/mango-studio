import { displayText, evaluateCamera, evaluateLayer } from './evaluate'
import { newId } from './ids'
import type { Block, Project } from './types'

const DEG = Math.PI / 180

/**
 * Tasarım projesinin süresi (sn). Tasarım tek karedir: sahne hep 0. saniyede çizilir, katmanların klibi
 * bu sürenin tamamını kaplar. Süre yalnızca motorun "klip içinde mi" hesabı için var.
 */
export const DESIGN_DURATION = 1

export const isDesign = (project: Pick<Project, 'mode'>) => project.mode === 'design'

/**
 * Hareket projesinin `time` anındaki karesini düzenlenebilir bir tasarıma çevirir ("tasarım olarak kaydet"):
 * o an görünen her katman, animasyonların o anki etkisi temel değerlerine işlenmiş halde (konum, dönüş,
 * ölçek, opaklık, sayaç/daktilo metni) bloksuz gelir. Kamera ve odak da o anki haliyle sabitlenir.
 * Tasarımın 0. saniyesi, videonun `time` anıyla aynı görünür (geçiş örtüsü ve lens patlamaları hariç).
 */
export function freezeFrame(project: Project, time: number, name: string): Project {
  // evaluate() ile aynı: videonun tam sonunda son kare
  const layerTime = Math.min(time, project.duration - 1e-3)
  const layers = project.layers.flatMap((layer) => {
    const s = evaluateLayer(layer, layerTime)
    if (s.opacity <= 0.001) return []
    const frozen = {
      ...layer,
      start: 0,
      duration: DESIGN_DURATION,
      position: [s.x, s.y, s.z] as [number, number, number],
      rotation: [s.rotX / DEG, s.rotY / DEG, s.rotZ / DEG] as [number, number, number],
      scale: s.scale,
      opacity: s.opacity,
      blocks: [],
    }
    if (layer.kind === 'text') {
      frozen.text = displayText(layer, { ...s, caret: false }, project.numberLocale)
      if (s.letterSpacing) frozen.letterSpacing = (layer.letterSpacing ?? 0) + s.letterSpacing
    }
    // katlanır telefon o anki açıklığıyla kalır
    if (layer.kind === 'foldable') frozen.foldAngle = s.fold
    // video o anki karesiyle kalır
    if (layer.kind === 'video') frozen.mediaOffset = (layer.mediaOffset ?? 0) + (layerTime - layer.start)
    return [frozen]
  })

  // Kamera: konum, açı ve baktığı nokta; `camera-move` hem kamerayı hem hedefi kaydırdığı için
  // konumdan hedef kadar çıkarılır, sonra hedef kadar geri kaydırılır.
  const c = evaluateCamera(project, time)
  const blocks: Block[] = []
  if (Math.abs(c.targetX) > 1e-9 || Math.abs(c.targetY) > 1e-9) {
    blocks.push({ id: newId('b'), preset: 'camera-move', start: 0, duration: 0, params: { dx: c.targetX, dy: c.targetY, zoom: 1 } })
  }
  if (c.focusSet) {
    blocks.push({ id: newId('b'), preset: 'focus-pull', start: 0, duration: 0, params: { from: c.focusZ, to: c.focusZ, blur: c.focusBlur } })
  }

  return {
    ...project,
    id: newId('p'),
    name,
    mode: 'design',
    duration: DESIGN_DURATION,
    layers,
    camera: { ...project.camera, position: [c.x - c.targetX, c.y - c.targetY, c.z], fov: c.fov, blocks },
    audio: [],
  }
}
