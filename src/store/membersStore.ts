import { create } from 'zustand'
import { supabase } from '../cloud/client'

export interface Member {
  userId: string
  email: string
  /** giriş yöntemi: 'email', 'google', 'github' */
  provider: string
  plan: string
  createdAt: number
  lastSignInAt: number | null
  /** yöneticinin Üyeler sayfasını son açışından sonra üye oldu */
  isNew: boolean
  banned: boolean
}

/** Bir üyenin ayrıntısı (`admin_member_detail`): hesap, plan, depolama, proje ve çıktı sayıları. Proje içeriği yok. */
export interface MemberDetail {
  userId: string
  email: string
  name: string | null
  providers: string[]
  createdAt: number
  lastSignInAt: number | null
  emailConfirmed: boolean
  banned: boolean
  isAdmin: boolean
  isSelf: boolean
  plan: string
  storageUsed: number
  storageQuota: number
  files: number
  projects: { videos: number; designs: number; templates: number; shared: number; byClaude: number; lastEdit: number | null }
  /** çıktı sayacı eklendikten sonra alınanlar */
  exports: { videos: number; images: number; last: number | null }
  recentProjects: { name: string; design: boolean; template: boolean; byClaude: boolean; updatedAt: number }[]
  recentExports: { kind: 'video' | 'image'; format: string; width: number; height: number; fps: number | null; createdAt: number }[]
}

interface MemberRow {
  user_id: string
  email: string | null
  provider: string
  plan: string
  created_at: string
  last_sign_in_at: string | null
  is_new: boolean
  banned?: boolean
}

interface DetailRow {
  user_id: string
  email: string | null
  name: string | null
  providers: string[]
  created_at: string
  last_sign_in_at: string | null
  email_confirmed: boolean
  banned: boolean
  is_admin: boolean
  is_self: boolean
  plan: string
  storage_used: number
  storage_quota: number
  files: number
  projects: { videos: number; designs: number; templates: number; shared: number; by_claude: number; last_edit: string | null }
  exports: { videos: number; images: number; last: string | null }
  recent_projects: { name: string; design: boolean; template: boolean; by_claude: boolean; updated_at: string }[]
  recent_exports: { kind: 'video' | 'image'; format: string; width: number; height: number; fps: number | null; created_at: string }[]
}

const time = (value: string | null) => (value ? Date.parse(value) : null)

function toDetail(row: DetailRow): MemberDetail {
  return {
    userId: row.user_id,
    email: row.email ?? '',
    name: row.name,
    providers: row.providers,
    createdAt: Date.parse(row.created_at),
    lastSignInAt: time(row.last_sign_in_at),
    emailConfirmed: row.email_confirmed,
    banned: row.banned,
    isAdmin: row.is_admin,
    isSelf: row.is_self,
    plan: row.plan,
    storageUsed: Number(row.storage_used),
    storageQuota: Number(row.storage_quota),
    files: Number(row.files),
    projects: {
      videos: row.projects.videos,
      designs: row.projects.designs,
      templates: row.projects.templates,
      shared: row.projects.shared,
      byClaude: row.projects.by_claude,
      lastEdit: time(row.projects.last_edit),
    },
    exports: { videos: row.exports.videos, images: row.exports.images, last: time(row.exports.last) },
    recentProjects: row.recent_projects.map((p) => ({ name: p.name, design: p.design, template: p.template, byClaude: p.by_claude, updatedAt: Date.parse(p.updated_at) })),
    recentExports: row.recent_exports.map((e) => ({ kind: e.kind, format: e.format, width: e.width, height: e.height, fps: e.fps, createdAt: Date.parse(e.created_at) })),
  }
}

/** Storage listesinin sayfa boyu; üyenin dosyaları `assets/<üye id>/<dosya id>` yolunda, alt klasör yok. */
const FILE_PAGE = 100

/**
 * Yönetici ekranı: üye listesi, sol menüdeki yeni üye sayacı, üye ayrıntısı, yasaklama ve silme.
 * Hepsi yalnızca yöneticiye açık sunucu işlevleriyle (`admin_*`); yönetici olmayana boş kalır ya da hata verir.
 */
interface MembersStore {
  total: number
  /** yöneticinin henüz görmediği yeni üye sayısı */
  unseen: number
  members: Member[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  refreshCounts: () => Promise<void>
  /** Listeyi okur, ardından hepsini görüldü sayar (listedeki "yeni" işaretleri sayfa açıkken kalır). */
  open: () => Promise<void>
  /** Hata olursa fırlatır. */
  detail: (userId: string) => Promise<MemberDetail>
  setBanned: (userId: string, banned: boolean) => Promise<void>
  /** Önce üyenin Storage'daki dosyalarını, sonra hesabı (ve ona bağlı her şeyi) siler. Geri alınamaz. */
  remove: (userId: string) => Promise<void>
  reset: () => void
}

export const useMembersStore = create<MembersStore>()((set, get) => ({
  total: 0,
  unseen: 0,
  members: [],
  status: 'idle',
  async refreshCounts() {
    if (!supabase) return
    const res = await supabase.rpc('admin_member_counts')
    const row = (res.data as { total: number; unseen: number }[] | null)?.[0]
    if (!res.error && row) set({ total: Number(row.total), unseen: Number(row.unseen) })
  },
  async open() {
    if (!supabase) return
    set({ status: 'loading' })
    const res = await supabase.rpc('admin_members')
    if (res.error) {
      set({ status: 'error' })
      return
    }
    const members = ((res.data as MemberRow[] | null) ?? []).map((row) => ({
      userId: row.user_id,
      email: row.email ?? '',
      provider: row.provider,
      plan: row.plan,
      createdAt: Date.parse(row.created_at),
      lastSignInAt: time(row.last_sign_in_at),
      isNew: row.is_new,
      banned: !!row.banned,
    }))
    set({ members, status: 'ready' })
    const seen = await supabase.rpc('admin_mark_members_seen')
    if (!seen.error) await get().refreshCounts()
  },
  async detail(userId) {
    if (!supabase) throw new Error('no-cloud')
    const res = await supabase.rpc('admin_member_detail', { p_user: userId })
    if (res.error || !res.data) throw new Error(res.error?.message ?? 'not_found')
    return toDetail(res.data as DetailRow)
  },
  async setBanned(userId, banned) {
    if (!supabase) throw new Error('no-cloud')
    const res = await supabase.rpc('admin_set_banned', { p_user: userId, p_banned: banned })
    if (res.error) throw new Error(res.error.message)
    set({ members: get().members.map((m) => (m.userId === userId ? { ...m, banned } : m)) })
  },
  async remove(userId) {
    if (!supabase) throw new Error('no-cloud')
    const bucket = supabase.storage.from('assets')
    // Her turda ilk sayfayı sil; boşalana kadar. Silinemeyen dosya olursa sonsuza dek dönmemek için tur sınırı.
    for (let round = 0; round < 1000; round++) {
      const page = await bucket.list(userId, { limit: FILE_PAGE })
      if (page.error) throw new Error(page.error.message)
      if (!page.data.length) break
      const removed = await bucket.remove(page.data.map((file) => `${userId}/${file.name}`))
      if (removed.error) throw new Error(removed.error.message)
      if (!removed.data?.length) throw new Error('storage-delete-failed')
    }
    const res = await supabase.rpc('admin_delete_user', { p_user: userId })
    if (res.error) throw new Error(res.error.message)
    set({ members: get().members.filter((m) => m.userId !== userId), total: Math.max(0, get().total - 1) })
  },
  reset: () => set({ total: 0, unseen: 0, members: [], status: 'idle' }),
}))
