import { createSupabaseBackend, type Backend } from './backend'
import { callTool, TOOLS } from './tools'

/**
 * Mango Studio MCP sunucusu (Streamable HTTP, durumsuz): Claude Code `…/mcp` adresine bağlanır, kullanıcı
 * Mango Studio hesabıyla onay verir (OAuth sunucusu Supabase Auth), araçlar o kullanıcının yetkisiyle çalışır.
 * Her POST tek başına yanıtlanır (JSON); sunucudan istemciye akış (SSE) ve oturum yok.
 */
export interface McpEnv {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
}

interface Deps {
  fetch?: typeof fetch
  /** testler için: Supabase yerine sahte veri katmanı */
  backend?: (session: { accessToken: string; userId: string }) => Backend
}

interface RpcMessage {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: Record<string, unknown>
}

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05']
const SERVER_INFO = { name: 'mango-studio', title: 'Mango Studio', version: '0.1.0' }
const INSTRUCTIONS =
  'Mango Studio turns a JSON project into an animated product video that the user previews, edits and exports in their Studio. Call get_guide before building or editing a project, then save_project, and give the user the returned link.'

const MCP_PATH = '/mcp'
const RESOURCE_METADATA_PATH = '/.well-known/oauth-protected-resource'
const AUTH_SERVER_METADATA_PATH = '/.well-known/oauth-authorization-server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...headers } })

const rpcError = (id: RpcMessage['id'], code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

/** Bu sunucunun yanıtladığı adres mi (`/mcp` ve OAuth keşif adresleri)? Diğerleri siteye (statik dosyalar) gider. */
export function isMcpPath(pathname: string) {
  return pathname === MCP_PATH || pathname.startsWith(RESOURCE_METADATA_PATH) || pathname === AUTH_SERVER_METADATA_PATH
}

export async function handleMcpRequest(request: Request, env: McpEnv, deps: Deps = {}): Promise<Response> {
  const url = new URL(request.url)
  const doFetch = deps.fetch ?? fetch
  const issuer = `${env.SUPABASE_URL}/auth/v1`

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Korunan kaynak bilgisi (RFC 9728): istemci buradan yetkilendirme sunucusunu (Supabase Auth) öğrenir.
  if (url.pathname.startsWith(RESOURCE_METADATA_PATH)) {
    return json({ resource: `${url.origin}${MCP_PATH}`, authorization_servers: [issuer], bearer_methods_supported: ['header'], resource_name: 'Mango Studio' }, 200, { 'Cache-Control': 'public, max-age=3600' })
  }
  // Eski istemciler yetkilendirme sunucusunu MCP sunucusunun kendi adresinde arar: Supabase'inkini aktar.
  if (url.pathname === AUTH_SERVER_METADATA_PATH) {
    const res = await doFetch(`${env.SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`)
    return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json', ...CORS } })
  }

  if (url.pathname !== MCP_PATH) return json({ error: 'not_found' }, 404)
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' })

  const unauthorized = (description: string) =>
    json({ error: 'invalid_token', error_description: description }, 401, {
      'WWW-Authenticate': `Bearer resource_metadata="${url.origin}${RESOURCE_METADATA_PATH}${MCP_PATH}", error="invalid_token", error_description="${description}"`,
    })
  const accessToken = request.headers.get('Authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!accessToken) return unauthorized('Sign in to Mango Studio to use this server')
  const userRes = await doFetch(`${issuer}/user`, { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${accessToken}` } })
  if (!userRes.ok) return unauthorized('The access token is invalid or expired')
  const userId = ((await userRes.json()) as { id?: string }).id
  if (!userId) return unauthorized('The access token is invalid or expired')

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(rpcError(null, -32700, 'Parse error: the body is not valid JSON'), 400)
  }
  const messages = (Array.isArray(body) ? body : [body]) as RpcMessage[]
  const backend = deps.backend?.({ accessToken, userId }) ?? createSupabaseBackend({ url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, accessToken, userId, fetch: doFetch })
  const ctx = { backend, siteUrl: url.origin }

  const responses: unknown[] = []
  for (const message of messages) {
    if (!message || typeof message !== 'object' || typeof message.method !== 'string') {
      // istemcinin yanıtı ya da bozuk mesaj: yanıtlanacak bir şey yok
      if (message && typeof message === 'object' && message.id !== undefined && !('result' in message) && !('error' in message)) responses.push(rpcError(message.id, -32600, 'Invalid request'))
      continue
    }
    // bildirim (id yok): yanıt beklenmez
    if (message.id === undefined || message.id === null) continue
    responses.push(await handleRpc(message, ctx))
  }

  if (!responses.length) return new Response(null, { status: 202, headers: CORS })
  return json(Array.isArray(body) ? responses : responses[0])
}

async function handleRpc(message: RpcMessage, ctx: { backend: Backend; siteUrl: string }) {
  const { id, method, params = {} } = message
  const ok = (result: unknown) => ({ jsonrpc: '2.0', id, result })
  try {
    switch (method) {
      case 'initialize': {
        const requested = params.protocolVersion
        const protocolVersion = typeof requested === 'string' && PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS[0]
        return ok({ protocolVersion, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: INSTRUCTIONS })
      }
      case 'ping':
        return ok({})
      case 'tools/list':
        return ok({ tools: TOOLS.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations: { title, ...annotations } })) })
      case 'tools/call': {
        const name = params.name
        if (typeof name !== 'string') return rpcError(id, -32602, 'Invalid params: "name" is required')
        const args = params.arguments && typeof params.arguments === 'object' ? (params.arguments as Record<string, unknown>) : {}
        const result = await callTool(name, args, ctx)
        return result ? ok(result) : rpcError(id, -32602, `Unknown tool: ${name}`)
      }
      default:
        return rpcError(id, -32601, `Method not found: ${method}`)
    }
  } catch (err) {
    console.error('mcp', method, err)
    return rpcError(id, -32603, 'Internal error')
  }
}
