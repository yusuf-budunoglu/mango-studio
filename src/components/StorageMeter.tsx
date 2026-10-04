import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { formatBytes } from '../billing/plans'
import { routeToPath } from '../router'
import { useProfileStore } from '../store/profileStore'

/** Studio menüsünün altında depolama kullanımı: "1,2 GB / 5 GB"; %80'i geçince yükseltme bağlantısı. */
export function StorageMeter() {
  const { t, i18n } = useTranslation()
  const storage = useProfileStore((s) => s.storage)
  useEffect(() => {
    void useProfileStore.getState().refreshStorage()
  }, [])
  if (!storage) return null
  const ratio = storage.quota > 0 ? Math.min(1, storage.used / storage.quota) : 1
  const level = ratio >= 1 ? 'full' : ratio >= 0.8 ? 'high' : 'ok'
  return (
    <div className={`storage-meter storage-meter--${level}`}>
      <div className="storage-meter-head">
        <span>{t('storage.label')}</span>
        <span>{t('storage.usage', { used: formatBytes(storage.used, i18n.language), quota: formatBytes(storage.quota, i18n.language) })}</span>
      </div>
      <span className="storage-meter-bar" role="meter" aria-valuemin={0} aria-valuemax={storage.quota} aria-valuenow={storage.used} aria-label={t('storage.label')}>
        <span style={{ width: `${ratio * 100}%` }} />
      </span>
      {level !== 'ok' && (
        <a className="storage-meter-upgrade" href={routeToPath({ screen: 'pricing' })}>
          {t(level === 'full' ? 'storage.full' : 'storage.almostFull')}
        </a>
      )}
    </div>
  )
}
