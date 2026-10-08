import { handleAiRequest, isAiPath, type AiEnv } from '../ai/server'
import { handleMcpRequest, isMcpPath, type McpEnv } from './server'

/**
 * Cloudflare Worker girişi: `/mcp` ve OAuth keşif adreslerini (MCP sunucusu) ve `/api/*` adreslerini (editördeki
 * yapay zekâyla düzenleme) yanıtlar, kalan her şey sitenin statik dosyaları.
 */
interface Env extends McpEnv, AiEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (isMcpPath(pathname)) return handleMcpRequest(request, env)
    if (isAiPath(pathname)) return handleAiRequest(request, env)
    return env.ASSETS.fetch(request)
  },
}
