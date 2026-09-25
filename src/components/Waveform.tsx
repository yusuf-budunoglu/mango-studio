import { useEffect, useState } from 'react'
import { loadPeaks } from '../audio/engine'

/** Ses parçasının kaynakta çalınan kısmının dalga görüntüsü (bloğun arka planı). */
export function Waveform({ asset, offset, duration, sourceDuration }: { asset: string; offset: number; duration: number; sourceDuration: number }) {
  const [peaks, setPeaks] = useState<number[] | null>(null)
  useEffect(() => {
    let alive = true
    void loadPeaks(asset).then((p) => alive && setPeaks(p))
    return () => {
      alive = false
    }
  }, [asset])
  if (!peaks || sourceDuration <= 0) return null
  const from = Math.floor((offset / sourceDuration) * peaks.length)
  const to = Math.max(from + 1, Math.ceil(((offset + duration) / sourceDuration) * peaks.length))
  const slice = peaks.slice(from, to)
  const n = slice.length
  // Ortadan simetrik dolu bir şekil: üst kenar soldan sağa, alt kenar sağdan sola.
  const top = slice.map((p, i) => `${(i / n) * 100},${50 - p * 46}`)
  const bottom = slice.map((_, i) => `${((n - 1 - i) / n) * 100},${50 + slice[n - 1 - i] * 46}`)
  return (
    <svg className="waveform" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={[...top, ...bottom].join(' ')} />
    </svg>
  )
}
