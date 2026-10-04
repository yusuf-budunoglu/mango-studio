import { supabase } from '../cloud/client'
import { newId } from '../engine/ids'
import { migrateProject } from '../engine/migrate'
import type { Project } from '../engine/types'
import { assetIdOf, assets, ownAssets, type AssetMeta } from '../persistence/assets'
import { collectAssetRefs } from '../persistence/projectFile'
import { repository } from '../persistence/repository'

/**
 * Sitenin Şablonlar sayfasındaki genel şablonlar: kodla yazılan kendi şablonlarımızın (templates.ts) yanında,
 * yöneticinin Studio'dan yayınladığı projeler. Tablo `public_templates`, dosyalar herkese açık `templates`
 * kovasında (`<şablon>/<dosya id>`, `poster.jpg`, `loop.mp4`). Yazma yetkisi yalnızca yöneticide (RLS).
 */
const BUCKET = 'templates'
const LIST_COLUMNS = 'id,name,description,tags,width,height,duration,mode,poster_path,loop_path,published_at'

type AssetInfo = Omit<AssetMeta, 'size' | 'type' | 'createdAt'>

export interface PublishedTemplate {
  id: string
  name: string
  description: string
  tags: string[]
  width: number
  height: number
  duration: number
  mode?: Project['mode']
  posterUrl?: string
  loopUrl?: string
  publishedAt: number
}

interface Row {
  id: string
  name: string
  description: string
  tags: string[]
  width: number
  height: number
  duration: number
  mode: 'design' | null
  poster_path: string | null
  loop_path: string | null
  published_at: string
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const publicUrl = (path: string) => supabase!.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

const toTemplate = (r: Row): PublishedTemplate => ({
  id: r.id,
  name: r.name,
  description: r.description,
  tags: r.tags,
  width: r.width,
  height: r.height,
  duration: r.duration,
  mode: r.mode ?? undefined,
  posterUrl: r.poster_path ? publicUrl(r.poster_path) : undefined,
  loopUrl: r.loop_path ? publicUrl(r.loop_path) : undefined,
  publishedAt: Date.parse(r.published_at),
})

/** Yayındaki şablonlar, en yenisi önce. Bulut kapalıysa ya da okunamazsa boş liste. */
export async function listPublished(): Promise<PublishedTemplate[]> {
  if (!supabase) return []
  const res = await supabase.from('public_templates').select(LIST_COLUMNS).order('published_at', { ascending: false })
  return res.error ? [] : (res.data as Row[]).map(toTemplate)
}

export async function getPublished(id: string): Promise<PublishedTemplate | undefined> {
  if (!supabase) return undefined
  const row = check(await supabase.from('public_templates').select(LIST_COLUMNS).eq('id', id).maybeSingle())
  return row ? toTemplate(row as Row) : undefined
}

/** Ad → adres dostu kimlik (`yeni-urun-tanitimi-k3x9`); sondaki ek aynı adın çakışmasını önler. */
export function templateSlug(name: string): string {
  const base = name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[c] ?? c)
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'template'}-${Math.random().toString(36).slice(2, 6)}`
}

/** Oran etiketi: 1920×1080 → "16:9". */
export function aspectLabel(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  const g = gcd(width, height) || 1
  return `${width / g}:${height / g}`
}

const dataUrlToBlob = async (url: string) => (await fetch(url)).blob()

/**
 * Projeyi genel şablon olarak yayınlar (yalnızca yönetici; sunucu da denetler). Projenin kullandığı dosyalar
 * herkese açık kovaya kopyalanır, böylece şablonu kullanan herkes onları kendi deposuna alabilir.
 */
export async function publishTemplate(options: {
  projectId: string
  name: string
  description: string
  tags: string[]
  /** kapak: verilmezse projenin küçük resmi */
  poster?: Blob
  /** isteğe bağlı döngü videosu (kartta ve önizleme sayfasında oynar) */
  loop?: Blob
}): Promise<string> {
  if (!supabase) throw new Error('cloud-required')
  const project = await repository.load(options.projectId)
  if (!project) throw new Error('missing')
  const summary = (await repository.list()).find((p) => p.id === options.projectId)
  const id = templateSlug(options.name)
  const storage = supabase.storage.from(BUCKET)
  const upload = async (path: string, blob: Blob) => {
    const res = await storage.upload(path, blob, { upsert: true, contentType: blob.type || undefined })
    if (res.error) throw new Error(res.error.message)
    return path
  }

  const infos: AssetInfo[] = []
  for (const ref of collectAssetRefs(project)) {
    const assetId = assetIdOf(ref)
    const [blob, meta] = await Promise.all([assets.getBlob(assetId), assets.getMeta(assetId)])
    if (!blob) continue
    await upload(`${id}/${assetId}`, blob)
    infos.push({ id: assetId, name: meta?.name ?? assetId, kind: meta?.kind ?? 'image', duration: meta?.duration })
  }

  const poster = options.poster ?? (summary?.thumbnail ? await dataUrlToBlob(summary.thumbnail) : undefined)
  const posterPath = poster ? await upload(`${id}/poster.${poster.type === 'image/png' ? 'png' : 'jpg'}`, poster) : null
  const loopPath = options.loop ? await upload(`${id}/loop.${options.loop.type === 'video/webm' ? 'webm' : 'mp4'}`, options.loop) : null

  const data: Project = { ...project, name: options.name }
  check(
    await supabase.from('public_templates').insert({
      id,
      name: options.name,
      description: options.description,
      tags: options.tags,
      width: project.width,
      height: project.height,
      duration: project.duration,
      mode: project.mode ?? null,
      data,
      assets: infos,
      poster_path: posterPath,
      loop_path: loopPath,
    }),
  )
  return id
}

/** Şablonu yayından kaldırır ve dosyalarını siler (yalnızca yönetici). */
export async function unpublishTemplate(id: string) {
  if (!supabase) return
  check(await supabase.from('public_templates').delete().eq('id', id))
  const storage = supabase.storage.from(BUCKET)
  const files = (await storage.list(id, { limit: 1000 })).data ?? []
  if (files.length) await storage.remove(files.map((f) => `${id}/${f.name}`))
}

/**
 * "Ücretsiz kullan": şablonun kopyasını kullanıcının Studio'suna kaydeder; dosyaları kendi deposuna alır
 * (yayından kaldırılsa da projesi çalışmaya devam eder). Yeni projenin id'sini döndürür.
 */
export async function createFromPublished(id: string, folderId?: string): Promise<string> {
  if (!supabase) throw new Error('cloud-required')
  const row = check(await supabase.from('public_templates').select('data,assets,poster_path').eq('id', id).maybeSingle())
  if (!row) throw new Error('missing')
  for (const info of row.assets as AssetInfo[]) {
    if (await ownAssets.getMeta(info.id)) continue
    const res = await fetch(publicUrl(`${id}/${info.id}`))
    if (!res.ok) continue
    await ownAssets.put(await res.blob(), info)
  }
  const project = { ...migrateProject(row.data as object), id: newId('p') }
  await repository.save(project, row.poster_path ? publicUrl(row.poster_path as string) : undefined)
  if (folderId) await repository.moveToFolder(project.id, folderId)
  return project.id
}
