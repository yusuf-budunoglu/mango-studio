import { describe, expect, it } from 'vitest'
import { restackFactor, type Extent } from './stacking'

const full = { x0: -1, y0: -1, x1: 1, y1: 1 }
const at = (near: number, far: number, rect = full): Extent => ({ near, far, rect })

describe('katman yığını: listede yeri değişen katmanın derinliği', () => {
  it('öne alınan katman, üstüne bindiği katmanların en yakınından da yakına gelir', () => {
    const phone = at(8, 10)
    const rock = at(6.7, 6.7)
    const f = restackFactor(phone, [rock, at(10.6, 10.6)], 'front')
    expect(phone.far * f).toBeLessThan(rock.near)
    expect(f).toBeLessThan(1)
  })

  it('zaten öndeyse ya da üstüne bindiği katman yoksa yerinde kalır', () => {
    expect(restackFactor(at(5, 6), [at(8, 9)], 'front')).toBe(1)
    expect(restackFactor(at(8, 10), [at(6, 6, { x0: 0.6, y0: -1, x1: 1, y1: -0.6 })], 'front')).toBeLessThan(1)
    expect(restackFactor(at(8, 10, { x0: -0.5, y0: -0.5, x1: 0.5, y1: 0.5 }), [at(6, 6, { x0: 0.6, y0: -1, x1: 1, y1: -0.6 })], 'front')).toBe(1)
  })

  it('arkaya alınan katman, üstüne bindiği katmanların en uzağından da uzağa gider', () => {
    const rock = at(6.7, 6.7)
    const phone = at(8, 10)
    const f = restackFactor(rock, [phone], 'back')
    expect(rock.near * f).toBeGreaterThan(phone.far)
  })

  it('kameranın dibine kadar yaklaşmaz', () => {
    const f = restackFactor(at(4, 9), [at(0.7, 0.7)], 'front')
    expect(4 * f).toBeGreaterThanOrEqual(0.6 - 1e-9)
  })
})
