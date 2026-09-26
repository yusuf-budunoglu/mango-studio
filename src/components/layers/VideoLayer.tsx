import { ALL_FORMATS, BlobSource, CanvasSink, Input } from 'mediabunny'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import { videoSourceTime } from '../../engine/media'
import { prepareFrameHooks } from '../../export/bridge'
import { assetIdOf, assets, isAssetRef, resolveAssetUrl } from '../../persistence/assets'
import { useEditorStore } from '../../store/editorStore'
import { usePlaybackStore } from '../../store/projectStore'
import { useLayerNode, type LayerProps } from './shared'

const MAX_SIDE = 1280

interface LoadedVideo {
  element: HTMLVideoElement
  canvas: HTMLCanvasElement
  texture: CanvasTexture
  duration: number
  aspect: number
}

/**
 * Video klip katmanı. Görüntü her zaman bir kanvas dokusundan çizilir:
 * önizlemede tarayıcının video oynatıcısından, dışa aktarmada ise Mediabunny ile o anın
 * karesi tam olarak çözülerek (oynatıcı kare-doğru değildir). Videonun sesi kullanılmaz.
 */
export function VideoLayer({ layer, register }: LayerProps) {
  // Oynatıcı ve kanvas değiştirilebilir nesneler; ref'te tutulur. Durumda sadece çizim için gerekenler.
  const loaded = useRef<LoadedVideo | null>(null)
  const [view, setView] = useState<{ texture: CanvasTexture; aspect: number } | null>(null)
  const sink = useRef<Promise<CanvasSink | null> | null>(null)

  useEffect(() => {
    if (!isAssetRef(layer.media)) return
    const ref = layer.media
    let alive = true
    let made: LoadedVideo | null = null
    void resolveAssetUrl(ref).then((url) => {
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
          setView({ texture, aspect: made.aspect })
        },
        { once: true },
      )
    })
    // Dışa aktarma için kare-doğru çözücü, ilk ihtiyaçta hazırlanır.
    sink.current = null
    return () => {
      alive = false
      loaded.current = null
      made?.element.pause()
      made?.texture.dispose()
    }
  }, [layer.media])

  const draw = useMemo(
    () => (source: CanvasImageSource) => {
      const v = loaded.current
      if (!v) return
      v.canvas.getContext('2d')?.drawImage(source, 0, 0, v.canvas.width, v.canvas.height)
      v.texture.needsUpdate = true
    },
    [],
  )

  // Dışa aktarma: her kareden önce o anın video karesini çöz ve çiz.
  useEffect(() => {
    const video = loaded.current
    if (!view || !video || !isAssetRef(layer.media)) return
    const ref = layer.media
    const hook = async (time: number) => {
      sink.current ??= (async () => {
        const blob = await assets.getBlob(assetIdOf(ref))
        if (!blob) return null
        const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS })
        const track = await input.getPrimaryVideoTrack()
        return track && (await track.canDecode()) ? new CanvasSink(track, { width: video.canvas.width, height: video.canvas.height, fit: 'fill' }) : null
      })()
      const frame = await (await sink.current)?.getCanvas(videoSourceTime(layer, time, video.duration))
      if (frame) draw(frame.canvas as CanvasImageSource)
    }
    prepareFrameHooks.add(hook)
    return () => {
      prepareFrameHooks.delete(hook)
    }
  }, [view, layer, draw])

  // Önizleme: oynatıcıyı timeline'a eşle, her karede kanvasa kopyala.
  const node = useLayerNode(layer, register, () => {
    const video = loaded.current
    if (!video || useEditorStore.getState().cleanRenders > 0) return
    const { element } = video
    const { time, isPlaying } = usePlaybackStore.getState()
    const target = videoSourceTime(layer, time, video.duration)
    const inRange = time >= layer.start && time <= layer.start + layer.duration
    if (isPlaying && inRange) {
      if (element.paused) void element.play().catch(() => undefined)
      if (Math.abs(element.currentTime - target) > 0.25) element.currentTime = target
    } else {
      if (!element.paused) element.pause()
      if (!element.seeking && Math.abs(element.currentTime - target) > 0.02) element.currentTime = target
    }
    if (element.readyState >= 2) draw(element)
  })

  const width = 3
  const height = view ? width / view.aspect : width * 0.5625
  return (
    <group {...node}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {view ? <meshBasicMaterial key={view.texture.uuid} map={view.texture} toneMapped={false} /> : <meshBasicMaterial color="#2a303a" />}
      </mesh>
    </group>
  )
}
