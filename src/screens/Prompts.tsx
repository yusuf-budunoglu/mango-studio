import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PromptCard, PromptDialog } from '../components/PromptCard'
import { AppShell } from '../layout/AppShell'
import { loadPromptLibrary, matchesPromptFilter, PROMPT_FILTERS, promptSearchText, type LibraryPrompt, type PromptFilter } from '../project/promptLibrary'
import { parsePath, routeToPath } from '../router'
import { matchesSearch, useUiStore } from '../store/uiStore'

/**
 * Prompt'lar: Claude ile yapılmış hareketli videoların prompt'ları, önizlemeleriyle. Karta tıklayınca prompt'un
 * tamamı pencerede açılır; adres `/prompts/<id>` olur (paylaşılabilir) ama liste yerinde kalır.
 */
export function Prompts({ promptId }: { promptId?: string }) {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const [filter, setFilter] = useState<PromptFilter>('all')
  const [library, setLibrary] = useState<LibraryPrompt[]>()
  const [failed, setFailed] = useState(false)
  // Pencere adresi `replaceState` ile değiştirdiği için (aşağıda) `promptId` eskimiş olabilir: giriş yapınca sayfa
  // yeniden kurulduğunda açık prompt adresten okunur.
  const [openId, setOpenId] = useState(() => {
    const here = parsePath(window.location.pathname)
    return here.screen === 'prompts' ? here.promptId : promptId
  })

  useEffect(() => {
    let alive = true
    loadPromptLibrary().then(
      (list) => alive && setLibrary(list),
      () => alive && setFailed(true),
    )
    return () => {
      alive = false
    }
  }, [])

  // Adres `replaceState` ile değişir: `goTo` sayfayı başa sarıp aramayı siliyor, pencere açıp kapamak listeyi oynatmamalı.
  const show = (id?: string) => {
    setOpenId(id)
    window.history.replaceState(null, '', routeToPath({ screen: 'prompts', promptId: id }))
  }

  const visible = (library ?? []).filter((prompt) => matchesPromptFilter(prompt, filter) && matchesSearch(promptSearchText(prompt), search))
  const open = openId ? library?.find((prompt) => prompt.id === openId) : undefined

  return (
    <AppShell current={{ screen: 'prompts' }} title={t('promptsPage.title')}>
      <div className="market">
        <header className="market-head">
          <h1>{t('promptsPage.title')}</h1>
          <p>{t('promptsPage.subtitle')}</p>
        </header>
        <div className="market-bar" role="toolbar" aria-label={t('promptsPage.title')}>
          <div className="market-filters">
            {PROMPT_FILTERS.map((id) => (
              <button key={id} type="button" className={`market-filter${filter === id ? ' is-active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {t(`promptsPage.filters.${id}`)}
              </button>
            ))}
          </div>
          {library && <span className="market-count">{t('promptsPage.count', { count: visible.length })}</span>}
        </div>
        {failed ? (
          <p className="hint">{t('promptsPage.error')}</p>
        ) : !library ? (
          <p className="hint">{t('promptsPage.loading')}</p>
        ) : visible.length === 0 ? (
          <p className="hint">{search.trim() ? t('search.noResults', { query: search }) : t('promptsPage.empty')}</p>
        ) : (
          <div className="tcard-grid promptcard-grid">
            {visible.map((prompt) => (
              <PromptCard key={prompt.id} prompt={prompt} onOpen={show} />
            ))}
          </div>
        )}
        {library && openId && !open && <p className="hint">{t('promptsPage.notFound')}</p>}
      </div>
      {open && <PromptDialog key={open.id} prompt={open} onClose={() => show()} />}
    </AppShell>
  )
}
