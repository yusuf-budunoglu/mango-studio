import { describe, expect, it } from 'vitest'
import { overscanFov, previewFrame, OVERSCAN_FIT } from './previewFrame'

describe('önizleme taşma alanı', () => {
  it('kadraj ortada, oranı korunur; kapalıyken alanı doldurur', () => {
    const on = previewFrame(1000, 800, 16 / 9, true)
    expect(on.w / on.h).toBeCloseTo(16 / 9)
    expect(on.w).toBeCloseTo(1000 * OVERSCAN_FIT)
    expect(on.x).toBeCloseTo((1000 - on.w) / 2)
    expect(on.y).toBeCloseTo((800 - on.h) / 2)
    const portrait = previewFrame(1000, 800, 9 / 16, true)
    expect(portrait.h).toBeCloseTo(800 * OVERSCAN_FIT)
    const off = previewFrame(1000, 800, 9 / 16, false)
    expect(off.h).toBeCloseTo(800)
    expect(off.k).toBeCloseTo(1)
  })

  it('genişletilmiş açı kadrajı aynı görüş açısında tutar', () => {
    const { h, k } = previewFrame(1200, 900, 16 / 9, true)
    const fov = overscanFov(40, k)
    // kadraj yüksekliğinin karşılık geldiği açı yine 40°
    const inner = (2 * Math.atan((h / 900) * Math.tan((fov * Math.PI) / 360)) * 180) / Math.PI
    expect(inner).toBeCloseTo(40, 6)
    expect(overscanFov(40, 1)).toBe(40)
  })
})
