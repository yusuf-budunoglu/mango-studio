import { newId } from '../engine/ids'
import type { Project } from '../engine/types'

/** Araçların veriye eriştiği yer; testlerde sahtesi verilir. Her çağrı oturum sahibinin yetkisiyle (RLS) çalışır. */
export interface Backend {
  listProjects(): Promise<ProjectInfo[]>
  getProject(id: string): Promise<Project | undefined>
  /** Varsa günceller (kimin oluşturduğu değişmez), yoksa Claude'un oluşturduğu proje olarak ekler. */
  saveProject(project: Project): Promise<{ created: boolean }>
  /** Dosya kaydını açar (kota burada denetlenir) ve dosyanın gönderileceği tek kullanımlık adresi döndürür. */
  createUpload(file: UploadRequest): Promise<{ id: string; uploadUrl: string }>
}

export interface ProjectInfo {
  id: string
  name: string
  duration: number
  width: number | null
  height: number | null
  mode: 'design' | null
  source: 'editor' | 'mcp'
  updatedAt: string
}

export interface UploadRequest {
  name: string
  kind: 'image' | 'audio' | 'video' | 'svg' | 'font'
  contentType: string
  size: number
  duration?: number
}

/** Kullanıcıya gösterilebilir hata (kota doldu gibi); araç sonucu olarak döner. */
export class BackendError extends Error {}

const ASSET_BUCKET = 'assets'

/** Supabase REST + Storage: istekler kullanıcının erişim anahtarıyla gider, erişimi RLS sınırlar. */
export function createSupabaseBackend(options: { url: string; publishableKey: string; accessToken: string; userId: string; fetch?: typeof fetch }): Backend {
  const { url, publishableKey, accessToken, userId } = options
  const doFetch = options.fetch ?? fetch
  const headers = { apikey: publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }

  const call = async (path: string, init: RequestInit = {}) => {
    const res = await doFetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string> | undefined) } })
    const text = await res.text()
    if (!res.ok) {
      if (text.includes('storage_quota_exceeded')) throw new BackendError('The storage quota of this account is full. Delete files in the Studio or upgrade the plan.')
      throw new BackendError(`Mango Studio could not complete the request (${res.status}): ${text.slice(0, 300)}`)
    }
    return text ? (JSON.parse(text) as unknown) : undefined
  }
  const idFilter = (id: string) => `id=eq.${encodeURIComponent(id)}`

  return {
    async listProjects() {
      const rows = (await call('/rest/v1/projects?select=id,name,duration,width,height,mode,source,updated_at&order=updated_at.desc&limit=100')) as Record<string, unknown>[]
      return rows.map((r) => ({ id: r.id, name: r.name, duration: r.duration, width: r.width, height: r.height, mode: r.mode, source: r.source, updatedAt: r.updated_at }) as ProjectInfo)
    },
    async getProject(id) {
      const rows = (await call(`/rest/v1/projects?select=data&${idFilter(id)}`)) as { data: Project }[]
      return rows[0]?.data
    },
    async saveProject(project) {
      const existing = (await call(`/rest/v1/projects?select=id&${idFilter(project.id)}`)) as unknown[]
      const row = {
        name: project.name,
        duration: project.duration,
        width: project.width,
        height: project.height,
        mode: project.mode === 'design' ? 'design' : null,
        data: project,
        updated_at: new Date().toISOString(),
      }
      if (existing.length) await call(`/rest/v1/projects?${idFilter(project.id)}`, { method: 'PATCH', body: JSON.stringify(row) })
      else await call('/rest/v1/projects', { method: 'POST', body: JSON.stringify({ ...row, user_id: userId, id: project.id, source: 'mcp' }) })
      return { created: !existing.length }
    },
    async createUpload(file) {
      const id = newId('a')
      // Önce satır: kota bu satır eklenirken denetlenir, Storage yalnızca satırı olan dosyayı kabul eder.
      await call('/rest/v1/assets', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, id, name: file.name.slice(0, 300), kind: file.kind, type: file.contentType, size: file.size, duration: file.duration ?? null }),
      })
      const signed = (await call(`/storage/v1/object/upload/sign/${ASSET_BUCKET}/${userId}/${id}`, { method: 'POST', body: '{}' })) as { url: string }
      return { id, uploadUrl: `${url}/storage/v1${signed.url}` }
    },
  }
}
