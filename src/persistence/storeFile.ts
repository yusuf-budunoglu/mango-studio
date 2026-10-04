import { assets, type AssetKind, type AssetMeta } from './assets'

/** Yüklenen görseli en fazla 2048 px'e küçültüp dosya deposuna koyar. */
async function storeImage(file: File, maxSize = 2048): Promise<AssetMeta> {
  const bitmap = await createImageBitmap(file)
  const ratio = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * ratio)
  canvas.height = Math.round(bitmap.height * ratio)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob'))), type, 0.9))
  return assets.put(blob, { name: file.name, kind: 'image' })
}

/** Videonun / sesin süresini tarayıcının oynatıcısıyla okur. */
function readMediaDuration(file: Blob, tag: 'video' | 'audio' = 'video'): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement(tag)
    const url = URL.createObjectURL(file)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      resolve(Number.isFinite(video.duration) ? video.duration : 0)
      URL.revokeObjectURL(url)
    }
    video.onerror = () => resolve(0)
    // meta veri hiç gelmezse (arka plandaki sekme, bozuk dosya) yükleme beklemede kalmasın
    setTimeout(() => resolve(0), 5000)
    video.src = url
  })
}

/** Dosyayı türüne göre hazırlayıp depoya koyar. */
export async function storeFile(file: File, kind: AssetKind): Promise<AssetMeta> {
  if (kind === 'image') return storeImage(file)
  if (kind === 'video' || kind === 'audio') return assets.put(file, { name: file.name, kind, duration: (await readMediaDuration(file, kind)) || undefined })
  return assets.put(file, { name: file.name, kind })
}
