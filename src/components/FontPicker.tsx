import { Check, ChevronDown, Star, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FONT_EXTENSIONS, assetRef, assets, type AssetMeta } from '../persistence/assets'
import { storeFile } from '../persistence/storeFile'
import { useFontFace } from '../render/fontFaces'
import { DEFAULT_FONT, FONT_CATEGORIES, FONTS, preferredFont, setPreferredFont } from '../render/fonts'
import { matchesSearch } from '../store/uiStore'

interface Option {
  id: string
  label: string
}

const fileLabel = (name: string) => name.replace(/\.(ttf|otf|woff)$/i, '').replace(/[-_]+/g, ' ')

/** Fontun adı, kendi yazı tipiyle. */
function FontLabel({ fontId, label }: { fontId: string; label: string }) {
  const family = useFontFace(fontId)
  return <span style={family ? { fontFamily: `'${family}', sans-serif` } : { opacity: 0.55 }}>{label}</span>
}

function FontRow({ option, selected, isDefault, onPick, onDefault }: { option: Option; selected: boolean; isDefault: boolean; onPick: () => void; onDefault: () => void }) {
  const { t } = useTranslation()
  return (
    <li className={`font-row${selected ? ' is-on' : ''}`}>
      <button type="button" className="font-row-pick" role="option" aria-selected={selected} onClick={onPick}>
        <span className="font-row-check">{selected && <Check size={13} strokeWidth={2} aria-hidden="true" />}</span>
        <FontLabel fontId={option.id} label={option.label} />
      </button>
      <button
        type="button"
        className={`font-row-default${isDefault ? ' is-on' : ''}`}
        title={isDefault ? t('fontPicker.isDefault') : t('fontPicker.setDefault')}
        aria-label={isDefault ? t('fontPicker.isDefault') : t('fontPicker.setDefault')}
        aria-pressed={isDefault}
        onClick={onDefault}
      >
        <Star size={13} strokeWidth={1.75} fill={isDefault ? 'currentColor' : 'none'} aria-hidden="true" />
      </button>
    </li>
  )
}

/**
 * Metin fontu seçici: her font kendi yazı tipiyle önizlenir. Kategorilere ayrılmış hazır fontlar,
 * kullanıcının yüklediği fontlar (.ttf/.otf/.woff), arama ve "yeni metinlerde varsayılan" yıldızı.
 */
export function FontPicker({ id, value, onChange }: { id: string; value: string | undefined; onChange: (fontId: string) => void }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [uploaded, setUploaded] = useState<AssetMeta[]>([])
  const [defaultFont, setDefaultFont] = useState(preferredFont)
  const root = useRef<HTMLDivElement>(null)
  const current = value ?? DEFAULT_FONT

  const refresh = () => assets.list().then((all) => setUploaded(all.filter((a) => a.kind === 'font')))
  useEffect(() => {
    void assets.list().then((all) => setUploaded(all.filter((a) => a.kind === 'font')))
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const uploadedOptions: Option[] = uploaded.map((a) => ({ id: assetRef(a.id), label: fileLabel(a.name) }))
  const all: Option[] = [...uploadedOptions, ...FONTS]
  const currentLabel = all.find((o) => o.id === current)?.label ?? FONTS[0].label
  const filter = (options: Option[]) => options.filter((o) => matchesSearch(o.label, query))

  const pick = (fontId: string) => {
    onChange(fontId)
    setOpen(false)
  }
  const makeDefault = (fontId: string) => {
    setPreferredFont(fontId)
    setDefaultFont(fontId)
  }
  const row = (option: Option) => (
    <FontRow key={option.id} option={option} selected={option.id === current} isDefault={option.id === defaultFont} onPick={() => pick(option.id)} onDefault={() => makeDefault(option.id)} />
  )

  const groups = [
    { key: 'uploaded', title: t('fontPicker.uploaded'), options: filter(uploadedOptions) },
    ...FONT_CATEGORIES.map((c) => ({ key: c, title: t(`fontPicker.categories.${c}`), options: filter(FONTS.filter((f) => f.category === c)) })),
  ].filter((g) => g.options.length > 0)

  return (
    <div className="font-picker" ref={root}>
      <button id={id} type="button" className="font-picker-button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <FontLabel fontId={current} label={currentLabel} />
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div className="font-picker-pop">
          <input className="font-picker-search" type="search" placeholder={t('fontPicker.search')} aria-label={t('fontPicker.search')} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          <div className="font-picker-list" role="listbox" aria-labelledby={id}>
            {groups.map((g) => (
              <section key={g.key}>
                <h4>{g.title}</h4>
                <ul>{g.options.map(row)}</ul>
              </section>
            ))}
            {groups.length === 0 && <p className="hint">{t('fontPicker.noResults')}</p>}
          </div>
          <label className="font-picker-upload" htmlFor={`${id}-file`}>
            <Upload size={13} strokeWidth={1.75} aria-hidden="true" /> {t('fontPicker.upload')}
          </label>
          <input
            id={`${id}-file`}
            type="file"
            accept={FONT_EXTENSIONS.join(',')}
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file) return
              const meta = await storeFile(file, 'font')
              await refresh()
              pick(assetRef(meta.id))
            }}
          />
        </div>
      )}
    </div>
  )
}
