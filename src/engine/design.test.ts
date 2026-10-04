import { describe, expect, it } from 'vitest'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
import { TEMPLATES } from '../project/templates'
import { DESIGN_DURATION, freezeFrame } from './design'
import { displayText, evaluate } from './evaluate'
import type { Project } from './types'

/** Tasarımın 0. saniyesi, videonun `time` anıyla aynı görünmeli. */
function expectSameFrame(video: Project, time: number) {
  const design = freezeFrame(video, time, 'Design')
  const a = evaluate(video, time)
  const b = evaluate(design, 0)
  const visible = video.layers.filter((l) => a.layers[l.id].opacity > 0.001)
  expect(design.layers.map((l) => l.name)).toEqual(visible.map((l) => l.name))
  design.layers.forEach((frozen, i) => {
    const before = a.layers[visible[i].id]
    const after = b.layers[frozen.id]
    const label = `${frozen.name} @${time}`
    for (const key of ['x', 'y', 'z', 'rotX', 'rotY', 'rotZ', 'scale', 'opacity'] as const) {
      expect(after[key], `${label} ${key}`).toBeCloseTo(before[key], 6)
    }
    expect(frozen.blocks).toEqual([])
    if (frozen.kind === 'text') {
      expect(displayText(frozen, after), label).toBe(displayText(visible[i], { ...before, caret: false }, video.numberLocale))
    }
  })
  for (const key of ['x', 'y', 'z', 'fov', 'targetX', 'targetY'] as const) {
    expect(b.camera[key], `camera ${key} @${time}`).toBeCloseTo(a.camera[key], 6)
  }
  if (a.camera.focusSet) {
    expect(b.camera.focusZ).toBeCloseTo(a.camera.focusZ, 6)
    expect(b.camera.focusBlur).toBeCloseTo(a.camera.focusBlur, 6)
  }
  return design
}

describe('kareyi tasarıma çevirme', () => {
  it('tasarım projesi tek kare: bloksuz katmanlar, ses yok', () => {
    const design = freezeFrame(SAMPLE_TEMPLATE.build(), 3, 'Poster')
    expect(design).toMatchObject({ mode: 'design', name: 'Poster', duration: DESIGN_DURATION, audio: [] })
    for (const layer of design.layers) expect(layer).toMatchObject({ start: 0, duration: DESIGN_DURATION, blocks: [] })
  })

  it('animasyonun o anki etkisi temel değerlere işlenir (sayaç ve daktilo metni dahil)', () => {
    const video = SAMPLE_TEMPLATE.build()
    for (const t of [0.3, 1.1, 3, 7.5]) expectSameFrame(video, t)
    // sayaç 2.2 sn'de başlayıp 1.8 sn sürer: bitince son değer metne yazılır
    const counter = freezeFrame(video, 5, 'x').layers.find((l) => l.name === 'Counter')
    expect(counter?.text).toBe('10,000')
  })

  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s şablonunun kareleri aynı görünür (kamera ve odak dahil)', (_id, template) => {
    const video = template.build()
    for (const ratio of [0.1, 0.35, 0.6, 0.9]) expectSameFrame(video, +(video.duration * ratio).toFixed(3))
  })
})
