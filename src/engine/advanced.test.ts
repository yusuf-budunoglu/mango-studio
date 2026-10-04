import { describe, expect, it } from 'vitest'
import { SAMPLE_TEMPLATE } from '../project/sampleTemplate'
import { easingFor } from './easing'
import { evaluateCamera, evaluateLayer } from './evaluate'
import type { Layer } from './types'

const layer = (blocks: Layer['blocks']): Layer => ({
  id: 'l', name: 'x', kind: 'shape', color: '#fff',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, start: 0, duration: 100, blocks,
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
    const project = SAMPLE_TEMPLATE.build()
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

describe('lens blokları', () => {
  const at = (preset: string, t: number, params?: Record<string, number>) => {
    const project = SAMPLE_TEMPLATE.build()
    project.camera.blocks = [{ id: 'l', preset, start: 1, duration: 1, params }]
    return { base: evaluateCamera({ ...project, camera: { ...project.camera, blocks: [] } }, t), s: evaluateCamera(project, t) }
  }

  it('el kamerası sarsıntısı blok dışında kamerayı değiştirmez, içinde tekrarlanabilir biçimde sallar', () => {
    for (const t of [0.5, 1, 2, 3]) expect(at('camera-shake', t).s).toEqual(at('camera-shake', t).base)
    const { s, base } = at('camera-shake', 1.5, { amount: 0.1 })
    expect(Math.abs(s.x - base.x) + Math.abs(s.y - base.y)).toBeGreaterThan(0.001)
    expect(Math.abs(s.x - base.x)).toBeLessThanOrEqual(0.1)
    // aynı an → aynı sonuç (video çıktısı buna güvenir)
    expect(at('camera-shake', 1.5, { amount: 0.1 }).s).toEqual(s)
  })

  it('lens darbesi hızla yükselip söner; yakınlaşma görüş açısını daraltır', () => {
    expect(at('lens-punch', 0.9).s.aberration).toBe(0)
    expect(at('lens-punch', 1.2).s.aberration).toBeCloseTo(1)
    expect(at('lens-punch', 1.6).s.aberration).toBeLessThan(0.5)
    expect(at('lens-punch', 2.1).s.aberration).toBe(0)
    const { s, base } = at('lens-punch', 1.2)
    expect(s.fov).toBeLessThan(base.fov)
  })

  it('geçen parlama soldan sağa gider, ortada en güçlü', () => {
    expect(at('flare-sweep', 0.5).s.flare).toBe(0)
    const mid = at('flare-sweep', 1.5, { from: -1, to: 1, intensity: 2 }).s
    expect(mid.flare).toBeCloseTo(2)
    expect(at('flare-sweep', 1.1, { from: -1, to: 1 }).s.flareX).toBeLessThan(mid.flareX)
    expect(at('flare-sweep', 2.5).s.flare).toBe(0)
  })

  it('ışık sızması blok ortasında tepe yapar', () => {
    expect(at('light-leak', 1.5, { intensity: 1 }).s.leak).toBeCloseTo(1)
    expect(at('light-leak', 3).s.leak).toBe(0)
  })
})

describe('kamera hareketi', () => {
  it('kamerayı ve baktığı noktayı kaydırır, yakınlaşmada mesafeyi böler', () => {
    const project = SAMPLE_TEMPLATE.build()
    project.camera.position = [0, 0, 9]
    project.camera.blocks = [
      { id: 'a', preset: 'camera-move', start: 0, duration: 1, easing: 'linear', params: { dx: 1, dy: -2, zoom: 1.5 } },
      { id: 'b', preset: 'camera-move', start: 2, duration: 1, easing: 'linear', params: { zoom: 0.5 } },
    ]
    const mid = evaluateCamera(project, 0.5)
    expect(mid.x).toBeCloseTo(0.5)
    expect(mid.targetY).toBeCloseTo(-1)
    expect(mid.z).toBeCloseTo(9 / 1.25)
    const held = evaluateCamera(project, 1.5)
    expect(held).toMatchObject({ x: 1, y: -2, targetX: 1, targetY: -2 })
    expect(held.z).toBeCloseTo(6)
    // ikinci blok ilkinin bıraktığı yerden devam eder: 1.5 × 0.5 = 0.75 kat
    expect(evaluateCamera(project, 4).z).toBeCloseTo(12)
  })
})
