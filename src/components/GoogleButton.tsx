import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'

/** Google Identity Services'in bu dosyada kullanılan kısmı. */
interface GoogleIdentity {
  initialize(options: { client_id: string; nonce: string; callback: (response: { credential?: string }) => void; ux_mode: 'popup' }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } }
  }
}

const SCRIPT_URL = 'https://accounts.google.com/gsi/client'
let script: Promise<void> | undefined

function loadGoogle(): Promise<void> {
  script ??= new Promise<void>((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_URL
    el.async = true
    el.onload = () => resolve()
    el.onerror = () => {
      script = undefined
      reject(new Error('google script blocked'))
    }
    document.head.append(el)
  })
  return script
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Google'ın kendi giriş düğmesi (Google Identity Services). Giriş Google'ın penceresinde, bizim alan adımız
 * adına yapılır: onay ekranında Supabase'in proje adresi (`<proje>.supabase.co`) yerine `mangostudio.design`
 * görünür. Google kimlik belgesini (ID token) verir, oturumu Supabase onunla açar. Düğmeyi Google çizer
 * (kendi çerçevesinde); betik yüklenemezse (engelleyici, ağ) `fallback` — yönlendirmeli eski akış — gösterilir.
 */
export function GoogleButton({ clientId, onError, fallback }: { clientId: string; onError: (error: unknown) => void; fallback: ReactNode }) {
  const { i18n } = useTranslation()
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)
  const signIn = useAuthStore((s) => s.signInWithGoogleToken)
  const language = i18n.language

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // Google belgeye nonce'ın özetini yazar, Supabase asıl değerle karşılaştırır: belge başka yerde kullanılamaz.
        const nonce = hex(crypto.getRandomValues(new Uint8Array(16)))
        const hashed = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(nonce))))
        await loadGoogle()
        const google = window.google?.accounts.id
        if (cancelled || !host.current) return
        if (!google) throw new Error('google script missing')
        google.initialize({
          client_id: clientId,
          nonce: hashed,
          ux_mode: 'popup',
          callback: ({ credential }) => {
            if (credential) signIn(credential, nonce).catch(onError)
            else onError(new Error('no credential'))
          },
        })
        host.current.replaceChildren()
        google.renderButton(host.current, { type: 'standard', theme: 'filled_black', size: 'large', shape: 'rectangular', text: 'continue_with', logo_alignment: 'center', width: Math.min(400, Math.round(host.current.clientWidth)), locale: language })
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clientId, language, onError, signIn])

  if (failed) return <>{fallback}</>
  return <div ref={host} className="auth-google" />
}
