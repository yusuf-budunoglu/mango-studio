import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { exportVideo } from '../export/exportVideo'
import { useProjectStore } from '../store/projectStore'

type Status = { kind: 'idle' } | { kind: 'running'; progress: number } | { kind: 'error'; message: string }

export function ExportButton({ beforeExport }: { beforeExport: () => void }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const run = async () => {
    beforeExport()
    setStatus({ kind: 'running', progress: 0 })
    try {
      const project = useProjectStore.getState().project
      const blob = await exportVideo(project, (progress) => setStatus({ kind: 'running', progress }))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${project.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'video'}.mp4`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
      ;(window as unknown as { __lastExportSize?: number }).__lastExportSize = blob.size
      setStatus({ kind: 'idle' })
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <div className="export">
      <button type="button" className="primary" onClick={run} disabled={status.kind === 'running'}>
        {status.kind === 'running' ? t('exportVideo.progress', { percent: Math.round(status.progress * 100) }) : t('exportVideo.button')}
      </button>
      {status.kind === 'error' && <span className="export-error">{status.message}</span>}
    </div>
  )
}
