import { describe, expect, it } from 'vitest'
import { exportSize } from '../export/exportVideo'
import { TEMPLATES } from '../project/templates'
import { DEFAULT_EFFECTS, resolveEffects } from './effects'
import { evaluateCamera } from './evaluate'

describe('efektler', () => {
  it('kayıtsız projede varsayılanlar, kısmi ayarda birleştirme', () => {
    expect(resolveEffects(undefined)).toEqual(DEFAULT_EFFECTS)
    const fx = resolveEffects({ dof: { enabled: true }, bloom: { intensity: 2 } })
    expect(fx.dof).toEqual({ ...DEFAULT_EFFECTS.dof, enabled: true })
    expect(fx.bloom).toEqual({ ...DEFAULT_EFFECTS.bloom, intensity: 2 })
    // Varsayılan nesne değişmemeli.
    expect(DEFAULT_EFFECTS.dof.enabled).toBe(false)
  })

  it('odak kaydırma netlik düzlemini hareket ettirir', () => {
    const project = TEMPLATES[0].build()
    project.camera.blocks = [{ id: 'f', preset: 'focus-pull', start: 0, duration: 1, easing: 'linear', params: { from: -4, to: 0 } }]
    expect(evaluateCamera(project, 0).focusZ).toBe(-4)
    expect(evaluateCamera(project, 0.5).focusZ).toBeCloseTo(-2)
    expect(evaluateCamera(project, 1).focusZ).toBe(0)
    // bulanıklık varsayılan 1; blokla değiştirilebilir ve sonrasında öyle kalır
    expect(evaluateCamera(project, 0.5).focusBlur).toBe(1)
    project.camera.blocks.push({ id: 'g', preset: 'focus-pull', start: 2, duration: 0, params: { from: 0, to: 0, blur: 0 } })
    expect(evaluateCamera(project, 1.5).focusBlur).toBe(1)
    expect(evaluateCamera(project, 3).focusBlur).toBe(0)
  })
})

describe('dışa aktarma boyutu', () => {
  it('en-boy oranını koruyup kısa kenarı hedefe getirir, çift sayı verir', () => {
    expect(exportSize({ width: 1920, height: 1080 }, 720)).toEqual({ width: 1280, height: 720 })
    expect(exportSize({ width: 1080, height: 1920 }, 720)).toEqual({ width: 720, height: 1280 })
    expect(exportSize({ width: 1080, height: 1350 }, 2160)).toEqual({ width: 2160, height: 2700 })
    expect(exportSize({ width: 1080, height: 1080 }, 1080)).toEqual({ width: 1080, height: 1080 })
  })
})
