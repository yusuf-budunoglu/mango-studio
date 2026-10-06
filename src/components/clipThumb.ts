import { useEffect, useState } from 'react'
import type { Layer } from '../engine/types'
import { resolveAssetUrl } from '../persistence/assets'

const THUMB_HEIGHT = 96
const frames = new Map<string, Promise<string | undefined>>()

/** Videonun `at` saniyesindeki karesini küçük bir görsele çevirir (timeline klibinin film şeridi için). */
function videoFrame(source: string, at: number): Promise<string | undefined> {
  const key = `${source}@${at.toFixed(2)}`
  let frame = frames.get(key)
  if (!frame) {
    frame = resolveAssetUrl(source).then(
      (url) =>
        new Promise<string | undefined>((resolve) => {
          if (!url) return resolve(undefined)
          const video = document.createElement('video')
          video.muted = true
          video.playsInline = true
          video.preload = 'auto'
          video.addEventListener('error', () => resolve(undefined), { once: true })
          video.addEventListener(
            'loadeddata',
            () => {
              // İlk kare çoğu videoda siyah; biraz ilerisi klibi daha iyi anlatır.
              video.currentTime = Math.min(Math.max(at, 0.1), Math.max(0, video.duration - 0.05))
            },
            { once: true },
          )
          video.addEventListener(
            'seeked',
            () => {
              const canvas = document.createElement('canvas')
              canvas.height = THUMB_HEIGHT
              canvas.width = Math.max(1, Math.round((video.videoWidth / video.videoHeight) * THUMB_HEIGHT))
              try {
                canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
                resolve(canvas.toDataURL('image/jpeg', 0.7))
              } catch {
                // Başka kaynaktan gelen video kanvası kirletir; klip düz renkle çizilir.
                resolve(undefined)
              }
              video.removeAttribute('src')
              video.load()
            },
            { once: true },
          )
          video.src = url
        }),
    )
    frames.set(key, frame)
  }
  return frame
}

/** Klibin küçük resmi: görsel, video karesi ya da cihazın ekranı. Yoksa undefined (klip türünün rengiyle çizilir). */
export function useClipThumb(layer: Layer): string | undefined {
  const isVideo = layer.kind === 'video' || (layer.kind !== 'image' && layer.kind !== 'svg' && !!layer.media)
  const source = layer.kind === 'svg' || layer.kind === 'text' || layer.kind === 'shape' ? undefined : isVideo ? layer.media : layer.image
  const at = layer.mediaOffset ?? 0
  const [thumb, setThumb] = useState<{ key: string; url: string } | null>(null)
  const key = source ? `${source}@${isVideo ? at.toFixed(2) : ''}` : ''

  useEffect(() => {
    if (!source) return
    let alive = true
    void (isVideo ? videoFrame(source, at) : resolveAssetUrl(source)).then((url) => {
      if (alive && url) setThumb({ key, url })
    })
    return () => {
      alive = false
    }
  }, [source, isVideo, at, key])

  return thumb && thumb.key === key ? thumb.url : undefined
}
