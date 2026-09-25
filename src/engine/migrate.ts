import { PROJECT_VERSION, type Project } from './types'

/** Proje bu uygulamadan daha yeni bir sürümle kaydedilmişse fırlatılır. */
export class NewerProjectVersionError extends Error {
  readonly version: number
  constructor(version: number) {
    super(`Project version ${version} is newer than supported version ${PROJECT_VERSION}`)
    this.version = version
  }
}

type Step = (project: Record<string, unknown>) => Record<string, unknown>

/**
 * Sürüm n'den n+1'e geçiş adımları. Format değiştikçe buraya yeni bir adım eklenir;
 * eski adımlar asla değiştirilmez (eski dosyalar hâlâ onlardan geçer).
 */
const STEPS: Record<number, Step> = {
  // 0 → 1: sürüm alanı eklendi. Yeni metin alanları (font, genişlik…) isteğe bağlı, varsayılanları var.
  0: (p) => ({ ...p, version: 1 }),
}

/** Kaydedilmiş ya da içe aktarılmış bir projeyi güncel formata getirir. */
export function migrateProject(raw: object): Project {
  let project = { ...(raw as Record<string, unknown>) }
  let version = typeof project.version === 'number' ? project.version : 0
  if (version > PROJECT_VERSION) throw new NewerProjectVersionError(version)
  while (version < PROJECT_VERSION) {
    const step = STEPS[version]
    if (!step) throw new Error(`No migration step from version ${version}`)
    project = step(project)
    version = project.version as number
  }
  return project as unknown as Project
}
