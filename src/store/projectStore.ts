import { create } from 'zustand'
import { temporal } from 'zundo'
import { newId } from '../engine/ids'
import i18n from '../i18n'
import { PRESETS } from '../engine/presets'
import type { Block, Layer, LayerKind, Project } from '../engine/types'
import { DEFAULT_TEMPLATE } from '../project/templates'

/** Katman id'si ya da 'camera'. */
export type TrackId = string

type ProjectSettings = Partial<Pick<Project, 'name' | 'duration' | 'background' | 'numberLocale'>>

interface ClipboardEntry {
  trackId: TrackId
  block: Block
}

interface ProjectStore {
  project: Project
  /** Seçili bloklar; ilk eleman özellik panelinde gösterilen "birincil" seçimdir. */
  selectedBlockIds: string[]
  selectBlock: (id: string | null, additive?: boolean) => void
  updateBlock: (blockId: string, patch: Partial<Omit<Block, 'id'>>) => void
  setBlockTimes: (times: Record<string, { start: number; end: number }>) => void
  addBlock: (trackId: TrackId, preset: string, start: number) => void
  removeBlocks: (blockIds: string[]) => void
  nudgeBlocks: (blockIds: string[], delta: number) => void
  copyBlocks: (blockIds: string[]) => number
  pasteBlocks: (at: number) => void
  duplicateBlocks: (blockIds: string[]) => void
  updateLayer: (layerId: string, patch: Partial<Omit<Layer, 'id' | 'blocks'>>) => void
  addLayer: (kind: LayerKind, time: number) => string
  removeLayer: (layerId: string) => void
  updateProject: (patch: ProjectSettings) => void
  /** Başka bir projeyi açar; geri alma geçmişi sıfırlanır. */
  loadProject: (project: Project) => void
}

/** Yeni katmanın varsayılanları; adı ve metni o anki arayüz dilinde. */
function layerDefaults(kind: LayerKind): Omit<Layer, 'id' | 'blocks'> {
  const t = (key: string) => i18n.t(`layer.defaults.${key}`)
  const base = { position: [0, 0, 0] as Layer['position'], rotation: [0, 0, 0] as Layer['rotation'], scale: 1, opacity: 1 }
  switch (kind) {
    case 'text':
      return { ...base, name: t('text'), kind, text: t('newText'), color: '#ffffff', fontSize: 0.4, position: [0, 0, 0.5] }
    case 'phone':
      return { ...base, name: t('phone'), kind, color: '#4fc3cf', rotation: [0, -15, 0] }
    case 'shape':
      return { ...base, name: t('shape'), kind, color: '#ffb86c' }
    case 'image':
      return { ...base, name: t('image'), kind, color: '#ffffff' }
  }
}

// Kopyalanan bloklar geri alma geçmişinin dışında, bellekte tutulur.
let clipboard: ClipboardEntry[] = []

const round = (t: number) => Math.round(t * 1000) / 1000

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

/** Blokları asıl satırlarına, `offset` kadar kaydırıp yeni id'lerle ekler. */
function insertCopies(project: Project, entries: ClipboardEntry[], offset: number) {
  const created: string[] = []
  const next = mapBlocks(project, (blocks, trackId) => {
    const copies = entries
      .filter((e) => e.trackId === trackId)
      .map((e) => {
        const id = newId('b')
        created.push(id)
        return { ...e.block, id, start: round(Math.max(0, e.block.start + offset)) }
      })
    return copies.length ? [...blocks, ...copies] : blocks
  })
  return { project: next, created }
}

function entriesFor(project: Project, blockIds: string[]): ClipboardEntry[] {
  return blockIds.flatMap((id) => {
    const found = findBlock(project, id)
    return found ? [{ trackId: found.track.id, block: found.block }] : []
  })
}

/**
 * Hızlı art arda gelen değişiklikleri (yazı yazmak, ok tuşuyla kaydırmak) tek bir
 * geri alma adımında birleştirir: bir dizinin ilk değişikliği kaydedilir, 600 ms
 * içindeki devamı yok sayılır.
 */
function coalesce<Args extends unknown[]>(fn: (...args: Args) => void, windowMs = 600) {
  let last = 0
  return (...args: Args) => {
    const now = Date.now()
    if (now - last > windowMs) fn(...args)
    last = now
  }
}

