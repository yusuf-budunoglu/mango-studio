import { supabase } from '../cloud/client'
import { newId } from '../engine/ids'
import { migrateProject } from '../engine/migrate'
import type { Project } from '../engine/types'
import { ownAssets, type AssetMeta, type AssetStore } from '../persistence/assets'
import { createSharedAssetStore } from '../persistence/cloudAssets'
import { repository } from '../persistence/repository'
import { routeToPath } from '../router'

/**
 * Bağlantıyla paylaşım: proje sahibinin Studio'sunda kalır, bağlantıyı bilen herkes (üye olmasa da)
 * `/s/<shareId>` sayfasında izler. Bağlantı canlıdır: sahibi düzenledikçe izleyen de son hali görür.
 * Video dosyası saklanmaz; sayfa projeyi tarayıcıda oynatır.
 */
export interface SharedProject {
  ownerId: string
  name: string
  project: Project
  isTemplate: boolean
  thumbnail?: string
  /** sahibinin deposundan salt okunur dosyalar */
  assetStore: AssetStore
}

type AssetInfo = Omit<AssetMeta, 'size' | 'type' | 'createdAt'>

export const shareUrl = (shareId: string) => `${window.location.origin}${routeToPath({ screen: 'shared', shareId })}`

/** Paylaşılan projeyi okur; bağlantı kapatıldıysa ya da yoksa `undefined`. */
export async function loadShared(shareId: string): Promise<SharedProject | undefined> {
  if (!supabase) return undefined
  const res = await supabase.rpc('get_shared_project', { p_share_id: shareId })
  if (res.error) throw new Error(res.error.message)
  const row = (res.data as { owner_id: string; name: string; data: object; is_template: boolean; thumbnail: string | null; assets: AssetInfo[] }[] | null)?.[0]
  if (!row) return undefined
  return {
    ownerId: row.owner_id,
    name: row.name,
    project: migrateProject(row.data),
    isTemplate: row.is_template,
    thumbnail: row.thumbnail ?? undefined,
    assetStore: createSharedAssetStore(supabase, row.owner_id, row.assets ?? []),
  }
}

/**
 * Paylaşılan projenin kopyasını izleyenin kendi Studio'suna kaydeder (dosyalar kendi deposuna kopyalanır,
 * kotasından düşer). Şablon paylaşıldıysa kopya da Şablonlarım'a girer. Yeni projenin id'sini döndürür.
 */
export async function copySharedToStudio(shared: SharedProject): Promise<string> {
  for (const info of await shared.assetStore.list()) {
    if (await ownAssets.getMeta(info.id)) continue
    const blob = await shared.assetStore.getBlob(info.id)
    if (blob) await ownAssets.put(blob, { id: info.id, name: info.name, kind: info.kind, duration: info.duration })
  }
  const copy: Project = { ...shared.project, id: newId('p') }
  await repository.save(copy, shared.thumbnail)
  if (shared.isTemplate) await repository.setTemplate(copy.id, true)
  return copy.id
}
