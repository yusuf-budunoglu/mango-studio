import { useTranslation } from 'react-i18next'
import type { AudioClip } from '../engine/types'
import { useProjectStore } from '../store/projectStore'

/** Seçili ses parçasının ayarları. */
export function AudioPanel({ clip }: { clip: AudioClip }) {
  const { t } = useTranslation()
  const update = (patch: Partial<AudioClip>) => useProjectStore.getState().updateAudioClip(clip.id, patch)
  const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Number(v) || 0))

  return (
    <section>
      <h2>{t('audio.title')}</h2>
      <label htmlFor="audio-name">{t('layer.name')}</label>
      <input id="audio-name" value={clip.name} onChange={(e) => update({ name: e.target.value })} />
      <label htmlFor="audio-volume">
        {t('audio.volume')} · {Math.round(clip.volume * 100)}%
      </label>
      <input id="audio-volume" type="range" min={0} max={1} step={0.01} value={clip.volume} onChange={(e) => update({ volume: Number(e.target.value) })} />
      <div className="row">
        <div>
          <label htmlFor="audio-fade-in">{t('audio.fadeIn')}</label>
          <input id="audio-fade-in" type="number" step={0.1} min={0} value={clip.fadeIn} onChange={(e) => update({ fadeIn: num(e.target.value, 0, clip.duration / 2) })} />
        </div>
        <div>
          <label htmlFor="audio-fade-out">{t('audio.fadeOut')}</label>
          <input id="audio-fade-out" type="number" step={0.1} min={0} value={clip.fadeOut} onChange={(e) => update({ fadeOut: num(e.target.value, 0, clip.duration / 2) })} />
        </div>
      </div>
      <p className="hint">{t('audio.meta', { start: clip.start.toFixed(2), duration: clip.duration.toFixed(2), source: clip.sourceDuration.toFixed(1) })}</p>
      <button type="button" className="danger" onClick={() => useProjectStore.getState().removeBlocks([clip.id])}>
        {t('audio.delete')}
      </button>
    </section>
  )
}
