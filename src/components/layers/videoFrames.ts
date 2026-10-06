import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { videoSourceTime } from '../../engine/media'
import type { Layer } from '../../engine/types'
import { prepareFrameHooks } from '../../export/bridge'
import { assetIdOf, assets, isAssetRef, resolveAssetUrl } from '../../persistence/assets'
import { useEditorStore } from '../../store/editorStore'
import { usePlaybackStore } from '../../store/projectStore'

const MAX_SIDE = 1280

interface LoadedVideo {
  element: HTMLVideoElement
  canvas: HTMLCanvasElement
  texture: CanvasTexture
  duration: number
  aspect: number
}

export interface VideoFrames {
  /** çizilecek doku ve videonun oranı; video yüklenene kadar (ya da kaynak yoksa) null */
  view: { texture: CanvasTexture; aspect: number } | null
  /** Önizleme: oynatıcıyı timeline'a eşler ve o anki kareyi dokuya kopyalar. Her karede çağrılır. */
  tick: () => void
}

/**
 * Bir videoyu katmanın klibine eşlenmiş kanvas dokusu olarak verir (video katmanı ve cihaz ekranları paylaşır).
 * Görüntü her zaman kanvastan çizilir: önizlemede tarayıcının video oynatıcısından, dışa aktarmada Mediabunny ile
 * o anın karesi tam çözülerek (oynatıcı kare-doğru değildir). Videonun sesi kullanılmaz.
 * `source`: dosya deposu referansı (`asset:<id>`) ya da adres (şablonların `public/` altındaki videoları).
 */
export function useVideoFrames(layer: Layer, source: string | undefined): VideoFrames {
  // Oynatıcı ve kanvas değiştirilebilir nesneler; ref'te tutulur. Durumda sadece çizim için gerekenler.
  const loaded = useRef<LoadedVideo | null>(null)
  const [view, setView] = useState<{ source: string; texture: CanvasTexture; aspect: number } | null>(null)
  const sink = useRef<Promise<CanvasSink | null> | null>(null)
  /** dışa aktarmada kanvasta duran video karesinin kaynak zaman aralığı [baş, son) */
  const drawn = useRef<[number, number] | null>(null)
  // Her karedeki çağrı katmanın son halini okusun (klip taşınınca doku yeniden kurulmadan).
  const current = useRef(layer)
  useEffect(() => {
    current.current = layer
  }, [layer])

  useEffect(() => {
    if (!source) return
    let alive = true
    let made: LoadedVideo | null = null
    void resolveAssetUrl(source).then((url) => {
      if (!alive || !url) return
      const element = document.createElement('video')
      element.muted = true
      element.playsInline = true
      element.preload = 'auto'
      element.src = url
      element.addEventListener(
        'loadeddata',
        () => {
          if (!alive) return
          const ratio = Math.min(1, MAX_SIDE / Math.max(element.videoWidth, element.videoHeight))
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(element.videoWidth * ratio)
          canvas.height = Math.round(element.videoHeight * ratio)
          const texture = new CanvasTexture(canvas)
          texture.colorSpace = SRGBColorSpace
          made = { element, canvas, texture, duration: element.duration, aspect: element.videoWidth / element.videoHeight }
          loaded.current = made
          setView({ source, texture, aspect: made.aspect })
        },
        { once: true },
      )
    })
    // Dışa aktarma için kare-doğru çözücü, ilk ihtiyaçta hazırlanır.
    sink.current = null
    drawn.current = null
    return () => {
      alive = false
      loaded.current = null
      made?.element.pause()
      made?.texture.dispose()
    }
  }, [source])

  const draw = useCallback((frame: CanvasImageSource) => {
    const v = loaded.current
    if (!v) return
    v.canvas.getContext('2d')?.drawImage(frame, 0, 0, v.canvas.width, v.canvas.height)
    v.texture.needsUpdate = true
  }, [])

  // Dışa aktarma: her kareden önce o anın video karesini çöz ve çiz.
  useEffect(() => {
    const video = loaded.current
    if (!view || !video || view.source !== source) return
    const hook = async (time: number) => {
      sink.current ??= (async () => {
        const blob = isAssetRef(view.source) ? await assets.getBlob(assetIdOf(view.source)) : await fetch(view.source).then((res) => (res.ok ? res.blob() : undefined), () => undefined)
        if (!blob) return null
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
        const track = await input.getPrimaryVideoTrack()
        return track && (await track.canDecode()) ? new CanvasSink(track, { width: video.canvas.width, height: video.canvas.height, fit: 'fill' }) : null
      })()
      // Klibin dışındaki katman çizilmiyor: karesini çözmeye gerek yok. Şablonda her çekim ayrı cihaz katmanı; hepsi
      // her karede çözünce aynı anda açılan çözücü sayısı donanım sınırını aşıp dışa aktarmayı "Decoding error" ile
      // durduruyordu.
      const clip = current.current
      if (time < clip.start || time >= clip.start + clip.duration) return
      const target = videoSourceTime(clip, time, video.duration)
      // hareket bulanıklığının alt kareleri çoğunlukla aynı video karesine düşer: kanvastaki kare yeterli
      if (drawn.current && target >= drawn.current[0] && target < drawn.current[1]) return
      const frame = await (await sink.current)?.getCanvas(target)
      if (!frame) return
      draw(frame.canvas as CanvasImageSource)
      drawn.current = [frame.timestamp, frame.timestamp + frame.duration]
    }
    prepareFrameHooks.add(hook)
    return () => {
      prepareFrameHooks.delete(hook)
    }
  }, [view, source, draw])

  const tick = useCallback(() => {
    const video = loaded.current
    if (!video || useEditorStore.getState().cleanRenders > 0) return
    const { element } = video
    const clip = current.current
    const { time, isPlaying } = usePlaybackStore.getState()
    const target = videoSourceTime(clip, time, video.duration)
    const inRange = time >= clip.start && time <= clip.start + clip.duration
    if (isPlaying && inRange) {
      if (element.paused) void element.play().catch(() => undefined)
      if (Math.abs(element.currentTime - target) > 0.25) element.currentTime = target
    } else {
      if (!element.paused) element.pause()
      if (!element.seeking && Math.abs(element.currentTime - target) > 0.02) element.currentTime = target
    }
    if (element.readyState >= 2) {
      draw(element)
      drawn.current = null
    }
  }, [draw])

  return { view: source && view?.source === source ? view : null, tick }
}
