import { easingFor } from './easing'
import { PRESETS, resolveParams } from './presets'
import type { Block, CameraState, FrameState, Layer, LayerState, Project } from './types'

const DEG = Math.PI / 180

function progress(block: Block, time: number) {
  if (block.duration <= 0) return time >= block.start ? 1 : 0
  return Math.min(1, Math.max(0, (time - block.start) / block.duration))
}

function sortedBlocks(blocks: Block[]) {
  return [...blocks].sort((a, b) => a.start - b.start)
}

/**
 * Katman o anda klibinin içinde mi. Başı dahil, sonu hariç: arka arkaya iki klip kesme anında
 * aynı karede görünmez (video kareleri 0..süre arasında, son an çizilmez).
 */
export function inClip(layer: Pick<Layer, 'start' | 'duration'>, time: number) {
  return time >= layer.start - 1e-6 && time < layer.start + layer.duration - 1e-6
}

export function evaluateLayer(layer: Layer, time: number): LayerState {
  const s: LayerState = {
    x: layer.position[0],
    y: layer.position[1],
    z: layer.position[2],
    rotX: layer.rotation[0] * DEG,
    rotY: layer.rotation[1] * DEG,
    rotZ: layer.rotation[2] * DEG,
    scale: layer.scale,
    opacity: layer.opacity,
    textReveal: 1,
    numberValue: null,
    wordReveal: 1,
    wipe: 1,
    softReveal: 1,
    revealSoftness: 0.3,
    letterSpacing: 0,
  }
  // Klibin dışında katman çizilmez; bloklar klibin başından itibaren zamanlanır.
  if (!inClip(layer, time)) s.opacity = 0
  const local = time - layer.start
  for (const block of sortedBlocks(layer.blocks)) {
    const preset = PRESETS[block.preset]
    if (!preset || preset.target !== 'layer') continue
    const p = progress(block, local)
    const e = easingFor(block, preset.defaultEasing)(p)
    preset.apply(s, e, p, resolveParams(preset, block.params), block.duration)
  }
  return s
}

export function evaluateCamera(project: Project, time: number): CameraState {
  const cam = project.camera
  const s: CameraState = {
    x: cam.position[0],
    y: cam.position[1],
    z: cam.position[2],
    fov: cam.fov,
    targetX: 0,
    targetY: 0,
    focusZ: 0,
    focusBlur: 1,
    overlayOpacity: 0,
    overlayWhite: 0,
    aberration: 0,
    flare: 0,
    flareX: 0,
    flareY: 0,
    leak: 0,
  }
  for (const block of sortedBlocks(cam.blocks)) {
    const preset = PRESETS[block.preset]
    if (!preset || preset.target !== 'camera') continue
    const p = progress(block, time)
    const e = easingFor(block, preset.defaultEasing)(p)
    preset.apply(s, e, p, resolveParams(preset, block.params), block.duration)
  }
  return s
}

/** "t anında ekranda ne var?" Önizleme ve video çıktısı aynı fonksiyonu kullanır. */
export function evaluate(project: Project, time: number): FrameState {
  const layers: Record<string, LayerState> = {}
  // Oynatma kafası videonun tam sonundayken son kare gösterilsin: klip sonu hariç olduğu için
  // sona kadar süren katmanlar o an kaybolurdu. (Video kareleri zaten sondan önce biter.)
  const layerTime = Math.min(time, project.duration - 1e-3)
  for (const layer of project.layers) layers[layer.id] = evaluateLayer(layer, layerTime)
  return { time, layers, camera: evaluateCamera(project, time) }
}

/** Typewriter ve count-up'ı uygulayıp ekranda gösterilecek metni döndürür. */
export function displayText(layer: Layer, state: LayerState, numberLocale = 'en-US'): string {
  let base = state.numberValue !== null ? state.numberValue.toLocaleString(numberLocale) : (layer.text ?? '')
  if (state.wordReveal < 1) {
    // Kelimeleri (arasındaki boşluklarla) say; ilk n tanesini göster.
    const words = base.match(/\S+\s*/g) ?? []
    base = words.slice(0, Math.round(words.length * state.wordReveal)).join('').trimEnd()
  }
  if (state.textReveal >= 1) return base
  return base.slice(0, Math.round(base.length * state.textReveal))
}
