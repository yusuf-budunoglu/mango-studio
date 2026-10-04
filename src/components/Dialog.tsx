import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Tarayıcının `<dialog>` öğesiyle modal pencere: arka planı karartır, Esc ile kapanır, odağı içeride tutar.
 * Bileşen ekrandayken açıktır; kapatmak için üst bileşen onu kaldırır.
 */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // showModal odağı ilk düğmeye (kapat) verir; React'in autoFocus'u ondan önce çalıştığı için ezilir.
      dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    }
    return () => dialog?.close()
  }, [])

  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // karartılmış alana tıklayınca kapanır (dialog öğesinin kendisi = arka plan)
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-body">
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('studio.close')}>
            <X size={15} strokeWidth={1.75} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  )
}

/** Tek bir ad soran pencere (yeni klasör, yeniden adlandırma). Boş ad kabul edilmez. */
export function NameDialog({
  title,
  placeholder,
  submitLabel,
  initial = '',
  onSubmit,
  onClose,
}: {
  title: string
  placeholder: string
  submitLabel: string
  initial?: string
  onSubmit: (name: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(initial)
  const trimmed = name.trim()
  return (
    <Dialog title={title} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) onSubmit(trimmed)
        }}
      >
        <input className="modal-input" data-autofocus value={name} placeholder={placeholder} aria-label={placeholder} maxLength={80} onChange={(e) => setName(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!trimmed}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** Geri alınamayan işlem için onay penceresi. */
export function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }: { title: string; body: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="modal-text">{body}</p>
      <div className="modal-actions">
        <button type="button" data-autofocus onClick={onClose}>
          {t('common.cancel')}
        </button>
        <button type="button" className="danger-solid" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
