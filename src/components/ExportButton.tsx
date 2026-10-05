import { Download, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { logExport } from '../cloud/exportLog'
import { cheapestPlanFor, clampExport, RESOLUTION_LABEL, RESOLUTIONS, type Fps } from '../billing/plans'
import { DEFAULT_EXPORT, ExportCanceledError, exportSize, exportVideo, type ExportOptions } from '../export/exportVideo'
import { safeFileName } from '../persistence/thumbnail'
import { routeToPath } from '../router'
import { usePlan } from '../store/planStore'
import { useProjectStore } from '../store/projectStore'

type Status = { kind: 'idle' } | { kind: 'running'; progress: number } | { kind: 'error'; message: string }

const FPS_OPTIONS: Fps[] = [30, 60]
const OPTIONS_KEY = 'motion-studio.export-options'

function readOptions(): ExportOptions {
  try {
    return { ...DEFAULT_EXPORT, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') }
  } catch {
    return DEFAULT_EXPORT
  }
}

/**
 * "Dışa aktar" düğmesi ve seçenek penceresi: çözünürlük, kare hızı, format; ilerleme ve iptal.
 * Plan dışındaki çözünürlük ve kare hızları kilitli görünür; kayıtlı tercih plana indirilir.
 */
export function ExportButton({ beforeExport }: { beforeExport: () => void }) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const { plan } = usePlan()
  const [open, setOpen] = useState(false)
  // 60 kare/sn tasarlanmış projeler (ör. sinematik şablonlar) varsayılan olarak 60'ta çıksın.
  const [options, setOptions] = useState<ExportOptions>(() => {
    const saved = readOptions()
    return project.fps === 60 ? { ...saved, fps: 60 } : saved
  })
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const abort = useRef<AbortController | null>(null)
  const popover = useRef<HTMLDivElement>(null)
  // Kayıtlı tercih korunur (plan yükselince geri gelir); kullanılan ve gösterilen, planın izin verdiği.
  const effective = clampExport(plan, options)
  const size = exportSize(project, effective.resolution)
  const hasLocked = RESOLUTIONS.some((r) => !plan.resolutions.includes(r)) || FPS_OPTIONS.some((f) => !plan.fps.includes(f))
  const lockedLabel = (label: string, required: ReturnType<typeof cheapestPlanFor>) =>
    t('exportVideo.locked', { option: label, plan: t(`pricing.plans.${required.id}`) })

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
      const blob = await exportVideo(current, effective, (progress) => setStatus({ kind: 'running', progress }), abort.current.signal)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${safeFileName(current.name)}.${options.container}`
      a.click()
      logExport({ kind: 'video', format: options.container, ...exportSize(current, effective.resolution), fps: effective.fps, duration: current.duration })
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
          <select id="export-resolution" value={effective.resolution} disabled={status.kind === 'running'} onChange={(e) => choose({ resolution: Number(e.target.value) as ExportOptions['resolution'] })}>
            {RESOLUTIONS.map((r) => {
              const allowed = plan.resolutions.includes(r)
              return (
                <option key={r} value={r} disabled={!allowed}>
                  {allowed ? RESOLUTION_LABEL[r] : lockedLabel(RESOLUTION_LABEL[r], cheapestPlanFor({ resolution: r }))}
                </option>
              )
            })}
          </select>
          <div className="row">
            <div>
              <label htmlFor="export-fps">{t('exportVideo.fps')}</label>
              <select id="export-fps" value={effective.fps} disabled={status.kind === 'running'} onChange={(e) => choose({ fps: Number(e.target.value) as ExportOptions['fps'] })}>
                {FPS_OPTIONS.map((f) => {
                  const allowed = plan.fps.includes(f)
                  return (
                    <option key={f} value={f} disabled={!allowed}>
                      {allowed ? f : lockedLabel(String(f), cheapestPlanFor({ fps: f }))}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label htmlFor="export-container">{t('exportVideo.format')}</label>
              <select id="export-container" value={effective.container} disabled={status.kind === 'running'} onChange={(e) => choose({ container: e.target.value as ExportOptions['container'] })}>
                <option value="mp4">MP4</option>
                <option value="webm">WebM</option>
              </select>
            </div>
          </div>
          {hasLocked && (
            <a className="export-upgrade" href={routeToPath({ screen: 'pricing' })}>
              <Lock size={12} strokeWidth={2} aria-hidden="true" />
              {t('exportVideo.upgradeHint')}
            </a>
          )}
          <p className="hint">{t('exportVideo.summary', { width: size.width, height: size.height, seconds: Math.round(project.duration * 10) / 10, audio: project.audio?.length ? t('exportVideo.withAudio') : t('exportVideo.noAudio') })}</p>
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
