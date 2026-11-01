import { Palette } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBrandKitStore } from '../cloud/brandKit'
import { brandPatch, isEmptyBrandKit } from '../project/brandKit'
import { routeToPath } from '../router'
import { usePlan } from '../store/planStore'
import { useProjectStore } from '../store/projectStore'

/**
 * Editörün proje panelindeki "Marka kitini uygula": kayıtlı marka kitini açık projeye tek geri alma adımında uygular
 * (renkler, yazı tipi, logo, marka adı). Planında yoksa yükseltme bağlantısı, kit boşsa profile bağlantı.
 */
export function BrandKitApply() {
  const { t } = useTranslation()
  const { plan } = usePlan()
  const kit = useBrandKitStore((s) => s.kit)
  const [applied, setApplied] = useState<number>()

  useEffect(() => {
    if (plan.brandKit) void useBrandKitStore.getState().load()
  }, [plan.brandKit])

  const apply = () => {
    const { project, patchLayers } = useProjectStore.getState()
    const patches = brandPatch(project, kit)
    patchLayers(patches)
    setApplied(Object.keys(patches).length)
  }

  const ready = plan.brandKit && !isEmptyBrandKit(kit)
  return (
    <div className="brand-apply">
      <label>{t('brandKit.title')}</label>
      {ready ? (
        <button type="button" onClick={apply}>
          <Palette size={13} strokeWidth={1.75} aria-hidden="true" />
          {t('brandKit.apply')}
        </button>
      ) : (
        <a className="export-upgrade" href={routeToPath({ screen: plan.brandKit ? 'profile' : 'pricing' })}>
          <Palette size={12} strokeWidth={2} aria-hidden="true" />
          {t(plan.brandKit ? 'brandKit.setUp' : 'brandKit.upgrade')}
        </a>
      )}
      {applied !== undefined && (
        <p className="hint" role="status">
          {applied > 0 ? t('brandKit.applied', { n: applied }) : t('brandKit.nothingToApply')}
        </p>
      )}
    </div>
  )
}
