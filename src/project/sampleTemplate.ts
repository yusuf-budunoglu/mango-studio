import { b, camera, layer, project, type Template } from './templates'

/**
 * Yalnızca testler için basit örnek proje (kütüphanede görünmez): logo, daktilo başlık, sayaç ve
 * dönerek giren telefon. Katman sırası ve blokları testlerin beklentisi; değiştirirken testlere bak.
 */
export const SAMPLE_TEMPLATE: Template = {
  id: 'sample',
  format: '16:9',
  seconds: 8,
  accent: '#6c5ce7',
  tags: [],
  build: () =>
    project(
      'Sample',
      8,
      '#0d1117',
      [
        layer({ name: 'Logo', kind: 'text', text: '◆ acme', color: '#8be9fd', fontSize: 0.35, position: [0, 1.9, 0], blocks: [b('fade-in', 0, 0.8), b('fade-out', 7.2, 0.6)] }),
        layer({ name: 'Title', kind: 'text', align: 'left', text: 'Make your videos in minutes', color: '#ffffff', fontSize: 0.42, position: [-4.6, 0.5, 0], blocks: [b('slide-up', 0.5, 1.1), b('typewriter', 0.5, 1.4)] }),
        layer({ name: 'Counter', kind: 'text', align: 'left', text: '0', color: '#ffb86c', fontSize: 0.6, position: [-4.6, -0.9, 0], blocks: [b('fade-in', 2.2, 0.4), b('count-up', 2.2, 1.8, { params: { from: 0, to: 10000 } })] }),
        layer({ name: 'Phone', kind: 'phone', color: '#6c5ce7', position: [2.8, -0.2, 0], rotation: [0, -18, 0], blocks: [b('rotate-in', 1.2, 1.4), b('float', 2.6, 5, { params: { amount: 0.1, cycles: 2 } })] }),
      ],
      camera([b('camera-push', 0, 8, { params: { distance: 2 } })]),
    ),
}
