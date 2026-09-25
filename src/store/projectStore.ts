import { create } from 'zustand'
import { temporal } from 'zundo'
import { newId } from '../engine/ids'
import i18n from '../i18n'
import { PRESETS } from '../engine/presets'
import type { AudioClip, Block, Layer, LayerKind, Project } from '../engine/types'
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
  /** Seçili katman id'si, 'camera' ya da seçim yoksa ''. Önizleme, timeline ve panel paylaşır. */
  selectedTrackId: TrackId
  selectTrack: (id: TrackId) => void
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
  /** Katmanı listede `toIndex` konumuna taşır (0 = en üst = en önde). */
  moveLayer: (layerId: string, toIndex: number) => void
  duplicateLayer: (layerId: string) => void
  /** Bloğu başka bir satıra taşır; hedef, bloğun türüne uymuyorsa (kamera/katman) bir şey yapmaz. */
  moveBlockToTrack: (blockId: string, trackId: TrackId) => void
  /** Oynatma kafasının üstündeki blokları ve ses parçalarını ikiye böler. */
  splitBlocks: (blockIds: string[], at: number) => void
  /** Ses parçası ekler: dosyanın tamamı, videoya sığdığı kadar. Id'sini döndürür. */
  addAudioClip: (asset: string, name: string, sourceDuration: number, at: number) => string
  updateAudioClip: (clipId: string, patch: Partial<Omit<AudioClip, 'id'>>) => void
  /** Timeline'da taşınan/kırpılan ses parçaları: soldan kırpma kaynağın başlangıcını da kaydırır. */
  setAudioTimes: (times: Record<string, { start: number; end: number }>) => void
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

export const findAudio = (project: Project, clipId: string) => project.audio?.find((c) => c.id === clipId)

