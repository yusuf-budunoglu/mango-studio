import { Palette, Plus, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useBrandKitStore } from '../cloud/brandKit'
import { assetRef, resolveAssetUrl } from '../persistence/assets'
import { storeFile } from '../persistence/storeFile'
import { MAX_BRAND_COLORS, type BrandKit } from '../project/brandKit'
import { FONTS } from '../render/fonts'
import { routeToPath } from '../router'
import { usePlan } from '../store/planStore'

const NEXT_COLORS = ['#ff7a00', '#ffb21e', '#46a83f', '#1f2a44']

/**
 * Profildeki marka kiti kartı: marka adı, site adresi, renkler, yazı tipi ve logo bir kez kaydedilir; editörde
 * "Marka kitini uygula" ile açık projeye geçer. Planında yoksa (ücretsiz, Starter) kilitli tanıtım ve yükseltme bağlantısı.
 */
export function BrandKitCard() {
  const { t } = useTranslation()
  const { plan } = usePlan()
  const saved = useBrandKitStore((s) => s.kit)
  const [kit, setKit] = useState<BrandKit>(saved)
  const [logoUrl, setLogoUrl] = useState<string>()
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed' | 'uploading'>('idle')
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (plan.brandKit) void useBrandKitStore.getState().load()
  }, [plan.brandKit])
  // Sunucudan gelen kit forma yazılır (kayıttan sonra da aynı değer döner).
  useEffect(() => setKit(saved), [saved])
  useEffect(() => {
    let alive = true
    void resolveAssetUrl(kit.logo).then((url) => alive && setLogoUrl(url))
    return () => {
      alive = false
    }
  }, [kit.logo])

  const head = (
    <div className="profile-card-head">
      <h3>
        <Palette size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('brandKit.title')}
      </h3>
      {!plan.brandKit && (
        <a className="button-primary" href={routeToPath({ screen: 'pricing' })}>
          {t('profile.upgrade')}
        </a>
      )}
    </div>
  )

  if (!plan.brandKit) {
    return (
      <section className="profile-card">
        {head}
        <p className="hint">{t('brandKit.locked')}</p>
      </section>
    )
  }

  const change = (patch: Partial<BrandKit>) => {
    setKit((k) => ({ ...k, ...patch }))
    setStatus('idle')
  }
  const setColor = (index: number, color: string) => change({ colors: kit.colors.map((c, i) => (i === index ? color : c)) })

  const upload = async (picked: File | undefined) => {
    if (!picked) return
    setStatus('uploading')
    try {
      const meta = await storeFile(picked, 'image')
      change({ logo: assetRef(meta.id) })
    } catch {
      setStatus('failed')
    }
  }

  const save = async () => {
    setStatus('saving')
    setStatus((await useBrandKitStore.getState().save(kit)) ? 'saved' : 'failed')
  }

  return (
    <section className="profile-card brand-kit">
      {head}
      <p className="hint">{t('brandKit.lead')}</p>
      <div className="brand-kit-grid">
        <label>
          {t('brandKit.name')}
          <input value={kit.name} maxLength={60} placeholder="Acme" onChange={(e) => change({ name: e.target.value })} />
        </label>
        <label>
          {t('brandKit.website')}
          <input value={kit.website} maxLength={80} placeholder="acme.com" onChange={(e) => change({ website: e.target.value })} />
        </label>
        <label>
          {t('brandKit.font')}
          <select value={kit.fontFamily ?? ''} onChange={(e) => change({ fontFamily: e.target.value || undefined })}>
            <option value="">{t('brandKit.fontKeep')}</option>
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="brand-kit-row">
        <span className="brand-kit-label">{t('brandKit.colors')}</span>
        <div className="brand-kit-colors">
          {kit.colors.map((color, i) => (
            <span key={i} className="brand-kit-color">
              <input type="color" value={color} aria-label={t('brandKit.color', { index: i + 1 })} onChange={(e) => setColor(i, e.target.value)} />
              <button type="button" aria-label={t('brandKit.removeColor', { index: i + 1 })} onClick={() => change({ colors: kit.colors.filter((_, j) => j !== i) })}>
                <X size={11} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
          {kit.colors.length < MAX_BRAND_COLORS && (
            <button type="button" className="brand-kit-add" onClick={() => change({ colors: [...kit.colors, NEXT_COLORS[kit.colors.length] ?? '#ff7a00'] })}>
              <Plus size={13} strokeWidth={2} aria-hidden="true" />
              {t('brandKit.addColor')}
            </button>
          )}
        </div>
      </div>

      <div className="brand-kit-row">
        <span className="brand-kit-label">{t('brandKit.logo')}</span>
        <div className="brand-kit-logo">
          {logoUrl && <img src={logoUrl} alt="" />}
          <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => void upload(e.target.files?.[0])} />
          <button type="button" onClick={() => file.current?.click()} disabled={status === 'uploading'}>
            <Upload size={13} strokeWidth={1.75} aria-hidden="true" />
            {t(kit.logo ? 'brandKit.replaceLogo' : 'brandKit.uploadLogo')}
          </button>
          {kit.logo && (
            <button type="button" onClick={() => change({ logo: undefined })}>
              {t('brandKit.removeLogo')}
            </button>
          )}
        </div>
      </div>

      <div className="profile-row">
        <span role="status">{status === 'saved' ? t('brandKit.saved') : status === 'failed' ? t('brandKit.failed') : t('brandKit.applyHint')}</span>
        <button type="button" className="button-primary" disabled={status === 'saving' || status === 'uploading'} onClick={() => void save()}>
          {t('brandKit.save')}
        </button>
      </div>
    </section>
  )
}
