import type { Project } from '../engine/types'
import i18n from '../i18n'
import { exportBridge, pendingModelLoads, pendingTextSyncs, prepareFrameHooks, renderTimeOverride } from './bridge'
import { supersampleFactor } from './exportVideo'

export type ImageFormat = 'png' | 'jpg'

export interface ImageOptions {
  format: ImageFormat
  /** proje boyutunun katı (1 = tasarımın piksel boyutu) */
  scale: 1 | 2
}

export const DEFAULT_IMAGE: ImageOptions = { format: 'png', scale: 1 }

/** Tarayıcının çizebileceği en büyük kenar (GPU sınırı); 2× bunu aşarsa seçilemez. */
export const MAX_IMAGE_SIDE = 4096

export function imageSize(project: Pick<Project, 'width' | 'height'>, scale: number) {
  return { width: Math.round(project.width * scale), height: Math.round(project.height * scale) }
}

export const canScale = (project: Pick<Project, 'width' | 'height'>, scale: number) => Math.max(project.width, project.height) * scale <= MAX_IMAGE_SIDE

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

/**
 * Tasarımı (sahnenin 0. saniyesini) tek kare olarak çizip PNG ya da JPG verir. Video çıktısıyla aynı yol:
 * sahne büyük çizilip küçültülür (kenar yumuşatma), cihaz modelleri ve metinler hazır olana kadar beklenir,
 * düzenleme yardımcıları (tutamaç, kılavuz) çıktıda görünmez.
 */
export async function exportImage(project: Project, options: ImageOptions, time = 0): Promise<Blob> {
  const bridge = exportBridge.current
  if (!bridge) throw new Error(i18n.t('exportVideo.notReady'))
  const { width, height } = imageSize(project, options.scale)
  const ss = supersampleFactor(width, height)
  const restore = bridge.begin(Math.round(width * ss), Math.round(height * ss))
  try {
    // yeni çözünürlüğün (ve efekt katmanlarının yeniden boyutlanmasının) uygulanmasını bekle
    await wait(100)
    if (pendingModelLoads.size) await Promise.all(pendingModelLoads)
    renderTimeOverride.current = time
    if (prepareFrameHooks.size) await Promise.all([...prepareFrameHooks].map((hook) => hook(time)))
    bridge.renderFrame()
    if (pendingTextSyncs.size) {
      await Promise.all(pendingTextSyncs)
      bridge.renderFrame()
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error(i18n.t('exportImage.failed'))
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    // çizimden hemen sonra (aynı görevde) kopyala
    ctx.drawImage(bridge.canvas, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, options.format === 'png' ? 'image/png' : 'image/jpeg', options.format === 'jpg' ? 0.92 : undefined),
    )
    if (!blob) throw new Error(i18n.t('exportImage.failed'))
    return blob
  } finally {
    renderTimeOverride.current = null
    restore()
  }
}
