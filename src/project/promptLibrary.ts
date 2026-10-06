/**
 * Prompt kütüphanesi: Claude ile yapılmış hareketli videoların, yazarlarının X'te herkese açık paylaştığı prompt'ları.
 * Liste ve medya `public/prompts/` altında (`library.json`, `<id>.webp` kapak, `<id>.mp4` kısa sessiz önizleme);
 * `node scripts/build-prompt-library.mjs` üretir. Paket boyutuna girmesin diye sayfa açılınca indirilir.
 */
export interface LibraryPrompt {
  id: string
  /** Yazarın X kullanıcı adı (başında @ yok) */
  handle: string
  postUrl: string
  prompt: string
  /** Videonun piksel boyutu (kartın oranı için) */
  width: number
  height: number
  /** Listeye eklendiği gün, `YYYY-MM-DD` */
  date: string
  /** Yazarın kullandığını söylediği araç ("Remotion", "HTML + Playwright") */
  stack?: string
  effort?: string
  /** Kaç turda bitti: tek seferde / birkaç / çok */
  rounds?: 'one' | 'few' | 'many'
  /** Aynı prompt'la yapılmış video sayısı (yalnızca birden fazlaysa) */
  uses?: number
  noPoster?: boolean
  noPreview?: boolean
}

export type PromptFilter = 'all' | 'detailed' | 'oneShot' | 'landscape' | 'vertical'
export const PROMPT_FILTERS: PromptFilter[] = ['all', 'detailed', 'oneShot', 'landscape', 'vertical']

/** Kütüphanedeki bütün videolar bu modelle yapıldı (iki kaynak galeri de yalnızca bunu derliyor). */
export const PROMPT_MODEL = 'Claude Opus 5.5'

/** Bu uzunluktan sonrası "ayrıntılı": tek cümlelik istek değil, sahne sahne tarif. */
export const DETAILED_LENGTH = 600

const base = () => `${import.meta.env.BASE_URL}prompts/`
export const promptPosterUrl = (prompt: LibraryPrompt) => (prompt.noPoster ? undefined : `${base()}${prompt.id}.webp`)
export const promptPreviewUrl = (prompt: LibraryPrompt) => (prompt.noPreview ? undefined : `${base()}${prompt.id}.mp4`)

export function matchesPromptFilter(prompt: LibraryPrompt, filter: PromptFilter): boolean {
  switch (filter) {
    case 'detailed':
      return prompt.prompt.length >= DETAILED_LENGTH
    case 'oneShot':
      return prompt.rounds === 'one'
    case 'landscape':
      return prompt.width > prompt.height
    case 'vertical':
      return prompt.height > prompt.width
    default:
      return true
  }
}

export const promptSearchText = (prompt: LibraryPrompt) => `${prompt.handle} ${prompt.stack ?? ''} ${prompt.prompt}`

/**
 * Kartın oranı videonun kendi oranı; çok uzun ya da çok yayvan videolar sütunu bozmasın diye 9:16 – 2:1 arasında tutulur.
 */
export function promptCardRatio(prompt: LibraryPrompt): number {
  return Math.min(2, Math.max(9 / 16, prompt.width / prompt.height))
}

/** Yalnızca X gönderisi adresleri bağlantı olur (liste dışarıdan derlendi). */
export const isPostUrl = (url: string) => /^https:\/\/(x|twitter)\.com\/[^/]+\/status\/\d+$/.test(url)

let loading: Promise<LibraryPrompt[]> | undefined

/** Listeyi bir kez indirir; hata olursa sonraki çağrı yeniden dener. */
export function loadPromptLibrary(): Promise<LibraryPrompt[]> {
  loading ??= fetch(`${base()}library.json`)
    .then((res) => {
      if (!res.ok) throw new Error(`prompt library: HTTP ${res.status}`)
      return res.json() as Promise<LibraryPrompt[]>
    })
    .catch((error) => {
      loading = undefined
      throw error
    })
  return loading
}
