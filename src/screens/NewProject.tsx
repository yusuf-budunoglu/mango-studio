import { ChevronLeft } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog } from '../components/Dialog'
import { createBlank } from '../project/actions'
import { routeToPath } from '../router'

type Mode = 'motion' | 'design'

/** Tasarım tuvali için hazır boyutlar (piksel). */
const SIZES = [
  { id: 'square', width: 1080, height: 1080 },
  { id: 'portrait', width: 1080, height: 1350 },
  { id: 'story', width: 1080, height: 1920 },
  { id: 'wide', width: 1920, height: 1080 },
] as const
const MIN_SIZE = 64
const MAX_SIZE = 4096

interface Option {
  /** `newProject.<key>` altındaki metinler: title, sub, p1–p3, action */
  key: string
  primary?: boolean
  href?: string
  onClick?: () => void
  soon?: boolean
}

function OptionCard({ option }: { option: Option }) {
  const { t } = useTranslation()
  const k = (field: string) => t(`newProject.${option.key}.${field}`)
  const className = `np-action${option.primary ? ' is-primary' : ''}`
  return (
    <section className="np-option">
      <header>
        <h2>
          {k('title')}
          {option.soon && <span className="nav-badge">{t('nav.soon')}</span>}
        </h2>
        <p>{k('sub')}</p>
      </header>
      <ul>
        <li>{k('p1')}</li>
        <li>{k('p2')}</li>
        <li>{k('p3')}</li>
      </ul>
      {option.href ? (
        <a className={className} href={option.href}>
          {k('action')}
        </a>
      ) : (
        <button type="button" className={className} onClick={option.onClick}>
          {k('action')}
        </button>
      )}
    </section>
  )
}

/** Tasarım tuvalinin boyutunu seçtiren pencere: hazır boyutlar ya da özel genişlik/yükseklik. */
function SizeDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (width: number, height: number) => void }) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<string>('square')
  const [custom, setCustom] = useState({ width: '1200', height: '630' })
  const preset = SIZES.find((s) => s.id === choice)
  const width = preset ? preset.width : Number(custom.width)
  const height = preset ? preset.height : Number(custom.height)
  const valid = [width, height].every((v) => Number.isInteger(v) && v >= MIN_SIZE && v <= MAX_SIZE)

  return (
    <Dialog title={t('newProject.sizes.title')} onClose={onClose}>
      <form
        className="modal-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onCreate(width, height)
        }}
      >
        <div className="np-sizes" role="radiogroup" aria-label={t('newProject.sizes.title')}>
          {[...SIZES, { id: 'custom', width: 0, height: 0 }].map((s) => (
            <label key={s.id} className={`np-size${choice === s.id ? ' is-active' : ''}`}>
              <input type="radio" name="size" value={s.id} checked={choice === s.id} onChange={() => setChoice(s.id)} />
              <span
                className="np-size-shape"
                aria-hidden="true"
                style={s.width ? { aspectRatio: `${s.width} / ${s.height}` } : { aspectRatio: '1', borderStyle: 'dashed' }}
              />
              <strong>{t(`newProject.sizes.${s.id}`)}</strong>
              {s.width > 0 && (
                <span>
                  {s.width} × {s.height}
                </span>
              )}
            </label>
          ))}
        </div>
        {choice === 'custom' && (
          <div className="np-custom">
            <label>
              {t('newProject.sizes.width')}
              <input type="number" inputMode="numeric" min={MIN_SIZE} max={MAX_SIZE} value={custom.width} onChange={(e) => setCustom((c) => ({ ...c, width: e.target.value }))} />
            </label>
            <span aria-hidden="true">×</span>
            <label>
              {t('newProject.sizes.height')}
              <input type="number" inputMode="numeric" min={MIN_SIZE} max={MAX_SIZE} value={custom.height} onChange={(e) => setCustom((c) => ({ ...c, height: e.target.value }))} />
            </label>
          </div>
        )}
        {!valid && <p className="np-invalid">{t('newProject.sizes.invalid', { min: MIN_SIZE, max: MAX_SIZE })}</p>}
        <div className="modal-actions">
          <button type="button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="primary" disabled={!valid}>
            {t('newProject.sizes.create')}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** Yeni proje başlatma: hareket (video) ya da tasarım (sabit boyutlu tuval). */
export function NewProject({ folderId }: { folderId?: string }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('motion')
  const [sizing, setSizing] = useState(false)

  const motion: Option[] = [
    // Otomatik video henüz yok: birincil düğme çalışan yola (şablonlar) verildi.
    { key: 'auto', soon: true, href: routeToPath({ screen: 'soon', feature: 'auto-video' }) },
    { key: 'template', primary: true, href: routeToPath({ screen: 'templates' }) },
    { key: 'blank', onClick: () => void createBlank({ name: t('newProject.blankName'), folderId }) },
  ]
  const design: Option[] = [
    { key: 'designBlank', primary: true, onClick: () => setSizing(true) },
    { key: 'fromMotion', href: routeToPath({ screen: 'studio', folderId }) },
  ]
  const options = mode === 'motion' ? motion : design

  return (
    <div className="np">
      <a className="np-back" href={routeToPath({ screen: 'studio', folderId })}>
        <ChevronLeft size={15} strokeWidth={1.75} aria-hidden="true" />
        {t('newProject.back')}
      </a>
      <main className="np-main">
        <header className="np-head">
          <h1>{t('newProject.title')}</h1>
          <p>{t('newProject.subtitle')}</p>
        </header>
        <div className="np-modes" role="tablist" aria-label={t('newProject.title')}>
          {(['motion', 'design'] as const).map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? 'is-active' : ''} onClick={() => setMode(m)}>
              {t(`newProject.modes.${m}`)}
            </button>
          ))}
        </div>
        <div className={`np-options np-options--${options.length}`} role="tabpanel">
          {options.map((option) => (
            <OptionCard key={option.key} option={option} />
          ))}
        </div>
      </main>
      {sizing && (
        <SizeDialog
          onClose={() => setSizing(false)}
          onCreate={(width, height) => void createBlank({ name: t('newProject.designName'), width, height, mode: 'design', folderId })}
        />
      )}
    </div>
  )
}
