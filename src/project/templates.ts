import { newId } from '../engine/ids'
import i18n, { currentNumberLocale } from '../i18n'
import type { Block, CameraTrack, Layer, Project } from '../engine/types'

// Tüm şablonlar sıfırdan, sadece metin/şekil/telefon katmanlarıyla yapıldı; dış asset yok.
// Metinler ve katman adları, proje oluşturulduğu andaki arayüz dilinde üretilir.

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options)

type BlockSpec = Omit<Block, 'id'>
type LayerSpec = Omit<Layer, 'id' | 'blocks' | 'rotation' | 'scale' | 'opacity'> &
  Partial<Pick<Layer, 'rotation' | 'scale' | 'opacity'>> & { blocks: BlockSpec[] }

const b = (preset: string, start: number, duration: number, extra: Partial<BlockSpec> = {}): BlockSpec => ({
  preset,
  start,
  duration,
  ...extra,
})

function layer(spec: LayerSpec): Layer {
  return {
    rotation: [0, 0, 0],
    scale: 1,
    opacity: 1,
    ...spec,
    id: newId('l'),
    blocks: spec.blocks.map((block) => ({ ...block, id: newId('b') })),
  }
}

function camera(blocks: BlockSpec[], position: CameraTrack['position'] = [0, 0, 9]): CameraTrack {
  return { id: 'camera', name: t('layer.defaults.camera'), position, fov: 40, blocks: blocks.map((block) => ({ ...block, id: newId('b') })) }
}

function project(name: string, duration: number, background: string, layers: Layer[], cam: CameraTrack): Project {
  return { id: newId('p'), name, duration, fps: 30, width: 1920, height: 1080, background, numberLocale: currentNumberLocale(), layers, camera: cam }
}

export interface Template {
  id: string
  /** kütüphane kartında gösterilecek renk */
  accent: string
  build: () => Project
}

