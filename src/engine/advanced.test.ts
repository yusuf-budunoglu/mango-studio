import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../project/templates'
import { easingFor } from './easing'
import { evaluateCamera, evaluateLayer } from './evaluate'
import type { Layer } from './types'

const layer = (blocks: Layer['blocks']): Layer => ({
  id: 'l', name: 'x', kind: 'shape', color: '#fff',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, blocks,
})

describe('özel hareket', () => {
  it('hedefe gider ve orada kalır; art arda bloklar bir yol çizer', () => {
    const l = layer([
      { id: 'a', preset: 'move', start: 0, duration: 1, easing: 'linear', params: { dx: 2, dy: 0, dz: 0, rotate: 0, scaleBy: 1 } },
      { id: 'b', preset: 'move', start: 2, duration: 1, easing: 'linear', params: { dx: 0, dy: 1, dz: 0, rotate: 90, scaleBy: 2 } },
    ])
    expect(evaluateLayer(l, 0).x).toBe(0)
    expect(evaluateLayer(l, 0.5).x).toBeCloseTo(1)
    // İlk hareket bitti, ikincisi başlamadı: ilk hedefte bekler.
    expect(evaluateLayer(l, 1.5)).toMatchObject({ x: 2, y: 0, scale: 1 })
    const end = evaluateLayer(l, 5)
    expect(end.x).toBeCloseTo(2)
    expect(end.y).toBeCloseTo(1)
    expect(end.scale).toBeCloseTo(2)
    expect(end.rotZ).toBeCloseTo(Math.PI / 2)
  })
})

describe('geçişler', () => {
  const at = (preset: string, t: number) => {
    const project = TEMPLATES[0].build()
    project.camera.blocks = [{ id: 't', preset, start: 1, duration: 1, easing: 'linear' }]
    return evaluateCamera(project, t)
  }

  it('siyaha kararma ortasında ekranı tamamen kaplar, dışında görünmez', () => {
    expect(at('fade-black', 0.5).overlayOpacity).toBe(0)
    expect(at('fade-black', 1.5).overlayOpacity).toBeCloseTo(1)
    expect(at('fade-black', 1.25).overlayOpacity).toBeCloseTo(0.5)
    expect(at('fade-black', 2.5).overlayOpacity).toBe(0)
    expect(at('fade-black', 1.5).overlayWhite).toBe(0)
    expect(at('fade-white', 1.5).overlayWhite).toBe(1)
  })

  it('flaş hızla açılır, yavaşça söner', () => {
    expect(at('flash', 1.15).overlayOpacity).toBeCloseTo(1)
    expect(at('flash', 1.05).overlayOpacity).toBeGreaterThan(0.2)
    expect(at('flash', 1.6).overlayOpacity).toBeLessThan(0.6)
    expect(at('flash', 2.1).overlayOpacity).toBe(0)
  })
})

describe('özel eğri', () => {
  it('cubic-bezier tanımına göre ilerler, uçlar sabit', () => {
    const linear = easingFor({ easing: 'custom', bezier: [0, 0, 1, 1] }, 'linear')
    expect(linear(0.3)).toBeCloseTo(0.3, 2)
    const fastStart = easingFor({ easing: 'custom', bezier: [0, 0.9, 0.1, 1] }, 'linear')
    expect(fastStart(0.2)).toBeGreaterThan(0.6)
    expect(fastStart(0)).toBeCloseTo(0)
    expect(fastStart(1)).toBeCloseTo(1)
    // Özel değilse isimli eğri ya da varsayılan.
    expect(easingFor({}, 'linear')(0.4)).toBeCloseTo(0.4)
  })
})
