import { useAuthStore } from '../store/authStore'
import { supabase } from './client'

/**
 * Alınan her çıktıyı (video ya da görsel) sunucuya bir satır olarak yazar: yönetici ekranındaki çıktı
 * sayısı buradan gelir. Giriş yapılmamışsa ya da yazılamazsa sessizce atlanır; çıktıyı hiç geciktirmez.
 */
export function logExport(event: { kind: 'video' | 'image'; format: string; width: number; height: number; fps?: number; duration?: number }) {
  if (!supabase || useAuthStore.getState().status !== 'in') return
  void supabase
    .from('export_events')
    .insert({ kind: event.kind, format: event.format, width: event.width, height: event.height, fps: event.fps ?? null, duration: event.duration ?? null })
    .then(
      () => undefined,
      () => undefined,
    )
}
