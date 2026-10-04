import { del, get, set } from 'idb-keyval'
import { newId } from '../engine/ids'
import { migrateProject, NewerProjectVersionError } from '../engine/migrate'
import i18n from '../i18n'
import { PRESETS } from '../engine/presets'
import type { Project } from '../engine/types'
import { delegateTo } from './backend'

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
  /** bulunduğu klasör; yoksa yalnızca "Tümü"nde görünür */
  folderId?: string
  /** proje boyutu (kart önizlemesinin oranı için; eski kayıtlarda yok) */
  width?: number
  height?: number
  /** tasarım (tek kare) mı video mu; eski kayıtlarda yok = video */
  mode?: Project['mode']
  /** kullanıcının kendi şablonu (Studio → Şablonlarım); kullanınca kopyası açılır */
  isTemplate?: boolean
  /** kim oluşturdu: editör ya da Claude Code (MCP) */
  source?: 'editor' | 'mcp'
  /** bağlantıyla paylaşıldıysa paylaşım kimliği (`/s/<shareId>`); yalnızca bulutta */
  shareId?: string
}

/** Studio'daki proje klasörü. Klasörler yalnızca düzen içindir; projeler her zaman "Tümü"nde de görünür. */
export interface Folder {
  id: string
  name: string
  createdAt: number
}

const INDEX_KEY = 'projects:index'
const FOLDERS_KEY = 'projects:folders'
const projectKey = (id: string) => `project:${id}`

export function createRepository(kv: KeyValue) {
  const list = async () => ((await kv.get<ProjectSummary[]>(INDEX_KEY)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt)
  const listFolders = async () => ((await kv.get<Folder[]>(FOLDERS_KEY)) ?? []).sort((a, b) => a.createdAt - b.createdAt)
  const patchSummary = async (id: string, patch: Partial<ProjectSummary>) => {
    const index = await list()
    await kv.set(INDEX_KEY, index.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  return {
    list,
    /** Kayıtlı projeyi güncel formata getirerek yükler. */
    async load(id: string) {
      const raw = await kv.get<object>(projectKey(id))
      return raw ? migrateProject(raw) : undefined
    },
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
        folderId: previous?.folderId,
        isTemplate: previous?.isTemplate,
        width: project.width,
        height: project.height,
        mode: project.mode,
      }
      await kv.set(INDEX_KEY, [summary, ...index.filter((p) => p.id !== project.id)])
    },
    /** Küçük resmi günceller; "son düzenleme" zamanına dokunmaz. */
    async setThumbnail(id: string, thumbnail: string) {
      await patchSummary(id, { thumbnail })
    },
    /** Projeyi klasöre taşır (`undefined` = klasörden çıkar); "son düzenleme" zamanına dokunmaz. */
    async moveToFolder(id: string, folderId: string | undefined) {
      await patchSummary(id, { folderId })
    },
    /** Projeyi kullanıcının şablonu yapar ya da şablonluktan çıkarır. */
    async setTemplate(id: string, isTemplate: boolean) {
      await patchSummary(id, { isTemplate: isTemplate || undefined })
    },
    /** Bağlantıyla paylaşım hesap ister; bu tarayıcıdaki projeler paylaşılamaz. */
    async share(_id: string): Promise<string> {
      throw new Error('cloud-required')
    },
    async unshare(_id: string): Promise<void> {
      throw new Error('cloud-required')
    },
    async rename(id: string, name: string) {
      const raw = await kv.get<Project>(projectKey(id))
      if (raw) await kv.set(projectKey(id), { ...raw, name })
      await patchSummary(id, { name })
    },
    listFolders,
    async createFolder(name: string): Promise<Folder> {
      const folder: Folder = { id: newId('f'), name, createdAt: Date.now() }
      await kv.set(FOLDERS_KEY, [...(await listFolders()), folder])
      return folder
    },
    async renameFolder(id: string, name: string) {
      await kv.set(FOLDERS_KEY, (await listFolders()).map((f) => (f.id === id ? { ...f, name } : f)))
    },
    /** Klasörü siler; içindeki projeler silinmez, yalnızca klasörden çıkar. */
    async removeFolder(id: string) {
      await kv.set(FOLDERS_KEY, (await listFolders()).filter((f) => f.id !== id))
      const index = await list()
      await kv.set(INDEX_KEY, index.map((p) => (p.folderId === id ? { ...p, folderId: undefined } : p)))
    },
    async remove(id: string) {
      await kv.del(projectKey(id))
      await kv.set(INDEX_KEY, (await list()).filter((p) => p.id !== id))
    },
  }
}

export type Repository = ReturnType<typeof createRepository>

/** Bu tarayıcıdaki projeler (giriş yapılmamışken ve bulut kopyalamasının kaynağı). */
export const localRepository = createRepository({ get, set, del })

let cloudRepository: Repository | undefined

/** Giriş yapılınca bulut deposunu, çıkışta `undefined` verip yerel depoyu devreye alır. */
export function setCloudRepository(next: Repository | undefined) {
  cloudRepository = next
}

/** Ekranların kullandığı depo: girişliyse hesap (bulut), değilse bu tarayıcı. */
export const repository: Repository = delegateTo(localRepository, () => cloudRepository)

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
    throw new Error(i18n.t('import.invalidJson'))
  }
  const p = data as Project
  const fail = (reason: string, values?: Record<string, string>) => {
    throw new Error(i18n.t('import.notProject', { reason: i18n.t(`import.reasons.${reason}`, values) }))
  }
  if (!p || typeof p !== 'object') fail('empty')
  if (typeof p.name !== 'string' || !isNum(p.duration) || !isNum(p.fps) || !isNum(p.width) || !isNum(p.height)) fail('details')
  if (!p.camera || !Array.isArray(p.camera.blocks) || !isVec3(p.camera.position)) fail('camera')
  if (!Array.isArray(p.layers)) fail('layers')
  for (const layer of p.layers) {
    if (typeof layer.id !== 'string' || !isVec3(layer.position) || !isVec3(layer.rotation) || !Array.isArray(layer.blocks)) {
      fail('layer', { name: layer?.name ?? '?' })
    }
  }
  for (const block of [...p.camera.blocks, ...p.layers.flatMap((l) => l.blocks)]) {
    if (!PRESETS[block.preset]) fail('preset', { preset: block.preset })
    if (!isNum(block.start) || !isNum(block.duration)) fail('timing')
  }
  try {
    return { ...migrateProject(p), id: newId('p') }
  } catch (err) {
    if (err instanceof NewerProjectVersionError) fail('newer')
    throw err
  }
}
