import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../cloud/client'
import { setCloudAssetStore } from '../persistence/assets'
import { createCloudAssetStore } from '../persistence/cloudAssets'
import { createCloudRepository } from '../persistence/cloudRepository'
import { setCloudRepository } from '../persistence/repository'
import { useProfileStore } from './profileStore'

interface AuthStore {
  /** `loading`: oturum henüz okunmadı; `out`: giriş yok (yerel depolama); `in`: hesap (bulut) */
  status: 'loading' | 'out' | 'in'
  user: User | null
  /** Kullanıcı değişince artar; ekranlar bununla yeniden kurulur ve listeleri yeni depodan okur. */
  version: number
  /** Giriş penceresi açık mı. */
  signInOpen: boolean
  openSignIn: () => void
  closeSignIn: () => void
  /** Tek kullanımlık giriş bağlantısı gönderir (parola yok). */
  sendMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()((set) => ({
  status: supabase ? 'loading' : 'out',
  user: null,
  version: 0,
  signInOpen: false,
  openSignIn: () => set({ signInOpen: true }),
  closeSignIn: () => set({ signInOpen: false }),
  async sendMagicLink(email) {
    if (!supabase) throw new Error('cloud-disabled')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/` } })
    if (error) throw error
  },
  async signOut() {
    await supabase?.auth.signOut()
  },
}))

function applySession(session: Session | null) {
  const state = useAuthStore.getState()
  const user = session?.user ?? null
  // Oturum yenilenmesi (aynı kullanıcı) depoları ve ekranları sıfırlamamalı.
  if (user && state.status === 'in' && state.user?.id === user.id) {
    useAuthStore.setState({ user })
    return
  }
  if (supabase && user) {
    setCloudRepository(createCloudRepository(supabase, user.id))
    setCloudAssetStore(createCloudAssetStore(supabase, user.id))
    useAuthStore.setState({ status: 'in', user, version: state.version + 1, signInOpen: false })
    // geri çağrının içinde Supabase beklenmez (kilitlenir): profil bir sonraki turda okunur
    setTimeout(() => void useProfileStore.getState().load(user.id).catch(() => undefined), 0)
  } else {
    if (state.status === 'out') return
    setCloudRepository(undefined)
    setCloudAssetStore(undefined)
    useProfileStore.getState().reset()
    useAuthStore.setState({ status: 'out', user: null, version: state.version + 1 })
  }
}

let started = false

/** Oturumu okur ve değişiklikleri izler. Bulut ayarı yoksa hiçbir şey yapmaz (yalnızca yerel). */
export function initAuth() {
  if (started || !supabase) return
  started = true
  // Geri çağrıda başka Supabase çağrısı beklenmez (kilitlenme olur); depoları kurmak yalnızca nesne üretir.
  supabase.auth.onAuthStateChange((_event, session) => applySession(session))
  void supabase.auth.getSession().then(({ data }) => {
    // onAuthStateChange zaten INITIAL_SESSION ile bildirir; ikisi de aynı sonucu verir.
    if (useAuthStore.getState().status === 'loading') applySession(data.session)
  })
}
