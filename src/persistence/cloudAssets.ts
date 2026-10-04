import type { SupabaseClient } from '@supabase/supabase-js'
import { newId } from '../engine/ids'
import { StorageQuotaError, type AssetKind, type AssetMeta, type AssetStore } from './assets'

interface AssetRow {
  id: string
  name: string
  kind: AssetKind
  type: string
  size: number
  duration: number | null
  created_at: string
}

const toMeta = (r: AssetRow): AssetMeta => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  type: r.type,
  size: Number(r.size),
  createdAt: Date.parse(r.created_at),
  duration: r.duration ?? undefined,
})

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const BUCKET = 'assets'

/** Hesaba bağlı dosya deposu: dosyalar Storage'da (`<kullanıcı>/<dosya id>`), bilgileri `assets` tablosunda. */
export function createCloudAssetStore(client: SupabaseClient, userId: string): AssetStore {
  const table = () => client.from('assets')
  const pathOf = (id: string) => `${userId}/${id}`

  const list = async () => (check(await table().select('*').order('created_at', { ascending: false })) ?? []).map((r) => toMeta(r as AssetRow))

  return {
    list,
    async put(blob, meta) {
      const full: AssetMeta = { ...meta, id: meta.id ?? newId('a'), type: blob.type, size: blob.size, createdAt: Date.now() }
      // Önce satır: kota sunucuda bu satır eklenirken denetlenir; Storage yalnızca satırı olan dosyayı kabul eder.
      const existed = !!check(await table().select('id').eq('id', full.id).maybeSingle())
      const row = await table().upsert(
        { user_id: userId, id: full.id, name: full.name, kind: full.kind, type: full.type, size: full.size, duration: full.duration ?? null, created_at: new Date(full.createdAt).toISOString() },
        { onConflict: 'user_id,id' },
      )
      if (row.error) throw row.error.message.includes('storage_quota_exceeded') ? new StorageQuotaError() : new Error(row.error.message)
      const upload = await client.storage.from(BUCKET).upload(pathOf(full.id), blob, { upsert: true, contentType: blob.type || undefined })
      if (upload.error) {
        // yarım kalan yeni kaydı geri al (kota boşuna dolmasın)
        if (!existed) await table().delete().eq('id', full.id)
        throw new Error(upload.error.message)
      }
      return full
    },
    async getBlob(id) {
      const res = await client.storage.from(BUCKET).download(pathOf(id))
      return res.error ? undefined : res.data
    },
    async getMeta(id) {
      const row = check(await table().select('*').eq('id', id).maybeSingle())
      return row ? toMeta(row as AssetRow) : undefined
    },
    async remove(id) {
      await client.storage.from(BUCKET).remove([pathOf(id)])
      check(await table().delete().eq('id', id))
    },
  }
}

/** Kullanılan alan ve planın kotası (sunucudan); bulut kapalıysa ya da okunamazsa `undefined`. */
export async function fetchStorageStatus(client: SupabaseClient): Promise<{ used: number; quota: number } | undefined> {
  const res = await client.rpc('storage_status')
  const row = (res.data as { used: number; quota: number }[] | null)?.[0]
  return res.error || !row ? undefined : { used: Number(row.used), quota: Number(row.quota) }
}

/**
 * Paylaşılan projenin dosyaları: sahibinin klasöründen salt okunur (Storage kuralı yalnızca paylaşılan
 * projede geçen dosyalara izin verir). Bilgiler paylaşım kaydıyla gelir.
 */
export function createSharedAssetStore(client: SupabaseClient, ownerId: string, metas: Omit<AssetMeta, 'size' | 'type' | 'createdAt'>[]): AssetStore {
  const readOnly = () => Promise.reject(new Error('read-only'))
  const toMeta = (m: (typeof metas)[number]): AssetMeta => ({ ...m, size: 0, type: '', createdAt: 0 })
  return {
    list: async () => metas.map(toMeta),
    put: readOnly,
    async getBlob(id) {
      const res = await client.storage.from(BUCKET).download(`${ownerId}/${id}`)
      return res.error ? undefined : res.data
    },
    getMeta: async (id) => {
      const m = metas.find((x) => x.id === id)
      return m ? toMeta(m) : undefined
    },
    remove: readOnly,
  }
}
