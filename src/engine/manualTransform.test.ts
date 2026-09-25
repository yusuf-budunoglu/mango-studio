import { describe, expect, it } from 'vitest'
import { evaluateLayer } from './evaluate'
import { manualTransformPatch, snapToGuides } from './manualTransform'
import type { Layer } from './types'

const layer = (extra: Partial<Layer> = {}): Layer => ({
  id: 'l', name: 'x', kind: 'shape', color: '#fff',
  position: [1, 2, 0], rotation: [0, 10, 0], scale: 1, opacity: 1, blocks: [],
  ...extra,
})

describe('elle taşıma', () => {
  it('animasyon yokken ekrandaki konum doğrudan temel konum olur', () => {
    const l = layer()
    const patch = manualTransformPatch(l, evaluateLayer(l, 0), { position: [3, -1, 0.5], rotation: [0, (10 * Math.PI) / 180, 0], scale: 2 })
    expect(patch).toEqual({ position: [3, -1, 0.5], rotation: [0, 10, 0], scale: 2 })
  })

  it('animasyonun ortasında bırakılınca animasyon farkı korunur', () => {
    // slide-up başında katman 1.2 birim aşağıda; kullanıcı onu 0.5 birim sağa çekiyor.
    const l = layer({ blocks: [{ id: 'b', preset: 'slide-up', start: 0, duration: 1, easing: 'linear' }] })
    const evaluated = evaluateLayer(l, 0)
    expect(evaluated.y).toBeCloseTo(0.8)
    const patch = manualTransformPatch(l, evaluated, { position: [evaluated.x + 0.5, evaluated.y, evaluated.z], rotation: [evaluated.rotX, evaluated.rotY, evaluated.rotZ], scale: evaluated.scale })
    expect(patch.position).toEqual([1.5, 2, 0])
    // Yeni temel konumla animasyon bittiğinde katman tam bırakılan hizada ve 1.2 yukarıda durur.
    const after = evaluateLayer({ ...l, ...patch }, 1)
    expect(after.x).toBeCloseTo(1.5)
    expect(after.y).toBeCloseTo(2)
  })

  it('ölçek, animasyonun ölçek etkisine oranlanır', () => {
    // scale-in başında katman %60 boyutunda görünür; kullanıcı onu ekranda 1.2 yapıyor.
    const l = layer({ blocks: [{ id: 'b', preset: 'scale-in', start: 0, duration: 1, easing: 'linear' }] })
    const evaluated = evaluateLayer(l, 0)
    expect(evaluated.scale).toBeCloseTo(0.6)
    const patch = manualTransformPatch(l, evaluated, { position: [1, 2, 0], rotation: [0, evaluated.rotY, 0], scale: 1.2 })
    expect(patch.scale).toBeCloseTo(2)
  })
})

describe('hizalama', () => {
  const lines = { x: [0, 2.5], y: [0, -1] }

  it('eşik içindeki en yakın çizgiye yapışır', () => {
    expect(snapToGuides(0.05, 0.3, lines, 0.1)).toEqual({ x: 0, y: 0.3, guideX: 0, guideY: null })
    expect(snapToGuides(2.45, -0.95, lines, 0.1)).toEqual({ x: 2.5, y: -1, guideX: 2.5, guideY: -1 })
  })

  it('uzaktaysa dokunmaz', () => {
    expect(snapToGuides(1, 0.5, lines, 0.1)).toEqual({ x: 1, y: 0.5, guideX: null, guideY: null })
  })
})
