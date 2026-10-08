import { supabase } from '../cloud/client'
import { isDesign } from '../engine/design'
import type { Layer, Project } from '../engine/types'
import { cleanLayer, MAX_MESSAGE, type EditRequest } from './edit'
import type { AiEditResponse, AiErrorCode } from './server'

/** Tarayıcı tarafı: seçili katman için düzenleme isteğini Worker'daki uca (`/api/ai/edit`) gönderir. */

/** `signin`: oturum yok; `unavailable`: bu derlemede bulut kapalı; gerisi sunucunun hata adları. */
export type AiFailure = AiErrorCode | 'signin' | 'unavailable'

export class AiRequestError extends Error {
  readonly code: AiFailure
  constructor(code: AiFailure) {
    super(code)
    this.code = code
  }
}

const CODES: AiErrorCode[] = ['unauthorized', 'plan_required', 'no_credits', 'message_limit', 'rate_limited', 'not_configured', 'refused', 'busy', 'failed', 'bad_request']

/** Modelin göreceği bağlam: seçili katman (dosya referansları olmadan) ve diğer katmanların kısa listesi. */
export function buildEditRequest(project: Project, layer: Layer, time: number, message: string, history: EditRequest['history']): EditRequest | null {
  const clean = cleanLayer(layer)
  if (!clean) return null
  return {
    message: message.trim().slice(0, MAX_MESSAGE),
    history,
    project: {
      name: project.name,
      duration: project.duration,
      fps: project.fps,
      width: project.width,
      height: project.height,
      design: isDesign(project),
      camera: { position: project.camera.position, fov: project.camera.fov },
    },
    time,
    layer: clean,
    others: project.layers
      .filter((l) => l.id !== layer.id && !l.hidden)
      .slice(0, 30)
      .map((l) => ({ name: l.name, kind: l.kind, position: l.position, ...(l.kind === 'text' && l.text ? { text: l.text.slice(0, 60) } : {}) })),
  }
}

export async function requestLayerEdit(request: EditRequest): Promise<AiEditResponse> {
  if (!supabase) throw new AiRequestError('unavailable')
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new AiRequestError('signin')

  let res: Response
  try {
    res = await fetch('/api/ai/edit', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(request) })
  } catch {
    throw new AiRequestError('busy')
  }
  // Uç yoksa (Worker çalışmıyor, eski yayın) site kendi sayfasını döndürür: JSON değilse "kurulmadı" say.
  const body = (await res.json().catch(() => null)) as (Partial<AiEditResponse> & { error?: string }) | null
  if (!res.ok || !body || typeof body.reply !== 'string') {
    const code = CODES.find((c) => c === body?.error)
    throw new AiRequestError(code === 'unauthorized' ? 'signin' : (code ?? (res.ok || res.status === 404 ? 'not_configured' : 'failed')))
  }
  return { reply: body.reply, edit: body.edit ?? null, credits: body.credits }
}