export const TEMPLATES: Template[] = [
  {
    id: 'app-launch',
    accent: '#6c5ce7',
    build: () =>
      project(
        t('templates.app-launch.name'),
        8,
        '#0d1117',
        [
          layer({ name: t('layerNames.logo'), kind: 'text', text: '◆ acme', color: '#8be9fd', fontSize: 0.35, position: [0, 1.9, 0], blocks: [b('fade-in', 0, 0.8), b('fade-out', 7.2, 0.6)] }),
          layer({ name: t('layerNames.title'), kind: 'text', align: 'left', text: t('templates.app-launch.title'), color: '#ffffff', fontSize: 0.42, position: [-4.6, 0.5, 0], blocks: [b('slide-up', 0.5, 1.1), b('typewriter', 0.5, 1.4)] }),
          layer({ name: t('layerNames.counter'), kind: 'text', align: 'left', text: '0', color: '#ffb86c', fontSize: 0.6, position: [-4.6, -0.9, 0], blocks: [b('fade-in', 2.2, 0.4), b('count-up', 2.2, 1.8, { params: { from: 0, to: 10000 } })] }),
          layer({ name: t('layerNames.phone'), kind: 'phone', color: '#6c5ce7', position: [2.8, -0.2, 0], rotation: [0, -18, 0], blocks: [b('rotate-in', 1.2, 1.4), b('float', 2.6, 5, { params: { amount: 0.1, cycles: 2 } })] }),
        ],
        camera([b('camera-push', 0, 8, { params: { distance: 2 } })]),
      ),
  },
  {
    id: 'feature-tour',
    accent: '#00b894',
    build: () =>
      project(
        t('templates.feature-tour.name'),
        9,
        '#0b1512',
        [
          layer({ name: t('layerNames.phone'), kind: 'phone', color: '#00b894', position: [2.2, 0, 0], rotation: [0, -12, 0], blocks: [b('scale-in', 0, 1), b('float', 1, 8, { params: { amount: 0.08, cycles: 3 } })] }),
          layer({ name: t('layerNames.feature', { n: 1 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature1'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 0.6, 0.8), b('fade-out', 2.8, 0.4)] }),
          layer({ name: t('layerNames.feature', { n: 2 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature2'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 3.2, 0.8), b('fade-out', 5.4, 0.4)] }),
          layer({ name: t('layerNames.feature', { n: 3 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature3'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 5.8, 0.8), b('scale-out', 8.4, 0.5)] }),
          layer({ name: t('layerNames.steps'), kind: 'text', align: 'left', text: '01 · 02 · 03', color: '#55efc4', fontSize: 0.22, position: [-4.8, 0.8, 0], blocks: [b('fade-in', 0.4, 0.6), b('fade-out', 8.4, 0.5)] }),
        ],
        camera([b('camera-orbit', 0, 9, { params: { angle: 18 } })]),
      ),
  },
  {
    id: 'stats',
    accent: '#fdcb6e',
    build: () => {
      const columns = [
        { x: -3.4, value: 250000, decimals: 0, label: t('templates.stats.users'), start: 0.4 },
        { x: 0, value: 4.9, decimals: 1, label: t('templates.stats.rating'), start: 1.0 },
        { x: 3.4, value: 120, decimals: 0, label: t('templates.stats.countries'), start: 1.6 },
      ]
      return project(
        t('templates.stats.name'),
        7,
        '#15120b',
        [
          layer({ name: t('layerNames.heading'), kind: 'text', text: t('templates.stats.heading'), color: '#fdcb6e', fontSize: 0.34, position: [0, 1.8, 0], blocks: [b('slide-down', 0, 0.8)] }),
          ...columns.flatMap((c, i) => [
            layer({ name: t('layerNames.number', { n: i + 1 }), kind: 'text', text: '0', color: '#ffffff', fontSize: 0.66, position: [c.x, 0.2, 0], blocks: [b('pop', c.start, 0.6), b('count-up', c.start, 1.8, { params: { from: 0, to: c.value, decimals: c.decimals ?? 0 } })] }),
            layer({ name: t('layerNames.label', { n: i + 1 }), kind: 'text', text: c.label, color: '#b2a98f', fontSize: 0.26, position: [c.x, -0.6, 0], blocks: [b('fade-in', c.start + 0.4, 0.6)] }),
          ]),
          layer({ name: t('layerNames.closing'), kind: 'text', text: t('templates.stats.closing'), color: '#fdcb6e', fontSize: 0.3, position: [0, -1.8, 0], blocks: [b('typewriter', 4.2, 1.2), b('fade-in', 4.2, 0.2)] }),
        ],
        camera([b('camera-pan', 0, 7, { params: { distance: 0.6 } }), b('camera-push', 0, 7, { params: { distance: 0.6 } })], [-0.3, 0, 9.4]),
      )
    },
  },
  {
    id: 'logo-reveal',
    accent: '#e17055',
    build: () =>
      project(
        t('templates.logo-reveal.name'),
        5,
        '#120b0a',
        [
          layer({ name: t('layerNames.cubeLeft'), kind: 'shape', color: '#e17055', position: [-2.7, 1.2, -1], scale: 0.6, blocks: [b('pop', 0.1, 0.6), b('spin', 0.1, 2.5), b('scale-out', 3.8, 0.5)] }),
          layer({ name: t('layerNames.cubeRight'), kind: 'shape', color: '#fab1a0', position: [2.7, -1.1, -1], scale: 0.45, blocks: [b('pop', 0.3, 0.6), b('spin', 0.3, 2.5), b('scale-out', 3.9, 0.5)] }),
          layer({ name: t('layerNames.logo'), kind: 'text', text: '◆ nova', color: '#ffffff', fontSize: 0.9, position: [0, 0.2, 0], blocks: [b('pop', 0.6, 0.9, { easing: 'spring-bouncy' })] }),
          layer({ name: t('layerNames.tagline'), kind: 'text', text: t('templates.logo-reveal.tagline'), color: '#fab1a0', fontSize: 0.3, position: [0, -0.7, 0], blocks: [b('typewriter', 1.6, 1), b('fade-in', 1.6, 0.2)] }),
        ],
        camera([b('camera-pull', 0.4, 4.6, { params: { distance: 1.5 } })], [0, 0, 7]),
      ),
  },
]

export const DEFAULT_TEMPLATE = TEMPLATES[0]

export const templateName = (id: string) => t(`templates.${id}.name`)
export const templateDescription = (id: string) => t(`templates.${id}.description`)
