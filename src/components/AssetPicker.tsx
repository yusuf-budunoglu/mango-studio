import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assetIdOf, assetRef, assets, isAssetRef, type AssetKind, type AssetMeta } from '../persistence/assets'
import { storeFile } from '../persistence/storeFile'

const ACCEPT: Record<AssetKind, string> = { image: 'image/*', svg: '.svg,image/svg+xml', video: 'video/*', audio: 'audio/*' }

/**
 * Bir katmanın dosyası: kütüphaneden (dosya deposu) seç ya da yeni yükle.
 * Yüklenen dosya kütüphaneye de eklenir; Assets sayfasında görünür.
 */
export function AssetPicker({ id, label, kind, value, onChange }: { id: string; label: string; kind: AssetKind; value: string | undefined; onChange: (ref: string | undefined) => void }) {
  const { t } = useTranslation()
  const [library, setLibrary] = useState<AssetMeta[]>([])
  const refresh = () => assets.list().then((all) => setLibrary(all.filter((a) => a.kind === kind)))
  useEffect(() => {
    void assets.list().then((all) => setLibrary(all.filter((a) => a.kind === kind)))
  }, [kind])

  const selected = isAssetRef(value) ? assetIdOf(value) : value ? '__embedded' : ''

  return (
    <div className="asset-picker">
      <label htmlFor={`${id}-select`}>{label}</label>
      <select id={`${id}-select`} value={selected} onChange={(e) => onChange(e.target.value ? assetRef(e.target.value) : undefined)}>
        <option value="">{t('assets.none')}</option>
        {selected === '__embedded' && <option value="__embedded">{t('assets.embedded')}</option>}
        {library.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="asset-upload" htmlFor={`${id}-file`}>
        {t('assets.upload')}
      </label>
      <input
        id={`${id}-file`}
        type="file"
        accept={ACCEPT[kind]}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          const meta = await storeFile(file, kind)
          await refresh()
          onChange(assetRef(meta.id))
        }}
      />
    </div>
  )
}
