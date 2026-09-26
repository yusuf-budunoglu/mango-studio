import { describe, expect, it } from 'vitest'
import { exportSize, subframeTimes, supersampleFactor } from '../export/exportVideo'
import { TEMPLATES } from '../project/templates'
import { DEFAULT_EFFECTS, lensFrame, lensPasses, resolveEffects } from './effects'
import { evaluateCamera } from './evaluate'

describe('efektler', () => {
  it('kayıtsız projede varsayılanlar, kısmi ayarda birleştirme', () => {
    expect(resolveEffects(undefined)).toEqual(DEFAULT_EFFECTS)
    const fx = resolveEffects({ dof: { enabled: true }, bloom: { intensity: 2 } })
    expect(fx.dof).toEqual({ ...DEFAULT_EFFECTS.dof, enabled: true })
    expect(fx.bloom).toEqual({ ...DEFAULT_EFFECTS.bloom, intensity: 2 })
    // Varsayılan nesne değişmemeli.
    expect(DEFAULT_EFFECTS.dof.enabled).toBe(false)
    expect(resolveEffects({ motionBlur: { enabled: true } }).motionBlur).toEqual({ enabled: true, samples: 6, shutter: 0.5 })
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

describe('dışa aktarma kalitesi', () => {
  it('kenar yumuşatma katı çizim tarafını 4096 pikselde tutar', () => {
    expect(supersampleFactor(1280, 720)).toBe(2)
    expect(supersampleFactor(1920, 1080)).toBe(2)
    expect(supersampleFactor(3840, 2160)).toBe(1)
  })
  it('hareket bulanıklığı alt kareleri kare anından ileriye, deklanşör süresince', () => {
    expect(subframeTimes(1, 30, 1, 0.5)).toEqual([1])
    const ts = subframeTimes(1, 30, 4, 0.5)
    expect(ts).toHaveLength(4)
    expect(ts[0]).toBe(1)
    // bir sonraki kareye (1 + 1/30) taşmaz: kesme anlarında iki çekim karışmasın
    expect(Math.max(...ts)).toBeLessThan(1 + 0.5 / 30)
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

describe('lens efektleri', () => {
  it('kapalı ayarlar ve bloksuz kamera hiçbir lens geçişi eklemez', () => {
    const project = TEMPLATES[0].build()
    project.camera.blocks = []
    expect(lensPasses(resolveEffects(undefined), project)).toEqual({ lens: false, flare: false, sweep: false, leak: false })
    project.camera.blocks = [{ id: 'p', preset: 'lens-punch', start: 0, duration: 0.4 }]
    expect(lensPasses(resolveEffects(undefined), project).lens).toBe(true)
  })
  it('proje ayarı ve blok değerleri toplanır', () => {
    const fx = resolveEffects({ chromatic: { enabled: true, amount: 0.5 }, lightLeak: { enabled: true, intensity: 0.3 } })
    const camera = { ...evaluateCamera(TEMPLATES[0].build(), 0), aberration: 1, leak: 0.2 }
    const lens = lensFrame(fx, camera, 2)
    expect(lens.aberration).toBeCloseTo(1.5)
    expect(lens.leak).toEqual({ time: 2, intensity: 0.5 })
    expect(lens.flare.intensity).toBe(0)
  })
})
