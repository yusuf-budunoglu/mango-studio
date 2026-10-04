import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canScale, DEFAULT_IMAGE, exportImage, imageSize, type ImageOptions } from '../export/exportImage'
import { safeFileName } from '../persistence/thumbnail'
import { useProjectStore } from '../store/projectStore'

type Status = { kind: 'idle' } | { kind: 'running' } | { kind: 'error'; message: string }

const OPTIONS_KEY = 'motion-studio.image-options'
const SCALES = [1, 2] as const

function readOptions(): ImageOptions {
  try {
    return { ...DEFAULT_IMAGE, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_IMAGE
  }
}

/** Tasarım modunun "Dışa aktar" düğmesi: PNG ya da JPG, 1× (tasarım boyutu) veya 2×. */
export function ExportImageButton() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ImageOptions>(readOptions)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const popover = useRef<HTMLDivElement>(null)
  // 2× GPU sınırını aşıyorsa 1×'e düşer (kayıtlı tercih korunur)
  const scale = canScale(project, options.scale) ? options.scale : 1
  const size = imageSize(project, scale)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (status.kind !== 'running' && !popover.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open, status.kind])

  const choose = (patch: Partial<ImageOptions>) => {
    const next = { ...options, ...patch }
    setOptions(next)
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(next))
    } catch {
      // tercih hatırlanamasa da bu seferlik geçerli
    }
  }

  const run = async () => {
    setStatus({ kind: 'running' })
    try {
      const current = useProjectStore.getState().project
      const blob = await exportImage(current, { ...options, scale })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFileName(current.name)}${scale > 1 ? `@${scale}x` : ''}.${options.format}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setStatus({ kind: 'idle' })
      setOpen(false)
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="export" ref={popover}>
      <button type="button" className="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        {status.kind === 'running' ? t('exportImage.running') : t('exportImage.button')}
      </button>
      {open && (
        <div className="export-popover" role="dialog" aria-label={t('exportImage.title')}>
          <h3>{t('exportImage.title')}</h3>
          <div className="row">
            <div>
              <label htmlFor="image-format">{t('exportImage.format')}</label>
              <select id="image-format" value={options.format} disabled={status.kind === 'running'} onChange={(e) => choose({ format: e.target.value as ImageOptions['format'] })}>
                <option value="png">PNG</option>
                <option value="jpg">JPG</option>
              </select>
            </div>
            <div>
              <label htmlFor="image-scale">{t('exportImage.size')}</label>
              <select id="image-scale" value={scale} disabled={status.kind === 'running'} onChange={(e) => choose({ scale: Number(e.target.value) as ImageOptions['scale'] })}>
                {SCALES.map((s) => (
                  <option key={s} value={s} disabled={!canScale(project, s)}>
                    {s}× · {imageSize(project, s).width} × {imageSize(project, s).height}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="hint">{t(options.format === 'png' ? 'exportImage.pngHint' : 'exportImage.jpgHint', { width: size.width, height: size.height })}</p>
          <button type="button" className="primary" onClick={() => void run()} disabled={status.kind === 'running'}>
            {status.kind === 'running' ? t('exportImage.running') : t('exportImage.start', { format: options.format.toUpperCase() })}
          </button>
          {status.kind === 'error' && <p className="export-error">{status.message}</p>}
        </div>
      )}
    </div>
  )
}
