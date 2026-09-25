import { BufferTarget, CanvasSource, getFirstEncodableVideoCodec, Mp4OutputFormat, Output, QUALITY_HIGH } from 'mediabunny'
import type { Project } from '../engine/types'
import i18n from '../i18n'
import { usePlaybackStore } from '../store/projectStore'
import { exportBridge, pendingTextSyncs } from './bridge'

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

/**
 * Projeyi kare kare çizip tarayıcıda MP4'e kodlar. Sunucu gerekmez.
 * Önizlemeyle aynı motor kullanıldığı için ekranda görünen neyse videoya o çıkar.
 */
export async function exportVideo(project: Project, onProgress: (ratio: number) => void): Promise<Blob> {
  const bridge = exportBridge.current
  if (!bridge) throw new Error(i18n.t('exportVideo.notReady'))

  const { width, height, fps, duration } = project
  const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width, height })
  if (!codec) throw new Error(i18n.t('exportVideo.unsupported'))

  const playback = usePlaybackStore.getState()
  const previousTime = playback.time
  const restore = bridge.begin(width, height)

  try {
    // Yeni çözünürlüğün (ve efekt katmanlarının yeniden boyutlanmasının) uygulanmasını bekle.
    await wait(100)

    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
    const source = new CanvasSource(bridge.canvas, { codec, bitrate: QUALITY_HIGH })
    output.addVideoTrack(source, { frameRate: fps })
    await output.start()

    const totalFrames = Math.round(duration * fps)
    for (let frame = 0; frame < totalFrames; frame++) {
      const t = frame / fps
      usePlaybackStore.getState().setTime(t)
      bridge.renderFrame()
      if (pendingTextSyncs.size > 0) {
        await Promise.all(pendingTextSyncs)
        bridge.renderFrame()
      }
      await source.add(t, 1 / fps)
      if (frame % 5 === 0) {
        onProgress(frame / totalFrames)
        await wait()
      }
    }

    await output.finalize()
    onProgress(1)
    const buffer = (output.target as BufferTarget).buffer
    if (!buffer) throw new Error(i18n.t('exportVideo.failed'))
    return new Blob([buffer], { type: output.format.mimeType })
  } finally {
    restore()
    usePlaybackStore.getState().setTime(previousTime)
  }
}
