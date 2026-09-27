import { Hourglass } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AppShell } from '../layout/AppShell'
import { routeToHash, type ComingSoonFeature } from '../router'

const FEATURE_LABEL: Record<ComingSoonFeature, string> = {
  music: 'nav.music',
  voiceover: 'nav.voiceover',
  'sound-effects': 'nav.soundEffects',
  mcp: 'nav.mcpFull',
}

export function ComingSoon({ feature }: { feature: ComingSoonFeature }) {
  const { t } = useTranslation()
  const name = t(FEATURE_LABEL[feature])

  return (
    <AppShell current={{ screen: 'soon', feature }} title={name}>
      <div className="soon">
        <Hourglass size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2>{t('soon.title', { feature: name })}</h2>
        <p className="hint">{t('soon.body')}</p>
        <a className="button-primary" href={routeToHash({ screen: 'home' })}>
          {t('soon.back')}
        </a>
      </div>
    </AppShell>
  )
}
