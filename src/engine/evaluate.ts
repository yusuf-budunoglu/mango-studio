import { getEasing } from './easing'
import { PRESETS } from './presets'
import type { Block, CameraState, FrameState, Layer, LayerState, Project } from './types'

const DEG = Math.PI / 180

function progress(block: Block, time: number) {
  if (block.duration <= 0) return time >= block.start ? 1 : 0
  return Math.min(1, Math.max(0, (time - block.start) / block.duration))
}

function sortedBlocks(blocks: Block[]) {
  return [...blocks].sort((a, b) => a.start - b.start)
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
  }
  for (const block of sortedBlocks(layer.blocks)) {
    const preset = PRESETS[block.preset]
    if (!preset || preset.target !== 'layer') continue
    const p = progress(block, time)
    const e = getEasing(block.easing ?? preset.defaultEasing)(p)
    preset.apply(s, e, p, block.params ?? {})
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
  }
  for (const block of sortedBlocks(cam.blocks)) {
    const preset = PRESETS[block.preset]
    if (!preset || preset.target !== 'camera') continue
    const p = progress(block, time)
    const e = getEasing(block.easing ?? preset.defaultEasing)(p)
    preset.apply(s, e, p, block.params ?? {})
  }
  return s
}

/** "t anında ekranda ne var?" Önizleme ve video çıktısı aynı fonksiyonu kullanır. */
export function evaluate(project: Project, time: number): FrameState {
  const layers: Record<string, LayerState> = {}
  for (const layer of project.layers) layers[layer.id] = evaluateLayer(layer, time)
  return { time, layers, camera: evaluateCamera(project, time) }
}

/** Typewriter ve count-up'ı uygulayıp ekranda gösterilecek metni döndürür. */
export function displayText(layer: Layer, state: LayerState, numberLocale = 'en-US'): string {
  const base = state.numberValue !== null ? state.numberValue.toLocaleString(numberLocale) : (layer.text ?? '')
  if (state.textReveal >= 1) return base
  return base.slice(0, Math.round(base.length * state.textReveal))
}
