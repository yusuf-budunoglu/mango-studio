import type { Project } from '../engine/types'
import { exportBridge, pendingModelLoads, pendingTextSyncs, renderTimeOverride } from '../export/bridge'
import { previewView } from '../editor/previewFrame'
import { manualDrag } from '../store/editorStore'
import { usePlaybackStore } from '../store/projectStore'

/**
 * Proje kartı için küçük resim: videonun başı genelde boş olduğundan sahne kısa süreliğine
 * temsili bir ana (sürenin %60'ı) alınıp çizilir, sonra kaldığı yere döner. Oynatma ya da
 * elle sürükleme sürerken hiç denenmez; tutamaç o kare için anında gizlenir, kaldırılmaz.
 */
export async function renderThumbnail(project: Project): Promise<string | undefined> {
  const bridge = exportBridge.current
  if (!bridge || usePlaybackStore.getState().isPlaying || manualDrag.layerId || renderTimeOverride.current !== null || pendingModelLoads.size) return undefined
  renderTimeOverride.current = Math.min(project.duration * 0.6, 4)
  bridge.setHelpersVisible(false)
  try {
    bridge.renderFrame()
    if (pendingTextSyncs.size) {
      await Promise.all(pendingTextSyncs)
      bridge.renderFrame()
    }
    return captureThumbnail()
  } finally {
    renderTimeOverride.current = null
    bridge.setHelpersVisible(true)
    bridge.renderFrame()
  }
}

/** Önizleme kanvasının o anki halinden küçük bir JPEG üretir; önizlemedeki kadraj dışı alınmaz. */
export function captureThumbnail(width = 320): string | undefined {
  const source = exportBridge.current?.canvas
  if (!source || !source.width || !source.height) return undefined
  const f = previewView.frame
  const sx = f.x * source.width
  const sy = f.y * source.height
  const sw = f.w * source.width
  const sh = f.h * source.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = Math.round((width * sh) / sw)
  const ctx = canvas.getContext('2d')
  if (!ctx) return undefined
  try {
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.7)
  } catch {
    return undefined
  }
}

/** Metni dosya olarak indirir. */
export function downloadText(filename: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const safeFileName = (name: string) => name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'proje'
