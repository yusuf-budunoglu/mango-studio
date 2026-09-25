import { useTranslation } from 'react-i18next'
import { TemplateCard } from '../components/TemplateCard'
import { AppShell } from '../layout/AppShell'
import { TEMPLATES, templateDescription, templateName } from '../project/templates'
import { matchesSearch, useUiStore } from '../store/uiStore'

export function Templates() {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const visible = TEMPLATES.filter((tpl) => matchesSearch(`${templateName(tpl.id)} ${templateDescription(tpl.id)}`, search))

  return (
    <AppShell current={{ screen: 'templates' }} title={t('templatesPage.title')}>
      <div className="page-column">
        <p className="hint">{t('home.newVideoHint')}</p>
        {visible.length === 0 ? (
          <p className="hint">{t('search.noResults', { query: search })}</p>
        ) : (
          <div className="tile-grid">
            {visible.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
