import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'

const COOLDOWN_SECONDS = 60

/** E-postaya tek kullanımlık giriş bağlantısı: giriş penceresi ve üyelik sayfası paylaşır. */
export function useMagicLink() {
  const { t } = useTranslation()
  const sendMagicLink = useAuthStore((s) => s.sendMagicLink)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string>()
  const [wait, setWait] = useState(0)

  useEffect(() => {
    if (wait <= 0) return
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [wait])

  const trimmed = email.trim()
  const submit = async () => {
    if (!trimmed || state === 'sending' || wait > 0) return
    setState('sending')
    setError(undefined)
    try {
      await sendMagicLink(trimmed)
      setState('sent')
      setWait(COOLDOWN_SECONDS)
    } catch (err) {
      setState('idle')
      const message = err instanceof Error ? err.message.toLowerCase() : ''
      setError(message.includes('rate') ? t('account.errorRateLimit') : message.includes('invalid') ? t('account.errorInvalid') : t('account.errorGeneric'))
    }
  }

  return { email, setEmail, trimmed, state, error, wait, submit, changeEmail: () => setState('idle') }
}
