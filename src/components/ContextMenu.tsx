import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type MenuItem =
  | { kind?: 'item'; label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; hint?: string }
  | { kind: 'separator' }
  | { kind: 'heading'; label: string }

interface Props {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

/** Fare konumunda açılan sağ tık menüsü. Dışarı tıklama, Esc ve kaydırma kapatır; ok tuşlarıyla gezilir. */
export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })

  // Ekrandan taşmasın.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    // eslint-disable-next-line react/set-state-in-effect -- menü ölçüsü ancak çizimden sonra biliniyor.
    setPos({ x: Math.min(x, window.innerWidth - width - 8), y: Math.min(y, window.innerHeight - height - 8) })
    el.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
  }, [x, y])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('wheel', onClose, { passive: true })
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('wheel', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    e.preventDefault()
    const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = e.key === 'ArrowDown' ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length
    buttons[next]?.focus()
  }

  return (
    <div ref={ref} className="context-menu" role="menu" style={{ left: pos.x, top: pos.y }} onKeyDown={onKeyDown} onContextMenu={(e) => e.preventDefault()}>
      {items.map((item, i) => {
        if (item.kind === 'separator') return <div key={i} className="context-sep" role="separator" />
        if (item.kind === 'heading') return <div key={i} className="context-heading">{item.label}</div>
        return (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={item.danger ? 'danger' : undefined}
            disabled={item.disabled}
            onClick={() => {
              onClose()
              item.onSelect()
            }}
          >
            <span>{item.label}</span>
            {item.hint && <kbd>{item.hint}</kbd>}
          </button>
        )
      })}
    </div>
  )
}
