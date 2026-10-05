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
}

interface MemberRow {
  user_id: string
  email: string | null
  provider: string
  plan: string
  created_at: string
  last_sign_in_at: string | null
  is_new: boolean
}

/**
 * Yönetici ekranı: üye listesi ve sol menüdeki yeni üye sayacı. Veriler yalnızca yöneticiye açık
 * sunucu işlevlerinden gelir (`admin_members`, `admin_member_counts`); yönetici olmayana boş kalır.
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
      lastSignInAt: row.last_sign_in_at ? Date.parse(row.last_sign_in_at) : null,
      isNew: row.is_new,
    }))
    set({ members, status: 'ready' })
    const seen = await supabase.rpc('admin_mark_members_seen')
    if (!seen.error) await get().refreshCounts()
  },
  reset: () => set({ total: 0, unseen: 0, members: [], status: 'idle' }),
}))
