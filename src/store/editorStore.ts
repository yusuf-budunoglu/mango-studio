import { create } from 'zustand'

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type LayerTab = 'basic' | 'animation'
export type ProjectTab = 'project' | 'effects'

export type LibraryTab = 'text' | 'devices' | 'media' | 'shapes' | 'audio' | 'effects' | 'transitions' | 'camera'

const TIMELINE_HEIGHT_KEY = 'motion-studio.timeline-height'
const OVERSCAN_KEY = 'motion-studio.overscan'

function readOverscan() {
  try {
    return localStorage.getItem(OVERSCAN_KEY) !== '0'
  } catch {
    return true
  }
}
export const TIMELINE_MIN = 180

function readTimelineHeight() {
  try {
    const v = Number(localStorage.getItem(TIMELINE_HEIGHT_KEY))
    return Number.isFinite(v) && v >= TIMELINE_MIN ? v : 320
  } catch {
    return 320
  }
}

interface EditorStore {
  /** Önizlemedeki tutamacın modu: taşı / döndür / ölçekle (W / E / R). */
  transformMode: TransformMode
  setTransformMode: (mode: TransformMode) => void
  /** Hizalama çizgilerine yapışma ve 15°'lik dönüş adımları. */
  snapping: boolean
  toggleSnapping: () => void
  /** Önizlemede kadraj dışını da göster (nesnelerin nereden gelip nereye gittiği görünsün). */
  showOverscan: boolean
  toggleOverscan: () => void
  /** Güvenli alan kılavuzları. */
  showGuides: boolean
  toggleGuides: () => void
  /**
   * Doluysa tutamaç, kılavuz gibi düzenleme yardımcıları çizilmez. Video çıktısı ve küçük resim
   * üretilirken açılır; sayaçtır, çünkü ikisi aynı anda isteyebilir.
   */
  cleanRenders: number
  beginCleanRender: () => void
  endCleanRender: () => void
  /** Timeline'da animasyon şeridi açık klipler (katman id'leri). */
  expandedLayers: string[]
  toggleExpanded: (layerId: string) => void
  /** Sol kütüphanenin açık sekmesi. */
  libraryTab: LibraryTab
  setLibraryTab: (tab: LibraryTab) => void
  /** Sağ paneldeki sekmeler; klipler arasında geçerken korunur. */
  layerTab: LayerTab
  setLayerTab: (tab: LayerTab) => void
  projectTab: ProjectTab
  setProjectTab: (tab: ProjectTab) => void
  /** Timeline panelinin yüksekliği (px); tarayıcıda hatırlanır. */
  timelineHeight: number
  setTimelineHeight: (px: number) => void
}

export const useEditorStore = create<EditorStore>()((set) => ({
  transformMode: 'translate',
  setTransformMode: (transformMode) => set({ transformMode }),
  snapping: true,
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  showGuides: false,
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  showOverscan: readOverscan(),
  toggleOverscan: () =>
    set((s) => {
      try {
        localStorage.setItem(OVERSCAN_KEY, s.showOverscan ? '0' : '1')
      } catch {
        // kaydedilemese de bu oturumda çalışır
      }
      return { showOverscan: !s.showOverscan }
    }),
  cleanRenders: 0,
  beginCleanRender: () => set((s) => ({ cleanRenders: s.cleanRenders + 1 })),
  endCleanRender: () => set((s) => ({ cleanRenders: Math.max(0, s.cleanRenders - 1) })),
  expandedLayers: [],
  toggleExpanded: (id) => set((s) => ({ expandedLayers: s.expandedLayers.includes(id) ? s.expandedLayers.filter((x) => x !== id) : [...s.expandedLayers, id] })),
  libraryTab: 'text',
  setLibraryTab: (libraryTab) => set({ libraryTab }),
  layerTab: 'basic',
  setLayerTab: (layerTab) => set({ layerTab }),
  projectTab: 'project',
  setProjectTab: (projectTab) => set({ projectTab }),
  timelineHeight: readTimelineHeight(),
  setTimelineHeight: (px) => {
    const timelineHeight = Math.round(Math.max(TIMELINE_MIN, px))
    try {
      localStorage.setItem(TIMELINE_HEIGHT_KEY, String(timelineHeight))
    } catch {
      // kaydedilemese de bu oturumda çalışır
    }
    set({ timelineHeight })
  },
}))

/**
 * Elle sürüklenen katman; motor o katmanın konumunu sürükleme bitene kadar ezmez.
 * `releasedAt`: tutamaçtan fare bırakıldıktan hemen sonra gelen "boşluğa tıklama" seçimi kaldırmasın.
 */
export const manualDrag: { layerId: string | null; releasedAt: number } = { layerId: null, releasedAt: 0 }

export const gizmoJustReleased = () => performance.now() - manualDrag.releasedAt < 300
