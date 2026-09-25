import { del, get, set } from 'idb-keyval'
import { newId } from '../engine/ids'
import { PRESETS } from '../engine/presets'
import type { Project } from '../engine/types'

/**
 * Projelerin saklandığı yer. Şimdilik tarayıcının IndexedDB'si; ileride aynı arayüzle
 * Supabase'e geçilecek (KeyValue yerine sunucu çağrıları).
 */
export interface KeyValue {
  get: <T>(key: string) => Promise<T | undefined>
  set: (key: string, value: unknown) => Promise<void>
  del: (key: string) => Promise<void>
}

export interface ProjectSummary {
  id: string
  name: string
  duration: number
  updatedAt: number
  /** küçük önizleme görseli (JPEG data URL) */
  thumbnail?: string
}

const INDEX_KEY = 'projects:index'
const projectKey = (id: string) => `project:${id}`

export function createRepository(kv: KeyValue) {
  const list = async () => ((await kv.get<ProjectSummary[]>(INDEX_KEY)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt)

  return {
    list,
    load: (id: string) => kv.get<Project>(projectKey(id)),
    async save(project: Project, thumbnail?: string) {
      await kv.set(projectKey(project.id), project)
      const index = await list()
      const previous = index.find((p) => p.id === project.id)
      const summary: ProjectSummary = {
        id: project.id,
        name: project.name,
        duration: project.duration,
        updatedAt: Date.now(),
        thumbnail: thumbnail ?? previous?.thumbnail,
      }
      await kv.set(INDEX_KEY, [summary, ...index.filter((p) => p.id !== project.id)])
    },
    /** Küçük resmi günceller; "son düzenleme" zamanına dokunmaz. */
    async setThumbnail(id: string, thumbnail: string) {
      const index = await list()
      await kv.set(INDEX_KEY, index.map((p) => (p.id === id ? { ...p, thumbnail } : p)))
    },
    async remove(id: string) {
      await kv.del(projectKey(id))
      await kv.set(INDEX_KEY, (await list()).filter((p) => p.id !== id))
    },
  }
}

export type Repository = ReturnType<typeof createRepository>

export const repository = createRepository({ get, set, del })

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec3 = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every(isNum)

/**
 * Dosyadan içe aktarılan JSON'u kontrol eder. Geçerliyse, mevcut projelerin üzerine
 * yazmasın diye yeni bir proje id'siyle döndürür; değilse neyin yanlış olduğunu söyler.
 */
export function parseProjectFile(json: string): Project {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Dosya okunamadı: geçerli bir JSON değil.')
  }
  const p = data as Project
  const fail = (what: string) => {
    throw new Error(`Bu bir motion-studio proje dosyası değil (${what}).`)
  }
  if (!p || typeof p !== 'object') fail('boş dosya')
  if (typeof p.name !== 'string' || !isNum(p.duration) || !isNum(p.fps) || !isNum(p.width) || !isNum(p.height)) fail('proje bilgileri eksik')
  if (!p.camera || !Array.isArray(p.camera.blocks) || !isVec3(p.camera.position)) fail('kamera eksik')
  if (!Array.isArray(p.layers)) fail('katman listesi yok')
  for (const layer of p.layers) {
    if (typeof layer.id !== 'string' || !isVec3(layer.position) || !isVec3(layer.rotation) || !Array.isArray(layer.blocks)) {
      fail(`"${layer?.name ?? '?'}" katmanı bozuk`)
    }
  }
  for (const block of [...p.camera.blocks, ...p.layers.flatMap((l) => l.blocks)]) {
    if (!PRESETS[block.preset]) fail(`bilinmeyen animasyon: ${block.preset}`)
    if (!isNum(block.start) || !isNum(block.duration)) fail('blok zamanı bozuk')
  }
  return { ...p, id: newId('p') }
}
