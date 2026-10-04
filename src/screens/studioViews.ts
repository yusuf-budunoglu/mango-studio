import type { ProjectSummary } from '../persistence/repository'
import type { StudioView } from '../router'

/**
 * Studio bölümünde görünür mü: şablonlar yalnızca Şablonlarım'da, videolar ve görseller (tasarımlar) kendi
 * bölümlerinde, Tümü şablon olmayan her projede. Sesler bölümü proje değil dosya listeler.
 */
export function inStudioView(p: ProjectSummary, view: StudioView | undefined): boolean {
  if (view === 'sounds') return false
  if (view === 'templates') return !!p.isTemplate
  if (p.isTemplate) return false
  if (view === 'videos') return p.mode !== 'design'
  if (view === 'images') return p.mode === 'design'
  return true
}
