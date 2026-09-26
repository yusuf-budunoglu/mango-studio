import { useEffect, useState } from 'react'
import { resolveAssetUrl } from '../persistence/assets'
import { pendingTextSyncs } from '../export/bridge'
import { FONTS, fontUrl, isUploadedFont, type FontWeight } from './fonts'

// Arayüzde font önizlemesi: her font tarayıcıya bir kez `FontFace` olarak eklenir ve
// CSS'te `font-family` ile kullanılır. 3D metin (troika) dosyayı kendisi okur, buna bağlı değil.

const faces = new Map<string, Promise<string | null>>()

const cssFamily = (fontId: string) => `ms-font-${fontId.replace(/[^a-z0-9-]/gi, '-')}`

/** Fontu tarayıcıya ekler; CSS aile adını (ya da yüklenemezse null) döndürür. */
export function loadFontFace(fontId: string): Promise<string | null> {
  let face = faces.get(fontId)
  if (!face) {
    face = (async () => {
      const family = cssFamily(fontId)
      const bundled = FONTS.find((f) => f.id === fontId)
      const sources: [string, FontWeight][] = bundled
        ? Object.entries(bundled.files).flatMap(([w, url]) => (url ? [[url, Number(w) as FontWeight] as [string, FontWeight]] : []))
        : [[(await resolveAssetUrl(fontId)) ?? '', 400]]
      try {
        await Promise.all(
          sources.map(async ([url, weight]) => {
            if (!url) throw new Error('missing font')
            const ff = new FontFace(family, `url(${url})`, { weight: String(weight) })
            document.fonts.add(await ff.load())
          }),
        )
        return family
      } catch {
        return null
      }
    })()
    faces.set(fontId, face)
  }
  return face
}

/** Önizleme için CSS aile adı; yüklenene kadar undefined. */
export function useFontFace(fontId: string | undefined) {
  const [family, setFamily] = useState<{ id: string; css: string | null }>()
  useEffect(() => {
    if (!fontId) return
    let alive = true
    void loadFontFace(fontId).then((css) => alive && setFamily({ id: fontId, css }))
    return () => {
      alive = false
    }
  }, [fontId])
  return family && family.id === fontId && family.css ? family.css : undefined
}

// 3D metin için dosya adresi. Yüklenen fontun blob adresi çözülene kadar metin çizilmez
// (troika'nın internetten yedek font indirmesin); video çıktısı bunu bekler.
const resolved = new Map<string, string>()

export function useTextFontUrl(fontId: string | undefined, weight: FontWeight): string | undefined {
  const uploaded = isUploadedFont(fontId)
  const [, rerender] = useState(0)
  useEffect(() => {
    if (!uploaded || resolved.has(fontId)) return
    let alive = true
    const done = resolveAssetUrl(fontId).then((url) => {
      // dosya silinmişse varsayılan font
      resolved.set(fontId, url ?? fontUrl(undefined))
      if (alive) rerender((n) => n + 1)
    })
    pendingTextSyncs.add(done)
    void done.finally(() => pendingTextSyncs.delete(done))
    return () => {
      alive = false
    }
  }, [uploaded, fontId])
  if (!uploaded) return fontUrl(fontId, weight)
  return resolved.get(fontId)
}
