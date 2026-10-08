import Anthropic from '@anthropic-ai/sdk'
import { EDIT_SCHEMA, SYSTEM_PROMPT } from './edit'

/** Düzenleme isteklerini yanıtlayan model: kısa, sık ve gecikmeye duyarlı iş olduğu için Haiku. */
export const AI_MODEL = 'claude-haiku-5-5'

export type ModelFailure = 'refused' | 'busy' | 'not_configured' | 'failed'
export type ModelAnswer = { ok: true; output: unknown } | { ok: false; reason: ModelFailure }

/**
 * Kullanıcı mesajını (bağlam + istek) modele sorar; yanıt `EDIT_SCHEMA` biçiminde JSON'dur.
 * Sistem istemi her istekte aynı olduğu için önbelleğe alınır; değişen her şey kullanıcı mesajındadır.
 */
export async function askModel(apiKey: string, userMessage: string): Promise<ModelAnswer> {
  // Kutu tek satırlık ve kullanıcı bekliyor: uzun beklemek yerine bir kez yeniden dene, sonra hata ver.
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 25_000 })
  try {
    const response = await client.messages.create({
      model: AI_MODEL,
      // düşünme de bu sınıra sayılır; yanıtın kendisi birkaç yüz token
      max_tokens: 4096,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: EDIT_SCHEMA } },
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    })
    if (response.stop_reason === 'refusal') return { ok: false, reason: 'refused' }
    // Yanıt düşünme bloklarıyla başlayabilir: metni türüne göre bul.
    const text = response.content.find((block) => block.type === 'text')?.text
    if (response.stop_reason === 'max_tokens' || !text) return { ok: false, reason: 'failed' }
    return { ok: true, output: JSON.parse(text) as unknown }
  } catch (err) {
    if (err instanceof SyntaxError) return { ok: false, reason: 'failed' }
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('ai: the Anthropic API key was rejected', err.status)
      return { ok: false, reason: 'not_configured' }
    }
    if (err instanceof Anthropic.RateLimitError) return { ok: false, reason: 'busy' }
    if (err instanceof Anthropic.APIConnectionError) return { ok: false, reason: 'busy' }
    if (err instanceof Anthropic.APIError) {
      console.error('ai: Anthropic API error', err.status, err.message)
      return { ok: false, reason: err.status !== undefined && err.status >= 500 ? 'busy' : 'failed' }
    }
    throw err
  }
}
