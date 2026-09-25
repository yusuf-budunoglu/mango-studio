import type { Project } from '../engine/types'
import { assetIdOf, assets, isAssetRef, type AssetMeta } from './assets'
import { parseProjectFile } from './repository'

interface EmbeddedAsset {
  meta: Omit<AssetMeta, 'size' | 'type' | 'createdAt'>
  dataUrl: string
}

/** Projede geçen tüm `asset:<id>` referansları (hangi alanda olursa olsun). */
export function collectAssetRefs(value: unknown, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (isAssetRef(value)) found.add(value)
  } else if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, found)
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) collectAssetRefs(item, found)
  }
  return found
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** "Dosyaya kaydet": proje JSON'u, kullandığı dosyalar gömülü olarak (başka bilgisayarda açılabilsin). */
export async function projectToFile(project: Project): Promise<string> {
  const embeddedAssets: Record<string, EmbeddedAsset> = {}
  for (const ref of collectAssetRefs(project)) {
    const id = assetIdOf(ref)
    const [blob, meta] = await Promise.all([assets.getBlob(id), assets.getMeta(id)])
    if (!blob) continue
    embeddedAssets[id] = { meta: { id, name: meta?.name ?? id, kind: meta?.kind ?? 'image', duration: meta?.duration }, dataUrl: await toDataUrl(blob) }
  }
  return JSON.stringify({ ...project, embeddedAssets }, null, 2)
}

/** "Dosyadan aç": gömülü dosyaları depoya geri koyar, projeyi doğrulayıp yeni bir id ile döndürür. */
export async function projectFromFile(text: string): Promise<Project> {
  let data: { embeddedAssets?: Record<string, EmbeddedAsset> } & Record<string, unknown>
  try {
    data = JSON.parse(text)
  } catch {
    return parseProjectFile(text) // anlaşılır "geçerli JSON değil" hatası için
  }
  const { embeddedAssets, ...project } = data
  const parsed = parseProjectFile(JSON.stringify(project))
  for (const { meta, dataUrl } of Object.values(embeddedAssets ?? {})) {
    if (await assets.getMeta(meta.id)) continue
    const blob = await (await fetch(dataUrl)).blob()
    await assets.put(blob, meta)
  }
  return parsed
}
