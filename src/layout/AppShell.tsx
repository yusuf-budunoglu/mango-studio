import { PanelLeft, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from '../components/LanguageSelect'
import type { Route } from '../router'
import { useUiStore } from '../store/uiStore'
import { Sidebar } from './Sidebar'

/** Sol menü + üst çubuk + içerik. Editör hariç tüm sayfalar bunu kullanır. */
export function AppShell({ current, title, children }: { current: Route; title: string; children: ReactNode }) {
  const { t } = useTranslation()
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)

  return (
    <div className="shell">
      <Sidebar current={current} />
      <div className="shell-main">
        <header className="shell-topbar">
          <button type="button" className="icon-button" onClick={toggleSidebar} aria-label={t('nav.toggleSidebar')} title={t('nav.toggleSidebar')}>
            <PanelLeft size={16} strokeWidth={1.75} />
          </button>
          <h1 className="shell-title">{title}</h1>
          <label className="shell-search">
            <Search size={15} strokeWidth={1.75} aria-hidden="true" />
            <span className="visually-hidden">{t('search.placeholder')}</span>
            <input
              id="global-search"
              type="search"
              value={search}
              placeholder={t('search.placeholder')}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="shell-actions">
            <LanguageSelect />
          </div>
        </header>
        <main className="shell-content">{children}</main>
      </div>
    </div>
  )
}
