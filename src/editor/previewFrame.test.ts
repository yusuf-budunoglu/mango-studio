import { describe, expect, it } from 'vitest'
import { overscanFov, previewLayout, OVERSCAN_FIT } from './previewFrame'

describe('önizleme taşma alanı', () => {
  it('taşma açıkken kanvas tüm alanı kaplar, kadraj ortada büyükçe; kapalıyken kanvas = kadraj', () => {
    const land = previewLayout(1000, 600, 16 / 9, true)
    expect(land.view).toEqual({ x: 0, y: 0, w: 1000, h: 600 })
    expect(land.frame.w / land.frame.h).toBeCloseTo(16 / 9)
    expect(land.frame.w).toBeCloseTo(Math.min(1000 * OVERSCAN_FIT, 600 * OVERSCAN_FIT * (16 / 9)))
    expect(land.frame.x).toBeCloseTo((1000 - land.frame.w) / 2)
    expect(land.k).toBeCloseTo(600 / land.frame.h)

    const port = previewLayout(1000, 600, 9 / 16, true)
    expect(port.frame.h).toBeCloseTo(600 * OVERSCAN_FIT)

    const off = previewLayout(1000, 600, 9 / 16, false)
    expect(off.k).toBe(1)
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
