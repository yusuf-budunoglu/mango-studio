import { useEffect, useState, type RefObject } from 'react'

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Sessiz döngü videosunu yalnızca ekranda görünürken oynatır, görünmeyince durdurur (sayfadaki onlarca video
 * aynı anda çözülmesin). Hareketi azaltan kullanıcıda hiç oynatmaz. Oynuyorsa true döner (kapak görselini gizlemek için).
 */
export function useAutoplay(video: RefObject<HTMLVideoElement | null>): boolean {
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const v = video.current
    if (!v || reducedMotion()) return
    const onPlaying = () => setPlaying(true)
    v.addEventListener('playing', onPlaying)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (v.preload === 'none') v.preload = 'auto'
          void v.play().catch(() => setPlaying(false))
        } else {
          v.pause()
        }
      },
      { rootMargin: '200px 0px' },
    )
    observer.observe(v)
    return () => {
      observer.disconnect()
      v.removeEventListener('playing', onPlaying)
      v.pause()
    }
  }, [video])

  return playing
}
