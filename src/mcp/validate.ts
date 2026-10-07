import { evaluate } from '../engine/evaluate'
import { newId } from '../engine/ids'
import { migrateProject } from '../engine/migrate'
import { PRESETS } from '../engine/presets'
import { PROJECT_VERSION, type Block, type CameraTrack, type Layer, type LayerKind, type Project, type Vec3 } from '../engine/types'

/**
 * MCP'den (Claude) gelen proje JSON'unu denetler ve eksikleri varsayılanlarla doldurur. Hata mesajları
 * İngilizce ve yol belirtir (`layers[3].blocks[0].preset`): okuyan bir model, kendi çıktısını düzeltecek.
 */
export class ProjectError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`Invalid project:\n- ${problems.join('\n- ')}`)
    this.problems = problems
  }
}

export const EASINGS = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'ease-out-expo', 'ease-out-circ', 'ease-out-back', 'anticipate', 'spring-gentle', 'spring-snappy', 'spring-bouncy']
export const LAYER_KINDS: LayerKind[] = ['text', 'phone', 'laptop', 'tablet', 'foldable', 'shape', 'image', 'svg', 'video']

const MAX_BYTES = 4_000_000
const MAX_LAYERS = 400
const MAX_DURATION = 600
const MAX_INLINE_IMAGE = 100_000

type Raw = Record<string, unknown>

const isObject = (v: unknown): v is Raw => !!v && typeof v === 'object' && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isVec3 = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(isNum)
const isColor = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

/** Dosya referansı: yüklenen dosya (`asset:<id>`), sitedeki dosya (`/templates/...`) ya da https adresi. */
function checkRef(value: unknown, path: string, problems: string[]) {
  if (value === undefined) return
  if (typeof value !== 'string' || !value) return void problems.push(`${path} must be a string like "asset:<id>"`)
  if (value.startsWith('data:')) {
    if (value.length > MAX_INLINE_IMAGE) problems.push(`${path} is an inline data: URL of ${value.length} bytes; upload the file with create_upload and use the returned "asset:<id>" instead`)
    return
  }
  if (!/^(asset:[\w-]+|https:\/\/\S+|\/[\w./-]+)$/.test(value)) problems.push(`${path} must be "asset:<id>" (from create_upload), an https:// URL or a site path; got "${value.slice(0, 60)}"`)
}

function normalizeBlocks(raw: unknown, path: string, target: 'layer' | 'camera', problems: string[], warnings: string[]): Block[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    problems.push(`${path} must be an array`)
    return []
  }
  return raw.map((item, i) => {
    const at = `${path}[${i}]`
    const b = isObject(item) ? item : {}
    if (!isObject(item)) problems.push(`${at} must be an object`)
    const preset = typeof b.preset === 'string' ? PRESETS[b.preset] : undefined
    if (!preset) problems.push(`${at}.preset "${String(b.preset)}" does not exist (call get_guide for the list)`)
    else if (preset.target !== target) problems.push(`${at}.preset "${String(b.preset)}" is a ${preset.target} block; it cannot be used on ${target === 'camera' ? 'the camera' : 'a layer'}`)
    if (!isNum(b.start)) problems.push(`${at}.start must be a number (seconds)`)
    if (!isNum(b.duration) || b.duration < 0) problems.push(`${at}.duration must be a number >= 0 (seconds)`)
    if (b.easing !== undefined && b.easing !== 'custom' && !EASINGS.includes(b.easing as string)) problems.push(`${at}.easing "${String(b.easing)}" is unknown; use one of ${EASINGS.join(', ')} or "custom" with bezier`)
    if (b.easing === 'custom' && !(Array.isArray(b.bezier) && b.bezier.length === 4 && b.bezier.every(isNum))) problems.push(`${at}.bezier must be [x1, y1, x2, y2] when easing is "custom"`)
    if (b.params !== undefined) {
      if (!isObject(b.params)) problems.push(`${at}.params must be an object of numbers`)
      else {
        const known = new Set((preset?.params ?? []).map((p) => p.key))
        for (const [key, value] of Object.entries(b.params)) {
          if (!isNum(value)) problems.push(`${at}.params.${key} must be a number`)
          else if (preset && !known.has(key)) warnings.push(`${at}.params.${key} is not a setting of "${String(b.preset)}" and is ignored`)
        }
      }
    }
    return { ...b, id: typeof b.id === 'string' && b.id ? b.id : newId('b') } as unknown as Block
  })
}

