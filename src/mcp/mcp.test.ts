import { describe, expect, it } from 'vitest'
import { EASINGS as ENGINE_EASINGS } from '../engine/easing'
import { PRESETS } from '../engine/presets'
import { PROJECT_VERSION, type Project } from '../engine/types'
import { FONTS } from '../render/fonts'
import type { Backend, UploadRequest } from './backend'
import { buildGuide, FONT_IDS, PRESET_NOTES } from './guide'
import { handleMcpRequest, isMcpPath } from './server'
import { EASINGS, normalizeProject, ProjectError } from './validate'

const ENV = { SUPABASE_URL: 'https://ref.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pk' }
const SITE = 'https://mangostudio.design'

const minimal = () => ({
  name: 'Demo',
  duration: 4,
  fps: 60,
  width: 1920,
  height: 1080,
  background: '#000000',
  layers: [{ name: 'Title', kind: 'text', text: 'Hello', blocks: [{ preset: 'fade-in', start: 0, duration: 0.5 }] }],
})

const problemsOf = (input: unknown) => {
  try {
    normalizeProject(input)
  } catch (err) {
    if (err instanceof ProjectError) return err.problems.join(' | ')
    throw err
  }
  return ''
}

describe('MCP: proje doğrulama', () => {
  it('eksik alanları varsayılanlarla doldurur', () => {
    const { project, warnings } = normalizeProject(minimal())
    expect(project.version).toBe(PROJECT_VERSION)
    expect(project.id).toMatch(/^p-/)
    expect(project.camera).toMatchObject({ id: 'camera', position: [0, 0, 9], fov: 40, blocks: [] })
    const [layer] = project.layers
    expect(layer).toMatchObject({ start: 0, duration: 4, position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, opacity: 1, color: '#ffffff' })
    expect(layer.id).toMatch(/^l-/)
    expect(layer.blocks[0].id).toMatch(/^b-/)
    expect(warnings).toEqual([])
  })

  it('verilen kimlikle kaydeder ve var olan kimlikleri korur', () => {
    const input = minimal()
    Object.assign(input.layers[0], { id: 'l-keep' })
    const { project } = normalizeProject(input, 'p-existing')
    expect(project.id).toBe('p-existing')
    expect(project.layers[0].id).toBe('l-keep')
  })

  it('hatalı alanı yoluyla bildirir', () => {
    const bad = minimal()
    bad.layers[0].blocks[0].preset = 'fly-in'
    expect(problemsOf(bad)).toContain('blocks[0].preset "fly-in" does not exist')

    const camOnLayer = minimal()
    camOnLayer.layers[0].blocks[0].preset = 'camera-push'
    expect(problemsOf(camOnLayer)).toContain('is a camera block')

    expect(problemsOf({ ...minimal(), layers: [{ name: 'X', kind: 'hologram' }] })).toContain('kind must be one of')
    expect(problemsOf({ ...minimal(), layers: [{ name: 'Late', kind: 'text', text: 'a', start: 3, duration: 2 }] })).toContain('after the project ends')
    expect(problemsOf({ ...minimal(), width: 100000 })).toContain('width must be an integer')
    expect(problemsOf({ ...minimal(), layers: [{ name: 'Fold', kind: 'foldable', foldBlur: 'off' }] })).toContain('foldBlur must be true or false')
    expect(problemsOf({ ...minimal(), layers: [{ name: 'Fold', kind: 'foldable', foldBlur: false }] })).toBe('')
    expect(problemsOf({ ...minimal(), version: 99 })).toContain('newer')
    expect(problemsOf('nope')).toContain('must be a JSON object')
  })

  it('gömülü büyük görseli reddeder, yüklenen dosya referansını kabul eder', () => {
    const inline = { ...minimal(), layers: [{ name: 'Shot', kind: 'image', image: `data:image/png;base64,${'A'.repeat(200_000)}` }] }
    expect(problemsOf(inline)).toContain('create_upload')
    expect(() => normalizeProject({ ...minimal(), layers: [{ name: 'Shot', kind: 'image', image: 'asset:a-123' }] })).not.toThrow()
    expect(problemsOf({ ...minimal(), layers: [{ name: 'Shot', kind: 'image', image: 'file:///C:/x.png' }] })).toContain('must be "asset:<id>"')
  })

  it('ses: yüklenen dosyayı ve hazır şablonun kendi ses dosyasını kabul eder, başka adresi reddeder', () => {
    const clip = (asset: string) => ({ asset, start: 0, offset: 0, duration: 2, sourceDuration: 2, volume: 1, fadeIn: 0, fadeOut: 0 })
    expect(() => normalizeProject({ ...minimal(), audio: [clip('asset:a-123')] })).not.toThrow()
    // hazır şablondan açılan proje get_project → save_project ile geri kaydedilebilmeli
    expect(() => normalizeProject({ ...minimal(), audio: [clip('/templates/launch-ad/sfx/air.mp3')] })).not.toThrow()
    expect(() => normalizeProject({ ...minimal(), audio: [clip('https://example.com/song.mp3')] })).toThrow(ProjectError)
  })

  it('bilinmeyen blok ayarı uyarıdır, hata değil', () => {
    const input = minimal()
    Object.assign(input.layers[0].blocks[0], { params: { wobble: 3 } })
    expect(normalizeProject(input).warnings.join(' ')).toContain('params.wobble')
  })
})

