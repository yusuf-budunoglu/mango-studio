import { ArrowLeftRight, Box, Film, Image, Laptop, Music, PenTool, Smartphone, Sparkles, Tablet, Type, Upload, Video, type LucideIcon } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { readAudioDuration } from '../audio/engine'
import { PRESETS } from '../engine/presets'
import type { Layer, LayerKind } from '../engine/types'
import { presetLabel } from '../i18n/labels'
import { assetRef, assets } from '../persistence/assets'
import { useEditorStore, type LibraryTab } from '../store/editorStore'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

const TABS: { id: LibraryTab; icon: LucideIcon }[] = [
  { id: 'text', icon: Type },
  { id: 'devices', icon: Smartphone },
  { id: 'media', icon: Image },
  { id: 'shapes', icon: Box },
  { id: 'audio', icon: Music },
  { id: 'effects', icon: Sparkles },
  { id: 'transitions', icon: ArrowLeftRight },
  { id: 'camera', icon: Video },
]

interface LayerItem {
  id: string
  kind: LayerKind
  icon: LucideIcon
  patch?: Partial<Layer>
  /** eklendikten sonra verilecek ek animasyon (ör. sayaç) */
  preset?: string
}

/** Metin hazırları: aynı metin katmanı, farklı boyut ve kalınlıkta. */
const TEXT_ITEMS: LayerItem[] = [
  { id: 'title', kind: 'text', icon: Type, patch: { fontSize: 0.75, fontWeight: 700 } },
  { id: 'subtitle', kind: 'text', icon: Type, patch: { fontSize: 0.42 } },
  { id: 'body', kind: 'text', icon: Type, patch: { fontSize: 0.26, textWidth: 6, lineHeight: 1.4 } },
  { id: 'counter', kind: 'text', icon: Type, patch: { text: '0', fontSize: 0.9, fontWeight: 700 }, preset: 'count-up' },
]
const DEVICE_ITEMS: LayerItem[] = [
  { id: 'phone', kind: 'phone', icon: Smartphone },
  { id: 'tablet', kind: 'tablet', icon: Tablet },
  { id: 'laptop', kind: 'laptop', icon: Laptop },
]
const MEDIA_ITEMS: LayerItem[] = [
  { id: 'image', kind: 'image', icon: Image },
  { id: 'video', kind: 'video', icon: Film },
  { id: 'svg', kind: 'svg', icon: PenTool },
]
const SHAPE_ITEMS: LayerItem[] = (['rounded', 'rect', 'circle', 'cube'] as const).map((shape) => ({
  id: shape,
  kind: 'shape',
  icon: Box,
  patch: { shape, ...(shape === 'circle' && { shapeWidth: 1.2, shapeHeight: 1.2 }), ...(shape === 'cube' && { shapeWidth: 1, shapeHeight: 1 }) },
}))

/** Kamera satırına eklenen hazırlar. */
const CAMERA_PRESETS: Record<'effects' | 'transitions' | 'camera', string[]> = {
  effects: ['lens-punch', 'flare-sweep', 'light-leak', 'camera-shake'],
  transitions: ['fade-black', 'fade-white', 'flash'],
  camera: ['camera-push', 'camera-pull', 'camera-orbit', 'camera-pan', 'focus-pull'],
}

const playhead = () => +usePlaybackStore.getState().time.toFixed(2)

function addLayerItem(item: LayerItem, label: string) {
  const store = useProjectStore.getState()
  const id = store.addLayer(item.kind, playhead())
  const patch: Partial<Layer> = { ...item.patch }
  // Metin hazırlarında katmanın adı ve örnek metni hazırın adı olur.
  if (item.kind === 'text') {
    patch.name = label
    patch.text ??= label
  }
  store.updateLayer(id, patch)
  if (item.preset) store.addBlock(id, item.preset, playhead())
  store.selectBlock(null)
}

