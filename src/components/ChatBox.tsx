import { ArrowUp, Clapperboard, Megaphone, MonitorPlay, Sparkles, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type Tab = 'launch' | 'demo' | 'logo' | 'social'

const TABS: { id: Tab; icon: LucideIcon; seconds: number }[] = [
  { id: 'launch', icon: Clapperboard, seconds: 8 },
  { id: 'demo', icon: MonitorPlay, seconds: 12 },
  { id: 'logo', icon: Sparkles, seconds: 5 },
  { id: 'social', icon: Megaphone, seconds: 6 },
]

const SUGGESTIONS = ['launch', 'features', 'logo', 'numbers'] as const

interface Message {
  id: number
  role: 'user' | 'assistant'
  text: string
}

/**
 * Metinden video için sohbet kutusu. Yapay zekâ henüz bağlı değil: mesaj gönderilince
 * asistan bunu söyler. Bağlandığında sadece `reply` kısmı gerçek bir çağrıyla değişecek.
 */
export function ChatBox() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('launch')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const nextId = useRef(0)
  const thread = useRef<HTMLDivElement>(null)
  const seconds = TABS.find((x) => x.id === tab)?.seconds ?? 8

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight })
  }, [messages])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    setMessages((m) => [
      ...m,
      { id: nextId.current++, role: 'user', text },
      { id: nextId.current++, role: 'assistant', text: t('chat.notConnected') },
    ])
    setDraft('')
  }

  return (
    <section className="chat" aria-label={t('nav.textToVideo')}>
      <div className="chat-tabs" role="tablist">
        {TABS.map(({ id, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`chat-tab ${tab === id ? 'is-active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
            {t(`chat.tabs.${id}`)}
          </button>
        ))}
      </div>

      {messages.length > 0 && (
        <div className="chat-thread" ref={thread}>
          {messages.map((m) => (
            <div key={m.id} className={`chat-message chat-message--${m.role}`}>
              <span className="chat-author">{m.role === 'user' ? t('chat.you') : t('chat.assistant')}</span>
              <p>{m.text}</p>
            </div>
          ))}
        </div>
      )}

      <textarea
        id="chat-input"
        className="chat-input"
        rows={messages.length ? 2 : 5}
        value={draft}
        placeholder={t('chat.placeholder')}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            send()
          }
        }}
      />

      {messages.length === 0 && (
        <div className="chat-suggestions">
          {SUGGESTIONS.map((key) => (
            <button key={key} type="button" className="chip" onClick={() => setDraft(t(`chat.suggestions.${key}`))}>
              {t(`chat.suggestions.${key}`)}
            </button>
          ))}
        </div>
      )}

      <div className="chat-footer">
        <span className="chat-option">{t('chat.format')}</span>
        <span className="chat-option">{t('chat.duration', { n: seconds })}</span>
        {messages.length > 0 && (
          <button type="button" className="chat-option chat-clear" onClick={() => setMessages([])}>
            <Trash2 size={13} strokeWidth={1.75} aria-hidden="true" />
            {t('chat.clear')}
          </button>
        )}
        <button type="button" className="chat-send" onClick={send} disabled={!draft.trim()}>
          <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
          {t('chat.generate')}
        </button>
      </div>
    </section>
  )
}
