import { handleMcpRequest, isMcpPath, type McpEnv } from './server'

/** Cloudflare Worker girişi: `/mcp` ve OAuth keşif adreslerini yanıtlar, kalan her şey sitenin statik dosyaları. */
interface Env extends McpEnv {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (isMcpPath(new URL(request.url).pathname)) return handleMcpRequest(request, env)
    return env.ASSETS.fetch(request)
  },
}