export const useProjectStore = create<ProjectStore>()(
  temporal(
    (set, get) => ({
      project: DEFAULT_TEMPLATE.build(),
      selectedBlockIds: [],
      selectBlock: (id, additive = false) =>
        set((s) => {
          if (id === null) return { selectedBlockIds: [] }
          if (!additive) return { selectedBlockIds: [id] }
          return s.selectedBlockIds.includes(id)
            ? { selectedBlockIds: s.selectedBlockIds.filter((x) => x !== id) }
            : { selectedBlockIds: [id, ...s.selectedBlockIds] }
        }),
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
              const start = round(Math.max(0, t.start))
              const duration = round(Math.max(0.05, t.end - t.start))
              return start === b.start && duration === b.duration ? b : { ...b, start, duration }
            }),
          ),
        })),
      addBlock: (trackId, presetName, start) => {
        const preset = PRESETS[presetName]
        if (!preset) return
        const block: Block = { id: newId('b'), preset: presetName, start: round(start), duration: preset.defaultDuration }
        set((s) => ({
          project: mapBlocks(s.project, (blocks, id) => (id === trackId ? [...blocks, block] : blocks)),
          selectedBlockIds: [block.id],
        }))
      },
      removeBlocks: (blockIds) => {
        if (!blockIds.length) return
        set((s) => ({
          project: mapBlocks(s.project, (blocks) => blocks.filter((b) => !blockIds.includes(b.id))),
          selectedBlockIds: s.selectedBlockIds.filter((id) => !blockIds.includes(id)),
        }))
      },
      nudgeBlocks: (blockIds, delta) => {
        const entries = entriesFor(get().project, blockIds)
        if (!entries.length) return
        // Grubun en erken bloğu 0'ın altına inmesin.
        const d = Math.max(delta, -Math.min(...entries.map((e) => e.block.start)))
        if (d === 0) return
        set((s) => ({
          project: mapBlocks(s.project, (blocks) =>
            blocks.map((b) => (blockIds.includes(b.id) ? { ...b, start: round(b.start + d) } : b)),
          ),
        }))
      },
      copyBlocks: (blockIds) => {
        clipboard = entriesFor(get().project, blockIds)
        return clipboard.length
      },
      pasteBlocks: (at) => {
        if (!clipboard.length) return
        const earliest = Math.min(...clipboard.map((e) => e.block.start))
        // Kaynak katman silinmiş olabilir; sadece var olan satırlara yapıştırılır.
        set((s) => {
          const { project, created } = insertCopies(s.project, clipboard, at - earliest)
          return { project, selectedBlockIds: created }
        })
      },
      duplicateBlocks: (blockIds) => {
        const entries = entriesFor(get().project, blockIds)
        if (!entries.length) return
        const start = Math.min(...entries.map((e) => e.block.start))
        const end = Math.max(...entries.map((e) => e.block.start + e.block.duration))
        set((s) => {
          const { project, created } = insertCopies(s.project, entries, end - start)
          return { project, selectedBlockIds: created }
        })
      },
      updateLayer: (layerId, patch) =>
        set((s) => ({
          project: { ...s.project, layers: s.project.layers.map((l) => (l.id === layerId ? { ...l, ...patch } : l)) },
        })),
      addLayer: (kind, time) => {
        const layer: Layer = {
          ...layerDefaults(kind),
          id: newId('l'),
          blocks: [{ id: newId('b'), preset: kind === 'text' ? 'slide-up' : 'scale-in', start: round(time), duration: 0.8 }],
        }
        set((s) => ({ project: { ...s.project, layers: [...s.project.layers, layer] } }))
        return layer.id
      },
      removeLayer: (layerId) =>
        set((s) => ({
          project: { ...s.project, layers: s.project.layers.filter((l) => l.id !== layerId) },
          selectedBlockIds: [],
        })),
      updateProject: (patch) =>
        set((s) => ({
          project: {
            ...s.project,
            ...patch,
            ...(patch.duration !== undefined && { duration: Math.min(120, Math.max(1, patch.duration)) }),
          },
        })),
      loadProject: (project) => {
        // Yükleme bir düzenleme sayılmasın: kaydı durdur, yükle, geçmişi temizle.
        const history = useProjectStore.temporal.getState()
        history.pause()
        set({ project, selectedBlockIds: [] })
        history.resume()
        history.clear()
      },
    }),
    {
      // Sadece proje geri alınır; seçim değişiklikleri geçmişe yazılmaz.
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
      handleSet: (handleSet) => coalesce(handleSet),
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
