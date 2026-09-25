import { create } from 'zustand'

export type TransformMode = 'translate' | 'rotate' | 'scale'

interface EditorStore {
  /** Önizlemedeki tutamacın modu: taşı / döndür / ölçekle (W / E / R). */
  transformMode: TransformMode
  setTransformMode: (mode: TransformMode) => void
  /** Hizalama çizgilerine yapışma ve 15°'lik dönüş adımları. */
  snapping: boolean
  toggleSnapping: () => void
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
}

export const useEditorStore = create<EditorStore>()((set) => ({
  transformMode: 'translate',
  setTransformMode: (transformMode) => set({ transformMode }),
  snapping: true,
  toggleSnapping: () => set((s) => ({ snapping: !s.snapping })),
  showGuides: false,
  toggleGuides: () => set((s) => ({ showGuides: !s.showGuides })),
  cleanRenders: 0,
  beginCleanRender: () => set((s) => ({ cleanRenders: s.cleanRenders + 1 })),
  endCleanRender: () => set((s) => ({ cleanRenders: Math.max(0, s.cleanRenders - 1) })),
}))

/**
 * Elle sürüklenen katman; motor o katmanın konumunu sürükleme bitene kadar ezmez.
 * `releasedAt`: tutamaçtan fare bırakıldıktan hemen sonra gelen "boşluğa tıklama" seçimi kaldırmasın.
 */
export const manualDrag: { layerId: string | null; releasedAt: number } = { layerId: null, releasedAt: 0 }

export const gizmoJustReleased = () => performance.now() - manualDrag.releasedAt < 300
