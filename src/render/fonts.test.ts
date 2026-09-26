import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useProjectStore } from '../store/projectStore'
import { DEFAULT_FONT, FONTS, fontUrl, isUploadedFont, preferredFont, setPreferredFont } from './fonts'

// Testler Node'da çalışıyor: tarayıcı deposu yerine bellekte basit bir sahte.
beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
})
afterEach(() => vi.unstubAllGlobals())

describe('fontlar', () => {
  it('her fontun normal dosyası var, kimlikler benzersiz', () => {
    for (const f of FONTS) expect(f.files[400], f.id).toBeTruthy()
    expect(new Set(FONTS.map((f) => f.id)).size).toBe(FONTS.length)
  })

  it('tek kalınlıklı fontta kalın için normal dosya kullanılır; bilinmeyen font varsayılana düşer', () => {
    expect(fontUrl('bebas-neue', 700)).toBe(fontUrl('bebas-neue', 400))
    expect(fontUrl('inter', 700)).not.toBe(fontUrl('inter', 400))
    expect(fontUrl('yok-boyle-font')).toBe(fontUrl(DEFAULT_FONT))
  })

  it('yüklenen font asset referansıdır', () => {
    expect(isUploadedFont('asset:a-1')).toBe(true)
    expect(isUploadedFont('inter')).toBe(false)
  })

  it('yeni metin, tercih edilen fontla eklenir', () => {
    expect(preferredFont()).toBe(DEFAULT_FONT)
    setPreferredFont('asset:a-sf')
    const store = useProjectStore.getState()
    const id = store.addLayer('text', 0)
    expect(useProjectStore.getState().project.layers.find((l) => l.id === id)?.fontFamily).toBe('asset:a-sf')
  })
})
