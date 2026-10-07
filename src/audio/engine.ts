import type { AudioClip, Project } from '../engine/types'
import { assetIdOf, assets, isAssetRef } from '../persistence/assets'
import { usePlaybackStore, useProjectStore } from '../store/projectStore'
import { computePeaks, planClip } from './schedule'

// ───────── Ses dosyalarını çözme ve önbellek ─────────

let sharedContext: AudioContext | null = null
function context(): AudioContext {
  sharedContext ??= new AudioContext()
  return sharedContext
}

const buffers = new Map<string, Promise<AudioBuffer | null>>()

/**
 * Ses dosyasını bir kez çözer. AudioBuffer her bağlamda kullanılabilir. Kaynak dosya deposundaki bir dosya
 * (`asset:<id>`) ya da bir adrestir: hazır şablonların ses efektleri sitenin kendi dosyalarıdır (`/templates/...`),
 * görseller ve cihaz videoları gibi adresle gelir.
 */
export function loadAudioBuffer(ref: string): Promise<AudioBuffer | null> {
  let buffer = buffers.get(ref)
  if (!buffer) {
    buffer = (async () => {
      const blob = isAssetRef(ref) ? await assets.getBlob(assetIdOf(ref)) : await fetch(ref).then((res) => (res.ok ? res.blob() : undefined), () => undefined)
      if (!blob) return null
      return context().decodeAudioData(await blob.arrayBuffer())
    })().catch(() => null)
    buffers.set(ref, buffer)
  }
  return buffer
}

/** Dosyanın süresini okur (yüklerken parçanın uzunluğu için). */
export async function readAudioDuration(blob: Blob): Promise<number> {
  const buffer = await context().decodeAudioData(await blob.arrayBuffer())
  return buffer.duration
}

const peaks = new Map<string, Promise<number[] | null>>()

/** Dalga görüntüsü için ~600 noktalık genlik listesi. */
export function loadPeaks(ref: string): Promise<number[] | null> {
  let p = peaks.get(ref)
  if (!p) {
    p = loadAudioBuffer(ref).then((b) => {
      if (!b) return null
      const channels = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i))
      return computePeaks(channels, 600)
    })
    peaks.set(ref, p)
  }
  return p
}

async function loadAll(clips: AudioClip[]) {
  const map = new Map<string, AudioBuffer>()
  await Promise.all(
    clips.map(async (c) => {
      const b = await loadAudioBuffer(c.asset)
      if (b) map.set(c.asset, b)
    }),
  )
  return map
}

/** Parçaları bir ses bağlamına yerleştirir. Önizleme ve dışa aktarma aynı fonksiyonu kullanır. */
function scheduleClips(ctx: BaseAudioContext, clips: AudioClip[], loaded: Map<string, AudioBuffer>, from: number, when: number) {
  const sources: AudioBufferSourceNode[] = []
  for (const clip of clips) {
    const plan = planClip(clip, from)
    const buffer = loaded.get(clip.asset)
    if (!plan || !buffer) continue
    const source = ctx.createBufferSource()
    source.buffer = buffer
    const gain = ctx.createGain()
    const t0 = when + plan.delay
    gain.gain.setValueAtTime(plan.envelope[0]?.gain ?? clip.volume, t0)
    for (const point of plan.envelope.slice(1)) gain.gain.linearRampToValueAtTime(point.gain, t0 + point.at)
    source.connect(gain).connect(ctx.destination)
    source.start(t0, plan.sourceOffset, plan.length)
    sources.push(source)
  }
  return sources
}

// ───────── Video çıktısı için karışım ─────────

/** Tüm ses parçalarını videonun süresi boyunca tek bir stereo parçada karıştırır; ses yoksa null. */
export async function renderAudioMix(project: Project, sampleRate = 48_000): Promise<AudioBuffer | null> {
  const clips = project.audio ?? []
  if (!clips.length) return null
  const ctx = new OfflineAudioContext(2, Math.ceil(project.duration * sampleRate), sampleRate)
  scheduleClips(ctx, clips, await loadAll(clips), 0, 0)
  return ctx.startRendering()
}

// ───────── Önizleme ─────────

/**
 * Timeline oynarken sesi çalar. Oynatma başlayınca/durunca ve oynarken zaman atlayınca
 * (başa sarma, tıklayıp gitme) parçaları yeniden yerleştirir.
 */
class AudioPreview {
  private sources: AudioBufferSourceNode[] = []
  private anchor: { ctxTime: number; projectTime: number } | null = null
  private token = 0

  get activeSources() {
    return this.sources.length
  }

  stop() {
    this.token++
    for (const s of this.sources) {
      try {
        s.stop()
      } catch {
        // zaten bitmiş olabilir
      }
    }
    this.sources = []
    this.anchor = null
  }

  async play() {
    this.stop()
    const token = this.token
    const clips = useProjectStore.getState().project.audio ?? []
    if (!clips.length) return
    const ctx = context()
    if (ctx.state === 'suspended') await ctx.resume()
    const loaded = await loadAll(clips)
    const playback = usePlaybackStore.getState()
    if (token !== this.token || !playback.isPlaying) return
    const from = playback.time
    this.anchor = { ctxTime: ctx.currentTime, projectTime: from }
    this.sources = scheduleClips(ctx, clips, loaded, from, ctx.currentTime)
  }

  /** Oynarken zaman beklenenden sapmışsa (kullanıcı başka yere gitti) yeniden başlat. */
  checkDrift(time: number) {
    if (!this.anchor || !sharedContext) return
    const expected = this.anchor.projectTime + (sharedContext.currentTime - this.anchor.ctxTime)
    if (Math.abs(time - expected) > 0.3) void this.play()
  }
}

export const audioPreview = new AudioPreview()

/** Editör açıkken sesi oynatmaya bağlar; kapatma fonksiyonu döndürür. */
export function attachAudioPreview() {
  const offPlayback = usePlaybackStore.subscribe((s, prev) => {
    if (s.isPlaying !== prev.isPlaying) {
      if (s.isPlaying) void audioPreview.play()
      else audioPreview.stop()
    } else if (s.isPlaying && s.time !== prev.time) {
      audioPreview.checkDrift(s.time)
    }
  })
  const offProject = useProjectStore.subscribe((s, prev) => {
    if (s.project.audio !== prev.project.audio && usePlaybackStore.getState().isPlaying) void audioPreview.play()
  })
  if (import.meta.env.DEV) Object.assign(window, { __audio: audioPreview })
  return () => {
    offPlayback()
    offProject()
    audioPreview.stop()
  }
}
