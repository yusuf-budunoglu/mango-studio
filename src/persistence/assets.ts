import { del, get, set } from 'idb-keyval'
import { newId } from '../engine/ids'
import { delegateTo } from './backend'
import type { KeyValue } from './repository'

/**
 * Yüklenen dosyalar (görsel, ses, video, SVG, font). Proje verisi dosyanın kendisini değil
 * `asset:<id>` referansını tutar; böylece proje küçük kalır, geri alma geçmişi şişmez.
 * Şimdilik tarayıcının IndexedDB'sinde; Supabase Storage'a geçişte aynı arayüz korunur.
 */
export type AssetKind = 'image' | 'audio' | 'video' | 'svg' | 'font'

/** Metin motorunun (troika) açabildiği font dosyaları; .woff2 açılamıyor. */
export const FONT_EXTENSIONS = ['.ttf', '.otf', '.woff']

export interface AssetMeta {
  id: string
  name: string
  kind: AssetKind
  type: string
  size: number
  createdAt: number
  /** ses/video için saniye */
  duration?: number
}

export const ASSET_PREFIX = 'asset:'
export const isAssetRef = (ref: string | undefined): ref is string => !!ref && ref.startsWith(ASSET_PREFIX)
export const assetIdOf = (ref: string) => ref.slice(ASSET_PREFIX.length)
export const assetRef = (id: string) => `${ASSET_PREFIX}${id}`

const INDEX_KEY = 'assets:index'
const blobKey = (id: string) => `asset-blob:${id}`

export function createAssetStore(kv: KeyValue) {
  const list = async () => ((await kv.get<AssetMeta[]>(INDEX_KEY)) ?? []).sort((a, b) => b.createdAt - a.createdAt)

  return {
    list,
    async put(blob: Blob, meta: Omit<AssetMeta, 'id' | 'size' | 'type' | 'createdAt'> & { id?: string }): Promise<AssetMeta> {
      const full: AssetMeta = { ...meta, id: meta.id ?? newId('a'), type: blob.type, size: blob.size, createdAt: Date.now() }
      await kv.set(blobKey(full.id), blob)
      await kv.set(INDEX_KEY, [full, ...(await list()).filter((a) => a.id !== full.id)])
      return full
    },
    getBlob: (id: string) => kv.get<Blob>(blobKey(id)),
    async getMeta(id: string) {
      return (await list()).find((a) => a.id === id)
    },
    async remove(id: string) {
      await kv.del(blobKey(id))
      await kv.set(INDEX_KEY, (await list()).filter((a) => a.id !== id))
    },
  }
}

export type AssetStore = ReturnType<typeof createAssetStore>

/** Bu tarayıcıdaki dosyalar (giriş yapılmamışken ve bulut kopyalamasının kaynağı). */
export const localAssets = createAssetStore({ get, set, del })

let cloudAssets: AssetStore | undefined
/** Paylaşılan bir projeye bakarken onun sahibinin dosyaları (salt okunur); kullanıcının kendi deposunun önüne geçer. */
let overrideAssets: AssetStore | undefined

// Tarayıcıda gösterilecek adresler: asset referansı için bir kez oluşturulan blob URL'si.
const urlCache = new Map<string, Promise<string | undefined>>()

/** Giriş yapılınca bulut deposunu, çıkışta `undefined` verip yerel depoyu devreye alır. */
export function setCloudAssetStore(next: AssetStore | undefined) {
  cloudAssets = next
  // Aynı `asset:<id>` iki depoda farklı içerik (ya da hiç içerik) gösterebilir.
  urlCache.clear()
}

/**
 * Paylaşılan projeyi gösteren sayfa, projenin dosyalarını sahibinin deposundan okusun diye bunu kurar;
 * sayfadan çıkınca `undefined` ile kaldırır.
 */
export function setAssetOverride(next: AssetStore | undefined) {
  overrideAssets = next
  urlCache.clear()
}

/** Kullanıcının kendi dosya deposu (paylaşım görünümünden bağımsız): kopyalama hedefi. */
export const ownAssets: AssetStore = delegateTo(localAssets, () => cloudAssets)

/** Ekranların kullandığı dosya deposu: girişliyse hesap (bulut), değilse bu tarayıcı. */
export const assets: AssetStore = delegateTo(localAssets, () => overrideAssets ?? cloudAssets)

/** Yükleme planın depolama kotasını aşınca `put` bu hatayı fırlatır. */
export class StorageQuotaError extends Error {
  constructor() {
    super('storage_quota_exceeded')
    this.name = 'StorageQuotaError'
  }
}

/** `asset:<id>` → blob URL; data:/http adreslerini olduğu gibi döndürür. */
export function resolveAssetUrl(ref: string | undefined): Promise<string | undefined> {
  if (!ref) return Promise.resolve(undefined)
  if (!isAssetRef(ref)) return Promise.resolve(ref)
  let url = urlCache.get(ref)
  if (!url) {
    url = assets.getBlob(assetIdOf(ref)).then((blob) => (blob ? URL.createObjectURL(blob) : undefined))
    urlCache.set(ref, url)
  }
  return url
}
