import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TemplateCard } from '../components/TemplateCard'
import { AppShell } from '../layout/AppShell'
import { listPublished, type PublishedTemplate } from '../project/publishedTemplates'
import { TEMPLATES, templateDescription, templateName, type Template } from '../project/templates'
import { matchesSearch, useUiStore } from '../store/uiStore'

type Filter = 'all' | 'landscape' | 'vertical' | 'favorites'
const FILTERS: Filter[] = ['all', 'landscape', 'vertical', 'favorites']

type AnyTemplate = Template | PublishedTemplate

const isBuiltIn = (tpl: AnyTemplate): tpl is Template => 'build' in tpl
const orientation = (tpl: AnyTemplate) => (isBuiltIn(tpl) ? (tpl.format === '9:16' ? 'vertical' : 'landscape') : tpl.height > tpl.width ? 'vertical' : 'landscape')
const searchText = (tpl: AnyTemplate) =>
  isBuiltIn(tpl) ? `${templateName(tpl.id)} ${templateDescription(tpl.id)}` : `${tpl.name} ${tpl.description} ${tpl.tags.join(' ')}`

/** Şablonlar: kodla yazılan kendi şablonlarımız + yöneticinin Studio'dan yayınladıkları (en yenisi önde). */
export function Templates() {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const favorites = useUiStore((s) => s.favorites)
  const [filter, setFilter] = useState<Filter>('all')
  const [published, setPublished] = useState<PublishedTemplate[]>([])

  useEffect(() => {
    let alive = true
    void listPublished().then((list) => alive && setPublished(list))
    return () => {
      alive = false
    }
  }, [])

  const passes = (tpl: AnyTemplate) =>
    filter === 'all' || (filter === 'favorites' ? favorites.includes(tpl.id) : orientation(tpl) === filter)
  const visible = [...published, ...TEMPLATES].filter((tpl) => passes(tpl) && matchesSearch(searchText(tpl), search))

  return (
    <AppShell current={{ screen: 'templates' }} title={t('templatesPage.title')}>
      <div className="market">
        <header className="market-head">
          <h1>{t('templatesPage.title')}</h1>
          <p>{t('templatesPage.subtitle')}</p>
        </header>
        <div className="market-bar" role="toolbar" aria-label={t('templatesPage.title')}>
          <div className="market-filters">
            {FILTERS.map((id) => (
              <button key={id} type="button" className={`market-filter${filter === id ? ' is-active' : ''}`} aria-pressed={filter === id} onClick={() => setFilter(id)}>
                {t(`templatesPage.filters.${id}`)}
              </button>
            ))}
          </div>
          <span className="market-count">{t('templatesPage.count', { count: visible.length })}</span>
        </div>
        {visible.length === 0 ? (
          <p className="hint">{filter === 'favorites' && !search.trim() ? t('templatesPage.noFavorites') : t('search.noResults', { query: search })}</p>
        ) : (
          <div className="tcard-grid">
            {visible.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