function LayerCards({ group, items }: { group: string; items: LayerItem[] }) {
  const { t } = useTranslation()
  return (
    <div className="lib-grid">
      {items.map((item) => {
        const label = t(`library.${group}.${item.id}`)
        const Icon = item.icon
        return (
          <button key={item.id} type="button" className={`lib-card lib-card--${group}-${item.id}`} onClick={() => addLayerItem(item, label)}>
            <span className="lib-art" aria-hidden="true">
              {group === 'text' ? <span className={`lib-text-sample lib-text-sample--${item.id}`}>{item.id === 'counter' ? '1,234' : 'Aa'}</span> : <Icon size={28} strokeWidth={1.5} />}
            </span>
            <span className="lib-label">{label}</span>
          </button>
        )
      })}
    </div>
  )
}

function PresetCards({ ids }: { ids: string[] }) {
  useTranslation()
  return (
    <div className="lib-grid">
      {ids.map((id) => (
        <button key={id} type="button" className="lib-card" onClick={() => useProjectStore.getState().addBlock('camera', id, playhead())}>
          <span className={`lib-art lib-art--${PRESETS[id]?.category}`} aria-hidden="true">
            <Sparkles size={22} strokeWidth={1.5} />
          </span>
          <span className="lib-label">{presetLabel(id)}</span>
        </button>
      ))}
    </div>
  )
}

function AudioUpload() {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  // Ses dosyası: süresini oku, depoya koy, oynatma kafasına parça olarak ekle.
  const addAudio = async (file: File) => {
    const duration = await readAudioDuration(file)
    const meta = await assets.put(file, { name: file.name, kind: 'audio', duration })
    useProjectStore.getState().addAudioClip(assetRef(meta.id), file.name.replace(/\.[^.]+$/, ''), duration, playhead())
  }
  return (
    <>
      <button type="button" className="lib-upload" onClick={() => input.current?.click()}>
        <Upload size={16} strokeWidth={1.75} /> {t('library.audio.upload')}
      </button>
      <input
        ref={input}
        id="audio-file"
        type="file"
        accept="audio/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void addAudio(file)
          e.target.value = ''
        }}
      />
    </>
  )
}

/** Sol panel: eklenebilecek her şey. Tıklanan öğe oynatma kafasına eklenir. */
export function LibraryPanel() {
  const { t } = useTranslation()
  const tab = useEditorStore((s) => s.libraryTab)
  const setTab = useEditorStore((s) => s.setLibraryTab)

  const body = (() => {
    switch (tab) {
      case 'text':
        return <LayerCards group="text" items={TEXT_ITEMS} />
      case 'devices':
        return <LayerCards group="devices" items={DEVICE_ITEMS} />
      case 'media':
        return <LayerCards group="media" items={MEDIA_ITEMS} />
      case 'shapes':
        return <LayerCards group="shapes" items={SHAPE_ITEMS} />
      case 'audio':
        return <AudioUpload />
      case 'effects':
        return (
          <>
            <PresetCards ids={CAMERA_PRESETS.effects} />
            <button
              type="button"
              className="lib-link"
              onClick={() => {
                const store = useProjectStore.getState()
                store.selectBlock(null)
                store.selectTrack('')
                useEditorStore.getState().setProjectTab('effects')
              }}
            >
              {t('library.effects.global')}
            </button>
          </>
        )
      default:
        return <PresetCards ids={CAMERA_PRESETS[tab]} />
    }
  })()

  return (
    <aside className="library">
      <nav className="lib-tabs" role="tablist" aria-label={t('library.label')}>
        {TABS.map(({ id, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
            <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>{t(`library.tabs.${id}`)}</span>
          </button>
        ))}
      </nav>
      <div className="lib-body">
        <h2>{t(`library.tabs.${tab}`)}</h2>
        <p className="hint">{t(`library.hints.${tab}`)}</p>
        {body}
      </div>
    </aside>
  )
}
