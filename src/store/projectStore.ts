import { create } from 'zustand'
import { temporal } from 'zundo'
import { PRESETS } from '../engine/presets'
import type { Block, Layer, LayerKind, Project } from '../engine/types'
import { sampleProject } from '../project/sampleProject'

let idCounter = 0
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`

/** Katman id'si ya da 'camera'. */
export type TrackId = string

interface ProjectStore {
  project: Project
  selectedBlockId: string | null
  selectBlock: (id: string | null) => void
  updateBlock: (blockId: string, patch: Partial<Omit<Block, 'id'>>) => void
  setBlockTimes: (times: Record<string, { start: number; end: number }>) => void
  addBlock: (trackId: TrackId, preset: string, start: number) => void
  removeBlock: (blockId: string) => void
  updateLayer: (layerId: string, patch: Partial<Omit<Layer, 'id' | 'blocks'>>) => void
  addLayer: (kind: LayerKind, time: number) => string
  removeLayer: (layerId: string) => void
}

const LAYER_DEFAULTS: Record<LayerKind, Omit<Layer, 'id' | 'blocks'>> = {
  text: { name: 'Metin', kind: 'text', text: 'Yeni metin', color: '#ffffff', fontSize: 0.4, position: [0, 0, 0.5], rotation: [0, 0, 0], scale: 1, opacity: 1 },
  phone: { name: 'Telefon', kind: 'phone', color: '#4fc3cf', position: [0, 0, 0], rotation: [0, -15, 0], scale: 1, opacity: 1 },
  shape: { name: 'Şekil', kind: 'shape', color: '#ffb86c', position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1 },
  image: { name: 'Görsel', kind: 'image', color: '#ffffff', position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1 },
}

function mapBlocks(project: Project, fn: (blocks: Block[], trackId: TrackId) => Block[]): Project {
  return {
    ...project,
    camera: { ...project.camera, blocks: fn(project.camera.blocks, 'camera') },
    layers: project.layers.map((l) => ({ ...l, blocks: fn(l.blocks, l.id) })),
  }
}

export function findBlock(project: Project, blockId: string) {
  for (const track of [project.camera, ...project.layers]) {
    const block = track.blocks.find((b) => b.id === blockId)
    if (block) return { block, track }
  }
  return null
}

export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set) => ({
      project: sampleProject,
      selectedBlockId: null,
      selectBlock: (id) => set({ selectedBlockId: id }),
      updateBlock: (blockId, patch) =>
        set((s) => ({
          project: mapBlocks(s.project, (blocks) => blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b))),
        })),
      setBlockTimes: (times) =>
        set((s) => ({
          project: mapBlocks(s.project, (blocks) =>
            blocks.map((b) => {
              const t = times[b.id]
              if (!t) return b
              const start = Math.max(0, t.start)
              const duration = Math.max(0.05, t.end - t.start)
              return start === b.start && duration === b.duration ? b : { ...b, start, duration }
            }),
          ),
        })),
      addBlock: (trackId, presetName, start) => {
        const preset = PRESETS[presetName]
        if (!preset) return
        const block: Block = { id: newId('b'), preset: presetName, start, duration: preset.defaultDuration }
        set((s) => ({
          project: mapBlocks(s.project, (blocks, id) => (id === trackId ? [...blocks, block] : blocks)),
          selectedBlockId: block.id,
        }))
      },
      removeBlock: (blockId) =>
        set((s) => ({
          project: mapBlocks(s.project, (blocks) => blocks.filter((b) => b.id !== blockId)),
          selectedBlockId: s.selectedBlockId === blockId ? null : s.selectedBlockId,
        })),
      updateLayer: (layerId, patch) =>
        set((s) => ({
          project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) },
        })),
      addLayer: (kind, time) => {
        const layer: Layer = {
          ...LAYER_DEFAULTS[kind],
          id: newId('l'),
          blocks: [{ id: newId('b'), preset: kind === 'text' ? 'slide-up' : 'scale-in', start: time, duration: 0.8 }],
        }
        set((s) => ({ project: { ...s.project, layers: [...s.project.layers, layer] } }))
        return layer.id
      },
      removeLayer: (layerId) =>
        set((s) => ({
          project: { ...s.project, layers: s.project.layers.filter((l) => l.id !== layerId) },
          selectedBlockId: null,
        })),
    }),
    // Sadece proje geri alınır; seçim değişiklikleri geçmişe yazılmaz.
    {
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
    },
  ),
)

/** Oynatma zamanı sık değiştiği için ayrı ve geri alma dışında tutulur. */
interface PlaybackStore {
  time: number
  isPlaying: boolean
  setTime: (t: number) => void
  setPlaying: (v: boolean) => void
}

export const usePlaybackStore = create<PlaybackStore>()((set) => ({
  time: 0,
  isPlaying: false,
  setTime: (time) => set({ time }),
  setPlaying: (isPlaying) => set({ isPlaying }),
}))