describe('MCP: rehber motorla aynı', () => {
  it('her bloğun açıklaması var, olmayan blok anlatılmıyor', () => {
    expect(Object.keys(PRESET_NOTES).sort()).toEqual(Object.keys(PRESETS).sort())
  })

  it('font ve eğri listeleri güncel', () => {
    expect([...FONT_IDS].sort()).toEqual(FONTS.map((f) => f.id).sort())
    expect([...EASINGS].sort()).toEqual(Object.keys(ENGINE_EASINGS).sort())
  })

  it('rehberdeki örnek proje geçerli', () => {
    const guide = buildGuide(SITE)
    const example = JSON.parse(guide.slice(guide.indexOf('```json') + 7, guide.lastIndexOf('```')).replace('asset:<id from create_upload>', 'asset:a-1'))
    expect(() => normalizeProject(example)).not.toThrow()
    for (const id of Object.keys(PRESETS)) expect(guide).toContain(`\`${id}\``)
  })
})

function fakeBackend() {
  const saved = new Map<string, Project>()
  const uploads: UploadRequest[] = []
  const backend: Backend = {
    listProjects: async () => [...saved.values()].map((p) => ({ id: p.id, name: p.name, duration: p.duration, width: p.width, height: p.height, mode: null, source: 'mcp', updatedAt: '2026-10-04T00:00:00Z' })),
    getProject: async (id) => saved.get(id),
    saveProject: async (project) => {
      const created = !saved.has(project.id)
      saved.set(project.id, project)
      return { created }
    },
    createUpload: async (file) => {
      uploads.push(file)
      return { id: 'a-new', uploadUrl: 'https://ref.supabase.co/storage/v1/object/upload/sign/assets/u/a-new?token=t' }
    },
  }
  return { backend, saved, uploads }
}

/** Supabase'in oturum denetimini taklit eder: yalnızca `good` anahtarı geçerli. */
const authFetch: typeof fetch = async (input, init) => {
  const url = String(input)
  if (url.endsWith('/auth/v1/user')) {
    const token = new Headers(init?.headers).get('Authorization')
    return token === 'Bearer good' ? Response.json({ id: 'user-1' }) : new Response('{}', { status: 401 })
  }
  if (url.includes('/.well-known/oauth-authorization-server/auth/v1')) return Response.json({ issuer: 'https://ref.supabase.co/auth/v1' })
  throw new Error(`unexpected fetch ${url}`)
}