function normalizeLayer(item: unknown, index: number, total: number, problems: string[], warnings: string[]): Layer {
  const at = `layers[${index}]`
  const l = isObject(item) ? item : {}
  if (!isObject(item)) problems.push(`${at} must be an object`)
  const kind = l.kind as LayerKind
  if (!LAYER_KINDS.includes(kind)) problems.push(`${at}.kind must be one of ${LAYER_KINDS.join(', ')}`)
  const name = typeof l.name === 'string' && l.name ? l.name : `${String(l.kind ?? 'layer')} ${index + 1}`
  const label = `${at} ("${name}")`

  const start = l.start === undefined ? 0 : l.start
  const duration = l.duration === undefined && isNum(start) ? total - start : l.duration
  if (!isNum(start) || start < 0) problems.push(`${label}.start must be a number >= 0`)
  if (!isNum(duration) || duration <= 0) problems.push(`${label}.duration must be a number > 0`)
  if (isNum(start) && isNum(duration) && start + duration > total + 1e-6) problems.push(`${label} clip ends at ${(start + duration).toFixed(3)}s, after the project ends (${total}s)`)

  for (const key of ['position', 'rotation'] as const) if (l[key] !== undefined && !isVec3(l[key])) problems.push(`${label}.${key} must be [x, y, z] numbers`)
  for (const key of ['scale', 'opacity', 'fontSize', 'textWidth', 'letterSpacing', 'lineHeight', 'shapeWidth', 'shapeHeight', 'extrude', 'lidAngle', 'foldAngle', 'mediaOffset'] as const)
    if (l[key] !== undefined && !isNum(l[key])) problems.push(`${label}.${key} must be a number`)
  if (l.foldBlur !== undefined && typeof l.foldBlur !== 'boolean') problems.push(`${label}.foldBlur must be true or false`)
  if (l.color !== undefined && !isColor(l.color)) problems.push(`${label}.color must be a hex color like "#ff7a00"`)
  if (l.fontWeight !== undefined && l.fontWeight !== 400 && l.fontWeight !== 700) problems.push(`${label}.fontWeight must be 400 or 700`)
  if (l.align !== undefined && !['left', 'center', 'right'].includes(l.align as string)) problems.push(`${label}.align must be left, center or right`)
  checkRef(l.image, `${label}.image`, problems)
  checkRef(l.media, `${label}.media`, problems)

  if (kind === 'text' && typeof l.text !== 'string') problems.push(`${label} is a text layer and needs "text"`)
  if (kind === 'image' && !l.image) warnings.push(`${label} is an image layer without "image"; nothing will be drawn`)
  if ((kind === 'svg' || kind === 'video') && !l.media) warnings.push(`${label} is a ${kind} layer without "media"; nothing will be drawn`)
  if (kind === 'shape' && l.shape !== undefined && !['cube', 'rect', 'rounded', 'circle'].includes(l.shape as string)) problems.push(`${label}.shape must be cube, rect, rounded or circle`)

  return {
    ...l,
    id: typeof l.id === 'string' && l.id ? l.id : newId('l'),
    name,
    kind,
    start,
    duration,
    color: l.color ?? '#ffffff',
    position: l.position ?? [0, 0, 0],
    rotation: l.rotation ?? [0, 0, 0],
    scale: l.scale ?? 1,
    opacity: l.opacity ?? 1,
    blocks: normalizeBlocks(l.blocks, `${label}.blocks`, 'layer', problems, warnings),
  } as unknown as Layer
}

/**
 * Projeyi kaydedilebilir hale getirir: sürüm, kimlikler ve varsayılanlar doldurulur; sorun varsa `ProjectError`.
 * `id` verilirse proje o kimlikle kaydedilir (güncelleme), yoksa yeni kimlik üretilir.
 */
