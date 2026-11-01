import { Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { addMonths } from '../billing/plans'
import { exportBlocked, useExportQuotaStore } from '../cloud/exportQuota'
import { routeToPath } from '../router'
import { usePlan } from '../store/planStore'

/**
 * Çıktı penceresindeki ücretsiz plan satırları: filigran notu ve aylık sınır (kalan çıktı sayısı; sınır dolunca
 * yenilenme günü ve yükseltme bağlantısı). Ücretli planda hiçbir şey çizmez; sınır bilinmiyorsa yalnızca filigran notu.
 */
export function ExportQuotaNote() {
  const { t, i18n } = useTranslation()
  const quota = useExportQuotaStore((s) => s.quota)
  const { plan } = usePlan()
  const watermark = plan.watermark ? (
    <p className="hint">
      {t('exportQuota.watermark')} <a href={routeToPath({ screen: 'pricing' })}>{t('exportQuota.removeWatermark')}</a>
    </p>
  ) : null
  if (!quota || quota.limit === null) return watermark
  if (!exportBlocked(quota)) {
    return (
      <>
        {watermark}
        <p className="hint">{t('exportQuota.left', { left: quota.limit - quota.used, limit: quota.limit })}</p>
      </>
    )
  }
  const renews = quota.periodStart === null ? null : new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(addMonths(quota.periodStart, 1))
  return (
    <>
      <p className="export-error" role="status">
        {t('exportQuota.reached', { limit: quota.limit })} {renews && t('exportQuota.renews', { limit: quota.limit, date: renews })}
      </p>
      <a className="export-upgrade" href={routeToPath({ screen: 'pricing' })}>
        <Lock size={12} strokeWidth={2} aria-hidden="true" />
        {t('exportQuota.upgrade')}
      </a>
    </>
  )
}
