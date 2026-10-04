import type { SupabaseClient } from '@supabase/supabase-js'
import { newId } from '../engine/ids'
import { migrateProject } from '../engine/migrate'
import type { Project } from '../engine/types'
import type { Folder, ProjectSummary, Repository } from './repository'

interface SummaryRow {
  id: string
  name: string
  duration: number
  updated_at: string
  thumbnail: string | null
  folder_id: string | null
  width: number | null
  height: number | null
  mode: 'design' | null
  is_template: boolean
  source: 'editor' | 'mcp'
  share_id: string | null
}

const SUMMARY_COLUMNS = 'id,name,duration,updated_at,thumbnail,folder_id,width,height,mode,is_template,source,share_id'
const LEGACY_SUMMARY_COLUMNS = 'id,name,duration,updated_at,thumbnail,folder_id,width,height,mode,source'

const toSummary =(r: SummaryRow): ProjectSummary => ({
  id: r.id,
  name: r.name,
  duration: r.duration,
  updatedAt: Date.parse(r.updated_at),
  thumbnail: r.thumbnail ?? undefined,
  folderId: r.folder_id ?? undefined,
  width: r.width ?? undefined,
  height: r.height ?? undefined,
  mode: r.mode ?? undefined,
  isTemplate: r.is_template || undefined,
  source: r.source,
  shareId: r.share_id ?? undefined,
})

/** Tahmin edilemeyen paylaşım kimliği (22 karakter, base64url). */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/** Hesaba bağlı bulut deposu: `createRepository` ile aynı yöntemler, veriler Supabase'te. Erişimi RLS sınırlar. */
export function createCloudRepository(client: SupabaseClient, userId: string): Repository {
  const projects = () => client.from('projects')
  const folders = () => client.from('folders')

  const list = async () => {
    const read = (columns: string) => projects().select(columns).order('updated_at', { ascending: false })
    let res = await read(SUMMARY_COLUMNS)
    // 20261002 migration'ı henüz uygulanmamış veritabanı (şablon/paylaşım sütunları yok): eski sütunlarla oku.
    if (res.error?.code === '42703') res = await read(LEGACY_SUMMARY_COLUMNS)
    return ((check(res) ?? []) as unknown as SummaryRow[]).map(toSummary)
  }
  const listFolders = async (): Promise<Folder[]> =>
    (check(await folders().select('id,name,created_at').order('created_at', { ascending: true })) ?? []).map((r) => ({ id: r.id as string, name: r.name as string, createdAt: Date.parse(r.created_at as string) }))

  return {
    list,
    async load(id) {
      const row = check(await projects().select('data').eq('id', id).maybeSingle())
      return row ? migrateProject(row.data as object) : undefined
    },
    async save(project: Project, thumbnail?: string) {
      const payload: Record<string, unknown> = {
        user_id: userId,
        id: project.id,
        name: project.name,
        duration: project.duration,
        width: project.width,
        height: project.height,
        mode: project.mode ?? null,
        data: project,
        updated_at: new Date().toISOString(),
      }
      // Yeni küçük resim yoksa eskisine dokunma (sütunu hiç göndermemek eskisini korur).
      if (thumbnail !== undefined) payload.thumbnail = thumbnail
      check(await projects().upsert(payload, { onConflict: 'user_id,id' }))
    },
    async setThumbnail(id, thumbnail) {
      check(await projects().update({ thumbnail }).eq('id', id))
    },
    async moveToFolder(id, folderId) {
      check(await projects().update({ folder_id: folderId ?? null }).eq('id', id))
    },
    async setTemplate(id, isTemplate) {
      check(await projects().update({ is_template: isTemplate }).eq('id', id))
    },
    async share(id) {
      const row = check(await projects().select('share_id').eq('id', id).maybeSingle())
      if (row?.share_id) return row.share_id as string
      const shareId = newShareId()
      check(await projects().update({ share_id: shareId, shared_at: new Date().toISOString() }).eq('id', id))
      return shareId
    },
    async unshare(id) {
      check(await projects().update({ share_id: null, shared_at: null }).eq('id', id))
    },
    async rename(id, name) {
      const row = check(await projects().select('data').eq('id', id).maybeSingle())
      const data = row ? { ...(row.data as object), name } : undefined
      check(await projects().update(data ? { name, data } : { name }).eq('id', id))
    },
    listFolders,
    async createFolder(name) {
      const folder: Folder = { id: newId('f'), name, createdAt: Date.now() }
      check(await folders().insert({ user_id: userId, id: folder.id, name, created_at: new Date(folder.createdAt).toISOString() }))
      return folder
    },
    async renameFolder(id, name) {
      check(await folders().update({ name }).eq('id', id))
    },
    async removeFolder(id) {
      check(await projects().update({ folder_id: null }).eq('folder_id', id))
      check(await folders().delete().eq('id', id))
    },
    async remove(id) {
      check(await projects().delete().eq('id', id))
    },
  }
}