function mapAudio(project: Project, fn: (clips: AudioClip[]) => AudioClip[]): Project {
  return project.audio?.length ? { ...project, audio: fn(project.audio) } : project
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
      selectedTrackId: '',
      selectTrack: (id) => set({ selectedTrackId: id }),
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
        const total = get().project.duration
        // Blok videonun içinde kalsın: bitişe çok yakınsa geri çek, gerekirse kısalt.
        const at = round(Math.min(Math.max(0, start), Math.max(0, total - 0.1)))
        const block: Block = { id: newId('b'), preset: presetName, start: at, duration: round(Math.max(0.1, Math.min(preset.defaultDuration, total - at))) }
        set((s) => ({
          project: mapBlocks(s.project, (blocks, id) => (id === trackId ? [...blocks, block] : blocks)),
          selectedBlockIds: [block.id],
        }))
      },
      removeBlocks: (blockIds) => {
        if (!blockIds.length) return
        set((s) => ({
          project: mapAudio(
            mapBlocks(s.project, (blocks) => blocks.filter((b) => !blockIds.includes(b.id))),
            (clips) => clips.filter((c) => !blockIds.includes(c.id)),
          ),
          selectedBlockIds: s.selectedBlockIds.filter((id) => !blockIds.includes(id)),
        }))
      },
      nudgeBlocks: (blockIds, delta) => {
        const project = get().project
        const starts = [
          ...entriesFor(project, blockIds).map((e) => e.block.start),
          ...(project.audio ?? []).filter((c) => blockIds.includes(c.id)).map((c) => c.start),
        ]
        if (!starts.length) return
        // Grubun en erken parçası 0'ın altına inmesin.
        const d = Math.max(delta, -Math.min(...starts))
        if (d === 0) return
        const shift = <T extends { id: string; start: number }>(item: T): T => (blockIds.includes(item.id) ? { ...item, start: round(item.start + d) } : item)
        set((s) => ({ project: mapAudio(mapBlocks(s.project, (blocks) => blocks.map(shift)), (clips) => clips.map(shift)) }))
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
        const clips = (get().project.audio ?? []).filter((c) => blockIds.includes(c.id))
        const spans = [...entries.map((e) => e.block), ...clips]
        if (!spans.length) return
        const start = Math.min(...spans.map((b) => b.start))
        const end = Math.max(...spans.map((b) => b.start + b.duration))
        set((s) => {
          const { project, created } = insertCopies(s.project, entries, end - start)
          const audioCopies = clips.map((c) => ({ ...c, id: newId('au'), start: round(c.start + end - start) }))
          return {
            project: audioCopies.length ? { ...project, audio: [...(project.audio ?? []), ...audioCopies] } : project,
            selectedBlockIds: [...created, ...audioCopies.map((c) => c.id)],
          }
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
        set((s) => ({ project: { ...s.project, layers: [...s.project.layers, layer] }, selectedTrackId: layer.id }))
        return layer.id
      },
      removeLayer: (layerId) =>
        set((s) => ({
          project: { ...s.project, layers: s.project.layers.filter((l) => l.id !== layerId) },
          selectedBlockIds: [],
          selectedTrackId: s.selectedTrackId === layerId ? '' : s.selectedTrackId,
        })),
      moveLayer: (layerId, toIndex) =>
        set((s) => {
          const layers = [...s.project.layers]
          const from = layers.findIndex((l) => l.id === layerId)
          const to = Math.max(0, Math.min(layers.length - 1, toIndex))
          if (from === -1 || from === to) return {}
          const [layer] = layers.splice(from, 1)
          layers.splice(to, 0, layer)
          return { project: { ...s.project, layers } }
        }),
      duplicateLayer: (layerId) =>
        set((s) => {
          const index = s.project.layers.findIndex((l) => l.id === layerId)
          if (index === -1) return {}
          const source = s.project.layers[index]
          const copy: Layer = {
            ...source,
            id: newId('l'),
            name: i18n.t('home.copyName', { name: source.name }),
            blocks: source.blocks.map((b) => ({ ...b, id: newId('b') })),
          }
          const layers = [...s.project.layers]
          layers.splice(index, 0, copy)
          return { project: { ...s.project, layers }, selectedTrackId: copy.id, selectedBlockIds: [] }
        }),
      moveBlockToTrack: (blockId, trackId) =>
        set((s) => {
          const found = findBlock(s.project, blockId)
          const preset = found && PRESETS[found.block.preset]
          if (!found || !preset || found.track.id === trackId) return {}
          const targetIsCamera = trackId === 'camera'
          if ((preset.target === 'camera') !== targetIsCamera) return {}
          if (!targetIsCamera && !s.project.layers.some((l) => l.id === trackId)) return {}
          const block = found.block
          return {
            project: mapBlocks(s.project, (blocks, id) =>
              id === trackId ? [...blocks, block] : blocks.filter((b) => b.id !== blockId),
            ),
            selectedTrackId: trackId,
          }
        }),
      splitBlocks: (blockIds, at) =>
        set((s) => {
          const created: string[] = []
          const t = round(at)
          const project = mapBlocks(s.project, (blocks) =>
            blocks.flatMap((b) => {
              // Sadece oynatma kafası bloğun içindeyse (kenarlarında değil) böl.
              if (!blockIds.includes(b.id) || t <= b.start + 0.01 || t >= b.start + b.duration - 0.01) return [b]
              const second = { ...b, id: newId('b'), start: t, duration: round(b.start + b.duration - t) }
              created.push(second.id)
              return [{ ...b, duration: round(t - b.start) }, second]
            }),
          )
          // Ses parçası bölünürken ikinci parça kaynağın kaldığı yerden devam eder.
          const withAudio = mapAudio(project, (clips) =>
            clips.flatMap((c) => {
              if (!blockIds.includes(c.id) || t <= c.start + 0.01 || t >= c.start + c.duration - 0.01) return [c]
              const cut = round(t - c.start)
              const second = { ...c, id: newId('au'), start: t, offset: round(c.offset + cut), duration: round(c.duration - cut), fadeIn: 0 }
              created.push(second.id)
              return [{ ...c, duration: cut, fadeOut: 0 }, second]
            }),
          )
          return created.length ? { project: withAudio, selectedBlockIds: created } : {}
        }),
      addAudioClip: (asset, name, sourceDuration, at) => {
        const total = get().project.duration
        const start = round(Math.min(Math.max(0, at), Math.max(0, total - 0.1)))
        const clip: AudioClip = {
          id: newId('au'),
          name,
          asset,
          start,
          offset: 0,
          duration: round(Math.max(0.1, Math.min(sourceDuration, total - start))),
          sourceDuration,
          volume: 1,
          fadeIn: 0,
          fadeOut: 0.5,
        }
        set((s) => ({
          project: { ...s.project, audio: [...(s.project.audio ?? []), clip] },
          selectedBlockIds: [clip.id],
          selectedTrackId: 'audio',
        }))
        return clip.id
      },
      updateAudioClip: (clipId, patch) =>
        set((s) => ({ project: mapAudio(s.project, (clips) => clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c))) })),
      setAudioTimes: (times) =>
        set((s) => ({
          project: mapAudio(s.project, (clips) =>
            clips.map((c) => {
              const next = times[c.id]
              if (!next) return c
              const start = round(Math.max(0, next.start))
              const end = round(next.end)
              const oldEnd = round(c.start + c.duration)
              if (start === c.start && end === oldEnd) return c
              // Sadece sol kenar değiştiyse kırpmadır: kaynakta da o kadar ileri/geri git.
              const trimmedLeft = end === oldEnd && start !== c.start
              const offset = trimmedLeft ? round(Math.max(0, c.offset + (start - c.start))) : c.offset
              const duration = round(Math.max(0.05, Math.min(end - start, c.sourceDuration - offset)))
              return { ...c, start, offset, duration }
            }),
          ),
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
        set({ project, selectedBlockIds: [], selectedTrackId: project.layers[0]?.id ?? 'camera' })
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
