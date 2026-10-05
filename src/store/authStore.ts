import type { Session, User } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '../cloud/client'
import { setCloudAssetStore } from '../persistence/assets'
import { createCloudAssetStore } from '../persistence/cloudAssets'
import { createCloudRepository } from '../persistence/cloudRepository'
import { setCloudRepository } from '../persistence/repository'
import { goTo, RESET_PASSWORD_PATH } from '../router'
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
  /** Google / GitHub ile giriş: sağlayıcının sayfasına gider, dönüşte oturum açılır. */
  signInWithProvider: (provider: AuthProvider) => Promise<void>
  /** Google'ın kendi düğmesinden (`GoogleButton`) gelen kimlik belgesiyle giriş; `nonce` belgeye özeti yazılan değer. */
  signInWithGoogleToken: (token: string, nonce: string) => Promise<void>
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Parolalı üyelik. `confirm`: e-postadaki doğrulama bağlantısı bekleniyor; `in`: doğrulama kapalı, oturum açıldı. */
  signUpWithPassword: (email: string, password: string) => Promise<'confirm' | 'in'>
  /** Parola sıfırlama bağlantısı gönderir; bağlantı `/reset-password` sayfasını açar. */
  sendPasswordReset: (email: string) => Promise<void>
  /** Giriş yapmış kullanıcının parolasını belirler ya da değiştirir. */
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AUTH_PROVIDERS = ['google', 'github'] as const
export type AuthProvider = (typeof AUTH_PROVIDERS)[number]
export const MIN_PASSWORD_LENGTH = 8

const cloud = () => {
  if (!supabase) throw new Error('cloud-disabled')
  return supabase
}
/** Giriş bağlantıları ana adrese döner (PKCE `?code=`); açılacak sayfa `afterSignIn` ile saklanır. */
const homeUrl = () => `${window.location.origin}/`

export const useAuthStore = create<AuthStore>()((set) => ({
  status: supabase ? 'loading' : 'out',
  user: null,
  version: 0,
  signInOpen: false,
  openSignIn: () => set({ signInOpen: true }),
  closeSignIn: () => set({ signInOpen: false }),
  async sendMagicLink(email) {
    const { error } = await cloud().auth.signInWithOtp({ email, options: { emailRedirectTo: homeUrl() } })
    if (error) throw error
  },
  async signInWithProvider(provider) {
    const { error } = await cloud().auth.signInWithOAuth({ provider, options: { redirectTo: homeUrl() } })
    if (error) throw error
  },
  async signInWithGoogleToken(token, nonce) {
    const { error } = await cloud().auth.signInWithIdToken({ provider: 'google', token, nonce })
    if (error) throw error
  },
  async signInWithPassword(email, password) {
    const { error } = await cloud().auth.signInWithPassword({ email, password })
    if (error) throw error
  },
  async signUpWithPassword(email, password) {
    const { data, error } = await cloud().auth.signUp({ email, password, options: { emailRedirectTo: homeUrl() } })
    if (error) throw error
    return data.session ? 'in' : 'confirm'
  },
  async sendPasswordReset(email) {
    const { error } = await cloud().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}` })
    if (error) throw error
  },
  async updatePassword(password) {
    const { error } = await cloud().auth.updateUser({ password })
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
  supabase.auth.onAuthStateChange((event, session) => {
    applySession(session)
    // Sıfırlama bağlantısı izinli adres listesinde yoksa Supabase ana sayfaya döndürür: yeni parola sayfasını yine de aç.
    if (event === 'PASSWORD_RECOVERY') setTimeout(() => goTo(RESET_PASSWORD_PATH), 0)
  })
  void supabase.auth.getSession().then(({ data }) => {
    // onAuthStateChange zaten INITIAL_SESSION ile bildirir; ikisi de aynı sonucu verir.
    if (useAuthStore.getState().status === 'loading') applySession(data.session)
  })
}
