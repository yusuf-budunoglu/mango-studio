import { useTranslation } from 'react-i18next'
import { supabase } from '../cloud/client'
import { AuroraBackground } from '../components/AuroraBackground'
import { McpCommand } from '../components/McpCommand'
import { AppShell } from '../layout/AppShell'
import { useAuthStore } from '../store/authStore'
import { Section, Spark, TextLink } from './Home'
import '../styles/home.css'

const STEPS = ['add', 'signIn', 'ask', 'open'] as const
/** MCP sunucusunun araçları (`src/mcp/tools.ts`); açıklamaları `mcpPage.tools.<ad>`. */
const TOOLS = ['get_guide', 'list_projects', 'get_project', 'save_project', 'create_upload'] as const
const ASKS = ['launch', 'edit', 'reference'] as const
const NOTES = ['render', 'account', 'editable'] as const

/** MCP sayfası (`/claude`): Claude Code'a bağlama komutu, kurulum adımları, araçlar, örnek istekler. Ana sayfanın düzeniyle. */
export function ClaudeConnect() {
  const { t } = useTranslation()
  const guest = useAuthStore((s) => !!supabase && s.status === 'out')

  return (
    <AppShell current={{ screen: 'claude' }} title={t('nav.mcpFull')} bare={guest}>
      <div className="h-page">
        <AuroraBackground />
        <header className="h-hero">
          <h1>
            Mango Studio <span>MCP</span>
          </h1>
          <p className="h-tagline">{t('mcpPage.tagline')}</p>
          <p className="h-note">
            <Spark className="spark spark--claude" /> {t('mcpPage.note')}
          </p>
        </header>
        <div className="h-lead-block">
          <McpCommand />
        </div>

        <Section id="mcp-steps" eyebrow={t('mcpPage.steps.eyebrow')} title={t('mcpPage.steps.title')} lead={t('mcpPage.steps.lead')} wide>
          <ol className="h-steps">
            {STEPS.map((step, n) => (
              <li key={step}>
                <small>0{n + 1}</small>
                {t(`mcpPage.steps.${step}.title`)}
                <p>{t(`mcpPage.steps.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="mcp-tools" eyebrow={t('mcpPage.tools.eyebrow', { count: TOOLS.length })} title={t('mcpPage.tools.title')} lead={t('mcpPage.tools.lead')}>
          <div className="h-card">
            <ul className="h-rows h-rows--points">
              {TOOLS.map((tool) => (
                <li key={tool}>
                  <span>
                    <code>{tool}</code>
                  </span>
                  <small>{t(`mcpPage.tools.${tool}`)}</small>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section id="mcp-asks" eyebrow={t('mcpPage.asks.eyebrow')} title={t('mcpPage.asks.title')} lead={t('mcpPage.asks.lead')} wide>
          <ul className="h-asks">
            {ASKS.map((ask) => (
              <li key={ask}>{t(`mcpPage.asks.${ask}`)}</li>
            ))}
          </ul>
          <TextLink route={{ screen: 'prompts' }}>{t('explore.prompts.cta')}</TextLink>
        </Section>

        <Section id="mcp-notes" title={t('mcpPage.notes.title')} lead={t('mcpPage.notes.lead')}>
          <div className="h-card">
            <ul className="h-rows h-rows--points">
              {NOTES.map((note) => (
                <li key={note}>
                  <span>{t(`mcpPage.notes.${note}.title`)}</span>
                  <small>{t(`mcpPage.notes.${note}.body`)}</small>
                </li>
              ))}
            </ul>
            <TextLink route={{ screen: 'studio' }}>{t('mcpPage.openStudio')}</TextLink>
          </div>
        </Section>
      </div>
    </AppShell>
  )
}
