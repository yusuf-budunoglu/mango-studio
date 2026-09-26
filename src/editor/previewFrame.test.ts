import { describe, expect, it } from 'vitest'
import { overscanFov, previewLayout, OVERSCAN_MARGIN } from './previewFrame'

describe('önizleme taşma alanı', () => {
  it('kadraj çevresinde kısa kenara oranlı ince şerit; alana sığar, ortalanır', () => {
    const land = previewLayout(1000, 600, 16 / 9, true)
    expect(land.frame.w / land.frame.h).toBeCloseTo(16 / 9)
    expect(land.frame.x).toBeCloseTo(OVERSCAN_MARGIN * land.frame.h)
    expect(land.view.w).toBeLessThanOrEqual(1000 + 1e-6)
    expect(land.view.h).toBeLessThanOrEqual(600 + 1e-6)
    expect(land.view.x).toBeCloseTo((1000 - land.view.w) / 2)

    // dikey: şerit genişliğe oranlı, yani kadraja göre ince; kanvas tüm alanı kaplamaz
    const port = previewLayout(1000, 600, 9 / 16, true)
    expect(port.frame.x).toBeCloseTo(OVERSCAN_MARGIN * port.frame.w)
    expect(port.view.h).toBeCloseTo(600)
    expect(port.view.w).toBeLessThan(400)
    expect(port.k).toBeCloseTo(1 + (2 * OVERSCAN_MARGIN * 9) / 16)

    const off = previewLayout(1000, 600, 9 / 16, false)
    expect(off.k).toBeCloseTo(1)
    expect(off.view.h).toBeCloseTo(600)
    expect(off.frame).toEqual({ x: 0, y: 0, w: off.view.w, h: off.view.h })
  })

  it('genişletilmiş açı kadrajı aynı görüş açısında tutar', () => {
    const { k } = previewLayout(1200, 900, 16 / 9, true)
    const fov = overscanFov(40, k)
    const inner = (2 * Math.atan((1 / k) * Math.tan((fov * Math.PI) / 360)) * 180) / Math.PI
    expect(inner).toBeCloseTo(40, 6)
    expect(overscanFov(40, 1)).toBe(40)
  })
})
