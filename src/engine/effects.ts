/** Projenin görüntü efektleri. Kayıtlı olmayan alanlar varsayılanla tamamlanır. */
export interface ProjectEffects {
  bloom: { enabled: boolean; intensity: number; threshold: number }
  vignette: { enabled: boolean; darkness: number }
  /** alan derinliği: odak düzlemi kamera satırındaki odak animasyonuyla (focus-pull) değişir */
  dof: { enabled: boolean; bokeh: number; range: number }
  grain: { enabled: boolean; amount: number }
  /** -1..1 */
  color: { saturation: number; contrast: number; brightness: number }
}

export type EffectsPatch = { [K in keyof ProjectEffects]?: Partial<ProjectEffects[K]> }

export const DEFAULT_EFFECTS: ProjectEffects = {
  bloom: { enabled: true, intensity: 0.7, threshold: 0.6 },
  vignette: { enabled: true, darkness: 0.55 },
  dof: { enabled: false, bokeh: 3, range: 2.5 },
  grain: { enabled: false, amount: 0.12 },
  color: { saturation: 0, contrast: 0, brightness: 0 },
}

export function resolveEffects(patch: EffectsPatch | undefined): ProjectEffects {
  const out = structuredClone(DEFAULT_EFFECTS)
  for (const key of Object.keys(out) as (keyof ProjectEffects)[]) Object.assign(out[key], patch?.[key])
  return out
}
