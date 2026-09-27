import { useTranslation } from 'react-i18next'
import { McpPromo, TemplateMarquee } from '../components/McpPromo'
import { TemplateCard } from '../components/TemplateCard'
import { AppShell } from '../layout/AppShell'
import { TEMPLATES, templateDescription, templateName } from '../project/templates'
import { routeToHash } from '../router'
import { matchesSearch, useUiStore } from '../store/uiStore'

export function Home() {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const templates = TEMPLATES.filter((tpl) => matchesSearch(`${templateName(tpl.id)} ${templateDescription(tpl.id)}`, search))

  return (
    <AppShell current={{ screen: 'home' }} title={t('nav.home')}>
      <div className="home-column">
        <section className="section">
          <div className="section-head">
            <h2>{t('templatesPage.title')}</h2>
            <a href={routeToHash({ screen: 'templates' })}>{t('templatesPage.viewAll')}</a>
          </div>
          {/* Arama yokken şablonlar akan şeritte; arama yapılınca eşleşenler ızgarada */}
          {!search.trim() ? (
            <TemplateMarquee />
          ) : templates.length === 0 ? (
            <p className="hint">{t('search.noResults', { query: search })}</p>
          ) : (
            <div className="tile-grid">
              {templates.map((tpl) => (
                <TemplateCard key={tpl.id} template={tpl} />
              ))}
            </div>
          )}
        </section>

        <section className="banner">
          <h2>{t('banner.title')}</h2>
          <p>{t('banner.body')}</p>
          <div className="banner-actions">
            <a className="banner-primary" href={routeToHash({ screen: 'templates' })}>
              {t('banner.primary')}
            </a>
            <a className="banner-secondary" href={routeToHash({ screen: 'videos' })}>
              {t('banner.secondary')}
            </a>
          </div>
        </section>

        <McpPromo />
      </div>
    </AppShell>
  )
}
