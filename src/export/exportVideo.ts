import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  getFirstEncodableAudioCodec,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  WebMOutputFormat,
} from 'mediabunny'
import { renderAudioMix } from '../audio/engine'
import type { Project } from '../engine/types'
import i18n from '../i18n'
import { usePlaybackStore } from '../store/projectStore'
import { exportBridge, pendingTextSyncs, prepareFrameHooks } from './bridge'

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export interface ExportOptions {
  /** çıktının kısa kenarı: 720, 1080 ya da 2160 (4K) */
  resolution: 720 | 1080 | 2160
  fps: 30 | 60
  container: 'mp4' | 'webm'
}

export const DEFAULT_EXPORT: ExportOptions = { resolution: 1080, fps: 30, container: 'mp4' }

/** Projenin en-boy oranını koruyarak, kısa kenarı istenen çözünürlükte olan boyut (çift sayı). */
export function exportSize(project: Pick<Project, 'width' | 'height'>, resolution: number) {
  const short = Math.min(project.width, project.height)
  const scale = resolution / short
  const even = (v: number) => Math.max(2, Math.round((v * scale) / 2) * 2)
  return { width: even(project.width), height: even(project.height) }
}

export class ExportCanceledError extends Error {}

/**
 * Projeyi kare kare çizip tarayıcıda videoya kodlar; ses parçaları varsa karıştırıp ekler.
 * Sunucu gerekmez. Önizlemeyle aynı motor kullanıldığı için ekranda görünen neyse videoya o çıkar.
 */
export async function exportVideo(
  project: Project,
  options: ExportOptions,
  onProgress: (ratio: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const bridge = exportBridge.current
  if (!bridge) throw new Error(i18n.t('exportVideo.notReady'))

  const { width, height } = exportSize(project, options.resolution)
  const { fps } = options
  const format = options.container === 'webm' ? new WebMOutputFormat() : new Mp4OutputFormat({ fastStart: 'in-memory' })
  const videoCodecs = options.container === 'webm' ? (['vp9', 'av1', 'vp8'] as const) : (['avc', 'vp9', 'av1'] as const)
  const codec = await getFirstEncodableVideoCodec([...videoCodecs], { width, height })
  if (!codec) throw new Error(i18n.t('exportVideo.unsupported'))

  // Ses: tüm parçaları videonun süresi boyunca önceden karıştır.
  const mix = await renderAudioMix(project)
  const audioCodec = mix
    ? await getFirstEncodableAudioCodec(format.getSupportedAudioCodecs(), { numberOfChannels: 2, sampleRate: mix.sampleRate })
    : null

  const previousTime = usePlaybackStore.getState().time
  const restore = bridge.begin(width, height)
  let output: Output | null = null

  try {
    // Yeni çözünürlüğün (ve efekt katmanlarının yeniden boyutlanmasının) uygulanmasını bekle.
    await wait(100)

    output = new Output({ format, target: new BufferTarget() })
    const video = new CanvasSource(bridge.canvas, { codec, bitrate: QUALITY_HIGH })
    output.addVideoTrack(video, { frameRate: fps })
    const audio = mix && audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null
    if (audio) output.addAudioTrack(audio)
    await output.start()
    if (audio && mix) await audio.add(mix)

    const totalFrames = Math.round(project.duration * fps)
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) throw new ExportCanceledError()
      const t = frame / fps
      usePlaybackStore.getState().setTime(t)
      // Video katmanları gibi karesini önceden hazırlaması gerekenler.
      if (prepareFrameHooks.size) await Promise.all([...prepareFrameHooks].map((hook) => hook(t)))
      bridge.renderFrame()
      if (pendingTextSyncs.size > 0) {
        await Promise.all(pendingTextSyncs)
        bridge.renderFrame()
      }
      await video.add(t, 1 / fps)
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
  } catch (err) {
    if (output && output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => undefined)
    throw err
  } finally {
    restore()
    usePlaybackStore.getState().setTime(previousTime)
  }
}
