import { describe, expect, it } from 'vitest'
import { TEMPLATES } from '../project/templates'
import { frameMotion, motionSamples } from './motion'

describe('hareket bulanıklığı örnek sayısı', () => {
  const project = TEMPLATES.find((tpl) => tpl.id === 'fold-promo')!.build()

  it('duran karede tek çizim yeter', () => {
    // kapanış: telefon çok yavaş dönüyor
    expect(motionSamples(project, 19, 60, 32, 0.5, 1080)).toBeLessThanOrEqual(4)
  })

  it('hızlı dönüşte üst sınıra çıkar', () => {
    // 846–872. kareler: telefon bir tur atıyor
    expect(motionSamples(project, 859 / 60, 60, 32, 0.5, 1080)).toBe(32)
  })

  it('hareket çözünürlükle ve deklanşör süresiyle orantılı', () => {
    const t = 859 / 60
    expect(frameMotion(project, t, 0.5 / 60, 2160)).toBeCloseTo(frameMotion(project, t, 0.5 / 60, 1080) * 2, 5)
    expect(frameMotion(project, t, 1 / 60, 1080)).toBeGreaterThan(frameMotion(project, t, 0.5 / 60, 1080) * 1.5)
  })

  it('örnek sayısı 1 ise hesap yapılmaz', () => {
    expect(motionSamples(project, 859 / 60, 60, 1, 0.5, 1080)).toBe(1)
  })
})
