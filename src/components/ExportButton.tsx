import { Download } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_EXPORT, ExportCanceledError, exportSize, exportVideo, type ExportOptions } from '../export/exportVideo'
import { safeFileName } from '../persistence/thumbnail'
import { useProjectStore } from '../store/projectStore'

type Status = { kind: 'idle' } | { kind: 'running'; progress: number } | { kind: 'error'; message: string }

const OPTIONS_KEY = 'motion-studio.export-options'

function readOptions(): ExportOptions {
  try {
    return { ...DEFAULT_EXPORT, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_EXPORT
  }
}

/** "Dışa aktar" düğmesi ve seçenek penceresi: çözünürlük, kare hızı, format; ilerleme ve iptal. */
export function ExportButton({ beforeExport }: { beforeExport: () => void }) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const [open, setOpen] = useState(false)
  // 60 kare/sn tasarlanmış projeler (ör. sinematik şablonlar) varsayılan olarak 60'ta çıksın.
  const [options, setOptions] = useState<ExportOptions>(() => {
    const saved = readOptions()
    return project.fps === 60 ? { ...saved, fps: 60 } : saved
  })
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const popover = useRef<HTMLDivElement>(null)
  const size = exportSize(project, options.resolution)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (status.kind !== 'running' && !popover.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open, status.kind])

  const choose = (patch: Partial<ExportOptions>) => {
    const next = { ...options, ...patch }
    setOptions(next)
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify(next))
    } catch {
      // tercih hatırlanamasa da bu seferlik geçerli
    }
  }

  const run = async () => {
    beforeExport()
    abort.current = new AbortController()
    setStatus({ kind: 'running', progress: 0 })
    try {
      const current = useProjectStore.getState().project
      const blob = await exportVideo(current, options, (progress) => setStatus({ kind: 'running', progress }), abort.current.signal)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFileName(current.name)}.${options.container}`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      setStatus({ kind: 'idle' })
      setOpen(false)
    } catch (err) {
      if (err instanceof ExportCanceledError) setStatus({ kind: 'idle' })
      else setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      abort.current = null
    }
  }

  return (
    <div className="export" ref={popover}>
      <button type="button" className="primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Download size={14} strokeWidth={2} aria-hidden="true" />
        {status.kind === 'running' ? t('exportVideo.progress', { percent: Math.round(status.progress * 100) }) : t('exportVideo.button')}
      </button>
      {open && (
        <div className="export-popover" role="dialog" aria-label={t('exportVideo.title')}>
          <h3>{t('exportVideo.title')}</h3>
          <label htmlFor="export-resolution">{t('exportVideo.resolution')}</label>
          <select id="export-resolution" value={options.resolution} disabled={status.kind === 'running'} onChange={(e) => choose({ resolution: Number(e.target.value) as ExportOptions['resolution'] })}>
            <option value={720}>720p</option>
            <option value={1080}>1080p</option>
            <option value={2160}>4K</option>
          </select>
          <div className="row">
            <div>
              <label htmlFor="export-fps">{t('exportVideo.fps')}</label>
              <select id="export-fps" value={options.fps} disabled={status.kind === 'running'} onChange={(e) => choose({ fps: Number(e.target.value) as ExportOptions['fps'] })}>
                <option value={30}>30</option>
                <option value={60}>60</option>
              </select>
            </div>
            <div>
              <label htmlFor="export-container">{t('exportVideo.format')}</label>
              <select id="export-container" value={options.container} disabled={status.kind === 'running'} onChange={(e) => choose({ container: e.target.value as ExportOptions['container'] })}>
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </div>
          </div>
          <p className="hint">{t('exportVideo.summary', { width: size.width, height: size.height, seconds: project.duration, audio: project.audio?.length ? t('exportVideo.withAudio') : t('exportVideo.noAudio') })}</p>
          {status.kind === 'running' ? (
            <>
              <div className="export-progress" role="progressbar" aria-valuenow={Math.round(status.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${status.progress * 100}%` }} />
              </div>
              <button type="button" onClick={() => abort.current?.abort()}>
                {t('common.cancel')}
              </button>
            </>
          ) : (
            <button type="button" className="primary" onClick={() => void run()}>
              {t('exportVideo.start')}
            </button>
          )}
          {status.kind === 'error' && <p className="export-error">{status.message}</p>}
        </div>
      )}
    </div>
  )
}
