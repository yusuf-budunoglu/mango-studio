import type { CameraState, Project } from './types'

/** Projenin görüntü efektleri. Kayıtlı olmayan alanlar varsayılanla tamamlanır. */
export interface ProjectEffects {
  bloom: { enabled: boolean; intensity: number; threshold: number }
  vignette: { enabled: boolean; darkness: number }
  /** alan derinliği: odak düzlemi kamera satırındaki odak animasyonuyla (focus-pull) değişir */
  dof: { enabled: boolean; bokeh: number; range: number }
  grain: { enabled: boolean; amount: number }
  /** -1..1 */
  color: { saturation: number; contrast: number; brightness: number }
  /**
   * Hareket bulanıklığı (video çıktısında ve oynatırken önizlemede): her kare, deklanşör süresince en çok
   * `samples` alt kare çizilip ortalanır (sayı o andaki harekete göre, `engine/motion.ts`). shutter: kare süresinin ne kadarı açık (0.5 = 180°).
   */
  motionBlur: { enabled: boolean; samples: number; shutter: number }
  /** kromatik sapma: kenarlara doğru artan renk kayması */
  chromatic: { enabled: boolean; amount: number }
  /** lens bükülmesi: + fıçı (geniş açı), - iğne yastığı */
  distortion: { enabled: boolean; amount: number }
  /** sabit lens parlaması; x, y ekrandaki konum (-1..1), streak yatay çizginin gücü */
  lensFlare: { enabled: boolean; intensity: number; x: number; y: number; streak: number }
  /** ışık sızması: kenarlardan süzülen sıcak renkli ışık, zamanla yavaşça kayar */
  lightLeak: { enabled: boolean; intensity: number }
}

export type EffectsPatch = { [K in keyof ProjectEffects]?: Partial<ProjectEffects[K]> }

export const DEFAULT_EFFECTS: ProjectEffects = {
  bloom: { enabled: true, intensity: 0.7, threshold: 0.6 },
  vignette: { enabled: true, darkness: 0.55 },
  dof: { enabled: false, bokeh: 3, range: 2.5 },
  grain: { enabled: false, amount: 0.12 },
  color: { saturation: 0, contrast: 0, brightness: 0 },
  motionBlur: { enabled: false, samples: 6, shutter: 0.5 },
  chromatic: { enabled: false, amount: 0.5 },
  distortion: { enabled: false, amount: 0.15 },
  lensFlare: { enabled: false, intensity: 1, x: 0.55, y: 0.45, streak: 0.6 },
  lightLeak: { enabled: false, intensity: 0.5 },
}

export function resolveEffects(patch: EffectsPatch | undefined): ProjectEffects {
  const out = structuredClone(DEFAULT_EFFECTS)
  for (const key of Object.keys(out) as (keyof ProjectEffects)[]) Object.assign(out[key], patch?.[key])
  return out
}

/** Proje ayarı ve kameradaki lens bloklarının o andaki birleşik değerleri (Stage shader'lara yazar). */
export function lensFrame(fx: ProjectEffects, c: CameraState, time: number) {
  return {
    distortion: fx.distortion.enabled ? fx.distortion.amount : 0,
    aberration: (fx.chromatic.enabled ? fx.chromatic.amount : 0) + c.aberration,
    flare: { x: fx.lensFlare.x, y: fx.lensFlare.y, intensity: fx.lensFlare.enabled ? fx.lensFlare.intensity : 0, streak: fx.lensFlare.streak },
    sweep: { x: c.flareX, y: c.flareY, intensity: c.flare, streak: fx.lensFlare.streak },
    leak: { time, intensity: (fx.lightLeak.enabled ? fx.lightLeak.intensity : 0) + c.leak },
  }
}

/** Hangi lens geçişlerinin zincirde olması gerektiği; kullanılmayan efekt hiç eklenmez. */
export function lensPasses(fx: ProjectEffects, project: Pick<Project, 'camera'>) {
  const has = (preset: string) => project.camera.blocks.some((b) => b.preset === preset)
  return {
    lens: fx.chromatic.enabled || fx.distortion.enabled || has('lens-punch'),
    flare: fx.lensFlare.enabled,
    sweep: has('flare-sweep'),
    leak: fx.lightLeak.enabled || has('light-leak'),
  }
}