export function normalizeProject(input: unknown, id?: string): { project: Project; warnings: string[] } {
  const problems: string[] = []
  const warnings: string[] = []
  if (!isObject(input)) throw new ProjectError(['project must be a JSON object'])
  if (JSON.stringify(input).length > MAX_BYTES) throw new ProjectError([`project JSON is larger than ${MAX_BYTES / 1e6} MB; upload images with create_upload instead of embedding them`])

  let p: Raw
  try {
    p = migrateProject({ version: PROJECT_VERSION, ...input }) as unknown as Raw
  } catch (err) {
    throw new ProjectError([err instanceof Error ? err.message : 'unsupported project version'])
  }

  if (!isNum(p.duration) || p.duration <= 0 || p.duration > MAX_DURATION) problems.push(`duration must be a number of seconds between 0 and ${MAX_DURATION}`)
  if (!isNum(p.fps) || p.fps < 1 || p.fps > 120) problems.push('fps must be a number between 1 and 120 (30 or 60 recommended)')
  for (const key of ['width', 'height'] as const) if (!isNum(p[key]) || !Number.isInteger(p[key]) || p[key] < 64 || p[key] > 4096) problems.push(`${key} must be an integer between 64 and 4096`)
  if (!isColor(p.background)) problems.push('background must be a hex color like "#000000"')
  if (p.background2 !== undefined && !isColor(p.background2)) problems.push('background2 must be a hex color')
  if (p.backgroundStyle !== undefined && !['solid', 'linear', 'radial'].includes(p.backgroundStyle as string)) problems.push('backgroundStyle must be solid, linear or radial')
  if (p.mode !== undefined && p.mode !== 'motion' && p.mode !== 'design') problems.push('mode must be "motion" or "design"')
  if (!Array.isArray(p.layers)) problems.push('layers must be an array')
  else if (p.layers.length > MAX_LAYERS) problems.push(`layers has ${p.layers.length} items; the limit is ${MAX_LAYERS}`)
  if (problems.length) throw new ProjectError(problems)

  const total = p.duration as number
  const cam = isObject(p.camera) ? p.camera : {}
  if (cam.position !== undefined && !isVec3(cam.position)) problems.push('camera.position must be [x, y, z] numbers')
  if (cam.fov !== undefined && !isNum(cam.fov)) problems.push('camera.fov must be a number (degrees)')
  const camera: CameraTrack = {
    id: 'camera',
    name: typeof cam.name === 'string' && cam.name ? cam.name : 'Camera',
    position: (cam.position as Vec3 | undefined) ?? [0, 0, 9],
    fov: (cam.fov as number | undefined) ?? 40,
    blocks: normalizeBlocks(cam.blocks, 'camera.blocks', 'camera', problems, warnings),
  }
  const layers = (p.layers as unknown[]).map((item, i) => normalizeLayer(item, i, total, problems, warnings))
  const ids = new Set<string>()
  for (const layer of layers) {
    if (ids.has(layer.id)) problems.push(`layer id "${layer.id}" is used more than once`)
    ids.add(layer.id)
  }

  const audio = p.audio
  if (audio !== undefined) {
    if (!Array.isArray(audio)) problems.push('audio must be an array')
    else
      audio.forEach((clip, i) => {
        const a = isObject(clip) ? clip : {}
        if (typeof a.asset !== 'string' || !a.asset.startsWith('asset:')) problems.push(`audio[${i}].asset must be "asset:<id>" from create_upload`)
        for (const key of ['start', 'offset', 'duration', 'sourceDuration', 'volume', 'fadeIn', 'fadeOut']) if (!isNum(a[key])) problems.push(`audio[${i}].${key} must be a number`)
        if (typeof a.id !== 'string' || !a.id) a.id = newId('a')
        if (typeof a.name !== 'string' || !a.name) a.name = `Audio ${i + 1}`
      })
  }
  if (problems.length) throw new ProjectError(problems)

  const project = { ...p, version: PROJECT_VERSION, id: id ?? newId('p'), name: typeof p.name === 'string' && p.name.trim() ? p.name.trim().slice(0, 200) : 'Untitled', layers, camera } as unknown as Project

  // Motoru birkaç anda çalıştır: sayı olmayan (NaN) sonuç veren ayarları kaydetmeden yakala.
  try {
    for (const t of [0, total / 3, (2 * total) / 3, Math.max(0, total - 1 / project.fps)]) {
      const frame = evaluate(project, t)
      for (const layer of layers) {
        const s = frame.layers[layer.id]
        if (s && ![s.x, s.y, s.z, s.scale, s.opacity, s.rotX, s.rotY, s.rotZ].every(Number.isFinite)) problems.push(`layers ("${layer.name}") evaluates to a non-finite value at ${t.toFixed(2)}s; check its block params`)
      }
      if (![frame.camera.x, frame.camera.y, frame.camera.z, frame.camera.fov].every(Number.isFinite)) problems.push(`camera evaluates to a non-finite value at ${t.toFixed(2)}s; check its block params`)
    }
  } catch (err) {
    problems.push(`the engine could not evaluate the project: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (problems.length) throw new ProjectError([...new Set(problems)])

  if (!layers.length) warnings.push('the project has no layers')
  return { project, warnings }
}
