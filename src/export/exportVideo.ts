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
import type { Fps, Resolution } from '../billing/plans'
import { resolveEffects } from '../engine/effects'
import type { Project } from '../engine/types'
import i18n from '../i18n'
import { usePlaybackStore } from '../store/projectStore'
import { exportBridge, pendingModelLoads, pendingTextSyncs, prepareFrameHooks, renderTimeOverride } from './bridge'

const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms))

export interface ExportOptions {
  /** çıktının kısa kenarı: 720, 1080, 1440 (2K) ya da 2160 (4K); plana göre sınırlı (`src/billing/plans.ts`) */
  resolution: Resolution
  fps: Fps
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

/**
 * Kenar yumuşatma için sahne çıktının bu katı çözünürlükte çizilip küçültülür. Efekt zinciri
 * açıkken tarayıcının kenar yumuşatması çalışmadığı için kenarlar aksi halde tırtıklı çıkıyor.
 * GPU sınırı için çizim tarafı en fazla 4096 piksel.
 */
export function supersampleFactor(width: number, height: number) {
  return Math.max(1, Math.min(2, Math.floor((4096 / Math.max(width, height)) * 10) / 10))
}

/** Hareket bulanıklığında bir karenin alt kare zamanları: kare anından ileriye, deklanşör süresince. */
export function subframeTimes(t: number, fps: number, samples: number, shutter: number) {
  if (samples <= 1) return [t]
  return Array.from({ length: samples }, (_, k) => t + (k / samples) * (shutter / fps))
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
  const ss = supersampleFactor(width, height)
  const restore = bridge.begin(Math.round(width * ss), Math.round(height * ss))
  // Çıktı karesi: büyük çizim burada küçültülür, hareket bulanıklığında alt kareler üst üste ortalanır.
  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = width
  frameCanvas.height = height
  const ctx = frameCanvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error(i18n.t('exportVideo.failed'))
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const blur = resolveEffects(project.effects).motionBlur
  const samples = blur.enabled ? Math.max(1, Math.round(blur.samples)) : 1
  let output: Output | null = null

  try {
    // Yeni çözünürlüğün (ve efekt katmanlarının yeniden boyutlanmasının) uygulanmasını bekle.
    await wait(100)
    // Cihaz modelleri henüz yükleniyorsa ilk kareler yedek maketle çizilmesin.
    if (pendingModelLoads.size) await Promise.all(pendingModelLoads)

    output = new Output({ format, target: new BufferTarget() })
    const video = new CanvasSource(frameCanvas, { codec, bitrate: QUALITY_HIGH })
    output.addVideoTrack(video, { frameRate: fps })
    const audio = mix && audioCodec ? new AudioBufferSource({ codec: audioCodec, bitrate: QUALITY_HIGH }) : null
    if (audio) output.addAudioTrack(audio)
    await output.start()
    if (audio && mix) await audio.add(mix)

    const totalFrames = Math.round(project.duration * fps)
    for (let frame = 0; frame < totalFrames; frame++) {
      if (signal?.aborted) throw new ExportCanceledError()
      const t = frame / fps
      const times = subframeTimes(t, fps, samples, blur.shutter)
      for (let k = 0; k < times.length; k++) {
        // Sahne zamanı doğrudan verilir: oynatma zamanını (store) her alt karede değiştirmek
        // timeline ve paneli yeniden çizdiriyor, dışa aktarmayı kat kat yavaşlatıyordu.
        renderTimeOverride.current = times[k]
        // Video katmanları gibi karesini önceden hazırlaması gerekenler.
        if (prepareFrameHooks.size) await Promise.all([...prepareFrameHooks].map((hook) => hook(times[k])))
        bridge.renderFrame()
        if (pendingTextSyncs.size > 0) {
          await Promise.all(pendingTextSyncs)
          bridge.renderFrame()
        }
        // Çizimden hemen sonra (aynı görevde) kopyala; ortalama: k. alt kare 1/(k+1) ağırlıkla.
        ctx.globalAlpha = 1 / (k + 1)
        ctx.drawImage(bridge.canvas, 0, 0, width, height)
      }
      ctx.globalAlpha = 1
      await video.add(t, 1 / fps)
      if (frame % 5 === 0) {
        // oynatma kafası arayüzde ilerlemeyi göstersin (seyrek)
        usePlaybackStore.getState().setTime(t)
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
    renderTimeOverride.current = null
    restore()
    usePlaybackStore.getState().setTime(previousTime)
  }
}