const post = (body: unknown, token: string | null = 'good') =>
  new Request(`${SITE}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) })

const rpc = async (method: string, params: unknown, backend: Backend) => {
  const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 1, method, params }), ENV, { fetch: authFetch, backend: () => backend })
  return (await res.json()) as { result?: Record<string, unknown>; error?: { code: number; message: string } }
}

const toolText = (result: Record<string, unknown> | undefined) => ((result?.content ?? []) as { text: string }[])[0].text

describe('MCP: sunucu', () => {
  it('yalnızca kendi adreslerini üstlenir', () => {
    expect(isMcpPath('/mcp')).toBe(true)
    expect(isMcpPath('/.well-known/oauth-protected-resource/mcp')).toBe(true)
    expect(isMcpPath('/.well-known/oauth-authorization-server')).toBe(true)
    expect(isMcpPath('/templates')).toBe(false)
    expect(isMcpPath('/mcpx')).toBe(false)
  })

  it('girişsiz isteği 401 ile yetkilendirme bilgisine yönlendirir', async () => {
    for (const token of [null, 'bad']) {
      const res = await handleMcpRequest(post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }, token), ENV, { fetch: authFetch })
      expect(res.status).toBe(401)
      expect(res.headers.get('WWW-Authenticate')).toContain(`resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`)
    }
    const meta = await handleMcpRequest(new Request(`${SITE}/.well-known/oauth-protected-resource/mcp`), ENV, { fetch: authFetch })
    expect(await meta.json()).toMatchObject({ resource: `${SITE}/mcp`, authorization_servers: ['https://ref.supabase.co/auth/v1'] })
    const proxied = await handleMcpRequest(new Request(`${SITE}/.well-known/oauth-authorization-server`), ENV, { fetch: authFetch })
    expect(await proxied.json()).toEqual({ issuer: 'https://ref.supabase.co/auth/v1' })
  })

  it('el sıkışma: sürüm, yetenekler, bildirimlere 202', async () => {
    const { backend } = fakeBackend()
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } }, backend)
    expect(init.result).toMatchObject({ protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'mango-studio' } })
    expect((await rpc('initialize', { protocolVersion: '1999-01-01' }, backend)).result?.protocolVersion).toBe('2025-11-25')

    const notified = await handleMcpRequest(post({ jsonrpc: '2.0', method: 'notifications/initialized' }), ENV, { fetch: authFetch, backend: () => backend })
    expect(notified.status).toBe(202)
    expect((await rpc('ping', {}, backend)).result).toEqual({})
    expect((await rpc('resources/list', {}, backend)).error?.code).toBe(-32601)
    expect((await handleMcpRequest(new Request(`${SITE}/mcp`), ENV, { fetch: authFetch })).status).toBe(405)
  })

  it('araç listesi şemalarıyla gelir', async () => {
    const tools = (await rpc('tools/list', {}, fakeBackend().backend)).result?.tools as { name: string; inputSchema: { type: string } }[]
    expect(tools.map((t) => t.name)).toEqual(['get_guide', 'list_projects', 'get_project', 'save_project', 'create_upload'])
    for (const tool of tools) expect(tool.inputSchema.type).toBe('object')
  })

  it('proje kaydeder, bağlantısını döndürür, aynı kimlikle günceller', async () => {
    const { backend, saved } = fakeBackend()
    const created = JSON.parse(toolText((await rpc('tools/call', { name: 'save_project', arguments: { project: minimal() } }, backend)).result))
    expect(created).toMatchObject({ saved: 'created', name: 'Demo', layers: 1 })
    expect(created.url).toBe(`${SITE}/p/${created.id}`)
    expect(saved.get(created.id)?.layers[0].name).toBe('Title')

    const read = JSON.parse(toolText((await rpc('tools/call', { name: 'get_project', arguments: { id: created.id } }, backend)).result)) as Project
    read.name = 'Demo v2'
    const updated = JSON.parse(toolText((await rpc('tools/call', { name: 'save_project', arguments: { project: read, id: created.id } }, backend)).result))
    expect(updated).toMatchObject({ saved: 'updated', id: created.id, name: 'Demo v2' })
    expect(saved.size).toBe(1)

    const listed = JSON.parse(toolText((await rpc('tools/call', { name: 'list_projects', arguments: {} }, backend)).result))
    expect(listed.projects[0]).toMatchObject({ id: created.id, url: `${SITE}/p/${created.id}` })
  })

  it('geçersiz proje araç hatası olarak döner, kaydedilmez', async () => {
    const { backend, saved } = fakeBackend()
    const res = await rpc('tools/call', { name: 'save_project', arguments: { project: { ...minimal(), fps: 0 } } }, backend)
    expect(res.result?.isError).toBe(true)
    expect(toolText(res.result)).toContain('fps must be')
    expect(saved.size).toBe(0)
    expect((await rpc('tools/call', { name: 'nope', arguments: {} }, backend)).error?.code).toBe(-32602)
  })

  it('dosya yükleme adresi ve referansı verir, sınırı uygular', async () => {
    const { backend, uploads } = fakeBackend()
    const ok = JSON.parse(toolText((await rpc('tools/call', { name: 'create_upload', arguments: { name: 'home.png', kind: 'image', contentType: 'image/png', size: 1234 } }, backend)).result))
    expect(ok.asset).toBe('asset:a-new')
    expect(ok.upload).toContain('curl')
    expect(uploads).toEqual([{ name: 'home.png', kind: 'image', contentType: 'image/png', size: 1234, duration: undefined }])

    const big = await rpc('tools/call', { name: 'create_upload', arguments: { name: 'big.mp4', kind: 'video', contentType: 'video/mp4', size: 60 * 1024 * 1024 } }, backend)
    expect(big.result?.isError).toBe(true)
    expect(uploads).toHaveLength(1)
  })
})
