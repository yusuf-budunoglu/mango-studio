// Üye olmayan ziyaretçi bir şablona tıklayıp üye olunca, giriş bağlantısından döndüğünde o şablona geri götürülür.
// Bağlantı ana adrese döner (PKCE `?code=`), bu yüzden hedef yol tarayıcıda saklanır.
const NEXT_KEY = 'mango-studio.after-sign-in'

export function rememberNext(path: string) {
  try {
    localStorage.setItem(NEXT_KEY, path)
  } catch {
    // saklanamazsa girişten sonra ana sayfa açılır
  }
}

/** Bekleyen hedef yolu döndürür ve siler. */
export function takeNext(): string | undefined {
  try {
    const stored = localStorage.getItem(NEXT_KEY) ?? undefined
    localStorage.removeItem(NEXT_KEY)
    // eski sürümün sakladığı `#/...` hedefi de geçerli
    const next = stored?.startsWith('#/') ? stored.slice(1) : stored
    return next?.startsWith('/') && !next.startsWith('//') ? next : undefined
  } catch {
    return undefined
  }
}
