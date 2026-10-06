import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/** Claude Code'a Mango Studio'yu bağlayan komut (MCP sunucusu `src/mcp`). */
export const MCP_COMMAND = 'claude mcp add --transport http mango-studio https://mangostudio.design/mcp'

/** Claude Code'a bağlama komutu: büyük, tek satır; yanında kopyalama düğmesi (kopyalanınca kısa süre onay gösterir). */
export function McpCommand() {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])
  const copy = () => {
    void navigator.clipboard.writeText(MCP_COMMAND).then(
      () => setCopied(true),
      () => undefined,
    )
  }
  return (
    <div className="h-command">
      <span className="h-command-label">{t('homePage.claude.run')}</span>
      <div className="h-command-row">
        <code>
          <span aria-hidden="true">$ </span>
          {MCP_COMMAND}
        </code>
        <button type="button" className={`h-btn h-btn--accent h-copy${copied ? ' is-copied' : ''}`} onClick={copy}>
          {copied ? <Check size={16} strokeWidth={2.5} aria-hidden="true" /> : <Copy size={16} strokeWidth={2} aria-hidden="true" />}
          <span aria-live="polite">{copied ? t('homePage.claude.copied') : t('homePage.claude.copy')}</span>
        </button>
      </div>
    </div>
  )
}
