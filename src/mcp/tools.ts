import { BackendError, type Backend } from './backend'
import { buildGuide } from './guide'
import { normalizeProject, ProjectError } from './validate'

/** Araç sonucu: modele dönen metin; `isError` ise model hatayı okuyup düzeltir. */
export interface ToolResult {
  content: { type: 'text'; text: string }[]
  isError?: boolean
}

interface ToolContext {
  backend: Backend
  /** sitenin adresi (`https://mangostudio.design`): bağlantılar bununla kurulur */
  siteUrl: string
}

interface Tool {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean }
  run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<string>
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024
const UPLOAD_KINDS = ['image', 'audio', 'video', 'svg', 'font'] as const

const text = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 1))
const str = (args: Record<string, unknown>, key: string) => {
  const value = args[key]
  if (typeof value !== 'string' || !value.trim()) throw new BackendError(`"${key}" is required`)
  return value.trim()
}

export const TOOLS: Tool[] = [
  {
    name: 'get_guide',
    title: 'Read the project guide',
    description:
      'Returns the Mango Studio project format: scene units, layer kinds, every animation block with its settings, fonts, effects, and how to rebuild a reference video. Call this once before building or editing a project.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => buildGuide(ctx.siteUrl),
  },
  {
    name: 'list_projects',
    title: 'List Studio projects',
    description: "Lists the projects in the user's Mango Studio (newest first) with id, name, size, duration and who created each (editor or Claude).",
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (_args, ctx) => {
      const projects = await ctx.backend.listProjects()
      return text({ projects: projects.map((p) => ({ ...p, url: `${ctx.siteUrl}/p/${p.id}` })) })
    },
  },
  {
    name: 'get_project',
    title: 'Read a project',
    description: 'Returns the full JSON of one project so it can be edited and saved back with save_project (pass the same id).',
    inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Project id from list_projects or save_project' } }, required: ['id'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    run: async (args, ctx) => {
      const project = await ctx.backend.getProject(str(args, 'id'))
      if (!project) throw new BackendError('No project with that id in this account. Call list_projects to see the ids.')
      return text(project)
    },
  },
  {
    name: 'save_project',
    title: 'Save a project to the Studio',
    description:
      "Validates a project JSON and saves it to the user's Mango Studio, where they can preview, edit and export the video. Omit `id` to create a new project; pass an existing `id` to overwrite that project. Returns the editor link to give to the user. Read get_guide first; validation errors name the exact field to fix.",
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'object', description: 'The project JSON described by get_guide' },
        id: { type: 'string', description: 'Existing project id to overwrite; omit to create a new project' },
      },
      required: ['project'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
    run: async (args, ctx) => {
      const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : undefined
      if (id && !/^[\w-]{1,80}$/.test(id)) throw new BackendError('"id" must be a project id returned by list_projects or save_project')
      const { project, warnings } = normalizeProject(args.project, id)
      const { created } = await ctx.backend.saveProject(project)
      return text({
        saved: created ? 'created' : 'updated',
        id: project.id,
        name: project.name,
        url: `${ctx.siteUrl}/p/${project.id}`,
        studio: `${ctx.siteUrl}/studio`,
        layers: project.layers.length,
        duration: project.duration,
        warnings,
        next: 'Give the user the url: the project opens in the Mango Studio editor, where they preview it and export the video.',
      })
    },
  },
  {
    name: 'create_upload',
    title: 'Upload a file',
    description:
      "Registers a file (image, audio, video, svg or font) in the user's Mango Studio storage and returns a one-time upload URL plus the `asset:<id>` reference to use in a project (layer.image, layer.media, audio[].asset). After calling this, upload the local file with the returned curl command. Counts against the account's storage quota.",
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name shown in the Studio, e.g. "home-screen.png"' },
        kind: { type: 'string', enum: [...UPLOAD_KINDS] },
        contentType: { type: 'string', description: 'MIME type, e.g. image/png, audio/mpeg, video/mp4, image/svg+xml, font/ttf' },
        size: { type: 'integer', description: 'File size in bytes' },
        duration: { type: 'number', description: 'Length in seconds (audio and video only)' },
      },
      required: ['name', 'kind', 'contentType', 'size'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    run: async (args, ctx) => {
      const kind = str(args, 'kind') as (typeof UPLOAD_KINDS)[number]
      if (!UPLOAD_KINDS.includes(kind)) throw new BackendError(`"kind" must be one of ${UPLOAD_KINDS.join(', ')}`)
      const contentType = str(args, 'contentType')
      if (!/^[\w.+-]+\/[\w.+-]+$/.test(contentType)) throw new BackendError('"contentType" must be a MIME type like image/png')
      const size = args.size
      if (typeof size !== 'number' || !Number.isInteger(size) || size <= 0) throw new BackendError('"size" must be the file size in bytes')
      if (size > MAX_UPLOAD_BYTES) throw new BackendError(`Files are limited to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB; this one is ${(size / 1024 / 1024).toFixed(1)} MB`)
      const duration = typeof args.duration === 'number' && Number.isFinite(args.duration) ? args.duration : undefined
      const { id, uploadUrl } = await ctx.backend.createUpload({ name: str(args, 'name'), kind, contentType, size, duration })
      return text({
        asset: `asset:${id}`,
        uploadUrl,
        upload: `curl -sS -X PUT -H "Content-Type: ${contentType}" --data-binary "@<local file path>" "${uploadUrl}"`,
        next: 'Run the curl command with the local file path (the URL is single-use and expires). A JSON response containing "Key" means it worked. Then reference the file as the `asset` value in the project.',
      })
    },
  },
]

/** Aracı çalıştırır; beklenen hatalar (geçersiz proje, kota, eksik alan) araç sonucu olarak döner. */
export async function callTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult | undefined> {
  const tool = TOOLS.find((t) => t.name === name)
  if (!tool) return undefined
  try {
    return { content: [{ type: 'text', text: await tool.run(args, ctx) }] }
  } catch (err) {
    if (err instanceof ProjectError || err instanceof BackendError) return { content: [{ type: 'text', text: err.message }], isError: true }
    throw err
  }
}
