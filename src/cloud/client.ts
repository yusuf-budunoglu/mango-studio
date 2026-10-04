import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

/**
 * Bulut bağlantısı. Ayarlar yoksa `null`: uygulama yalnızca tarayıcı depolamasıyla çalışır.
 * Giriş bağlantısı PKCE ile gelir (`?code=`); implicit akış adrese `#access_token=` yazardı.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }) : null
