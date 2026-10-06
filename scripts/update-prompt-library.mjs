// Prompt kütüphanesini günceller: `public/prompts/library.json` + `public/prompts/<id>.{webp,mp4}`.
//
//   npm run prompts:update                 kaynak galeriyi yeniden tarar, yeni prompt'ları ekler
//   npm run prompts:update -- --dry        yalnızca neyin değişeceğini yazar, dosyalara dokunmaz
//   npm run prompts:update -- --from x.json   taramayı atlar, kayıtlı bir dökümü kullanır
//
// Kaynaklar:
//   1. prompt-motion.com (sürekli güncellenen galeri): her çalıştırmada baştan taranır.
//   2. github.com/yihui-dev/awesome-opus5-5-videos (MIT; `data/videos.json`): yalnızca tam prompt olarak işaretli
//      (`prompt_partial: false`), oyun olmayan ve en az 150 karakterlik kayıtlar. Boyut ve önizleme adresi
//      o listenin galerisinden (skillry.dev) okunur.
//   3. `scripts/prompt-extras.json`: elle seçilmiş ek prompt'lar (başka yerden bulduklarını buraya ekle:
//      id, handle, postUrl, prompt, width, height, date + `poster` ve `preview` indirme adresleri).
//   4. `scripts/prompt-blocklist.json`: kaldırılması istenen gönderilerin X adresleri ya da kimlikleri; bunlar bir daha eklenmez.
//
// Liste her seferinde baştan kurulur (aynı prompt'la yapılmış videolar tek kayıt, `uses`); listeden çıkan kayıtların
// medya dosyaları silinir. Kayıtlar X'te herkese açık paylaşılmış gönderilerden; galerinin kendi başlıkları alınmaz.
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dry = args.includes('--dry')
const fromFile = args.includes('--from') ? args[args.indexOf('--from') + 1] : undefined

const SOURCE = 'https://www.prompt-motion.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'
/** Bundan kısa prompt'lar ("Go all out.") tek başına işe yaramıyor. */
const MIN_LENGTH = 20
/** Galeri bundan az kayıt döndürürse sayfa yapısı değişmiştir: liste ezilmez. */
const MIN_SOURCE_CARDS = 150
/** İkinci kaynak: depo listesi + aynı listenin galerisi (boyut ve önizleme adresi yalnızca orada). */
const REPO_LIST = 'https://raw.githubusercontent.com/yihui-dev/awesome-opus5-5-videos/main/data/videos.json'
const REPO_GALLERY = 'https://skillry.dev/ai-videos/opus-5-5'
/** Depodan gelen prompt'ta alt sınır daha yüksek: orada kısa kayıtlar çoğunlukla gönderi yazısı. */
const REPO_MIN_LENGTH = 150
const MIN_REPO_ITEMS = 300
const ROUNDS = { 'One-shot': 'one', 'A few rounds': 'few', 'Many rounds': 'many' }

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const unescape = (text) => {
  try {
    return JSON.parse(`"${text}"`)
  } catch {
    return text
  }
}

async function page(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(SOURCE + path, { headers: { 'user-agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (error) {
      if (attempt === 3) throw new Error(`${path}: ${error.message}`)
      await sleep(1500 * (attempt + 1))
    }
  }
}

/** Sayfaya gömülü Next.js verisini (flight) düz metne çevirir; hiçbir şey çalıştırılmaz. */
function flight(html) {
  let out = ''
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)) out += unescape(match[1])
  return out
}

/** Uzun metinler `id:T<bayt uzunluğu>,<metin>` satırlarına alınıp "$id" ile anılır. */
function textChunks(data) {
  const buffer = Buffer.from(data, 'utf8')
  const chunks = {}
  for (const match of data.matchAll(/(?:^|\n)([0-9a-f]+):T([0-9a-f]+),/g)) {
    const start = Buffer.byteLength(data.slice(0, match.index + match[0].length), 'utf8')
    chunks[match[1]] = buffer.subarray(start, start + parseInt(match[2], 16)).toString('utf8')
  }
  return chunks
}

/** `"cards":` dizisini parantez sayarak keser. */
function cardsFrom(data) {
  const key = data.indexOf('"cards":')
  if (key < 0) return []
  const start = data.indexOf('[', key)
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < data.length; i++) {
    const c = data[i]
    if (inString) {
      if (escaped) escaped = false
      else if (c === '\\') escaped = true
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '[' || c === '{') depth++
    else if ((c === ']' || c === '}') && --depth === 0) return JSON.parse(data.slice(start, i + 1))
  }
  return []
}

function detailFrom(html) {
  const data = flight(html)
  const chunks = textChunks(data)
  const resolve = (value) => (/^\$[0-9a-f]+$/.test(value) && chunks[value.slice(1)] != null ? chunks[value.slice(1)] : value)
  const meta = {}
  for (const m of data.matchAll(/"dt",null,\{"className":"[^"]*","children":"([^"]+)"\}\],\["\$","dd",null,\{"className":"[^"]*","children":"((?:[^"\\]|\\.)*)"/g)) meta[m[1]] = unescape(m[2])
  const prompt = data.match(/"text":"((?:[^"\\]|\\.)*)","label":"Copy prompt"/)
  return {
    post: data.match(/"href":"(https:\/\/(?:x|twitter)\.com\/[^"/]+\/status\/\d+)"/)?.[1],
    prompt: prompt ? resolve(unescape(prompt[1])) : undefined,
    meta,
  }
}

async function scan() {
  const cards = cardsFrom(flight(await page('/')))
  if (cards.length < MIN_SOURCE_CARDS) throw new Error(`Galeriden yalnızca ${cards.length} kayıt okundu; sayfa yapısı değişmiş olabilir. Liste değiştirilmedi.`)
  let next = 0
  const worker = async () => {
    while (next < cards.length) {
      const card = cards[next++]
      Object.assign(card, detailFrom(await page(`/${card.slug}`)))
      await sleep(150)
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  const withPrompt = cards.filter((card) => card.prompt && card.post).length
  if (withPrompt < cards.length * 0.8) throw new Error(`Kayıtların yalnızca ${withPrompt}/${cards.length} tanesinde prompt okundu; sayfa yapısı değişmiş olabilir. Liste değiştirilmedi.`)
  return cards
}

async function get(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (error) {
      if (attempt === 3) throw new Error(`${url}: ${error.message}`)
      await sleep(1500 * (attempt + 1))
    }
  }
}

/**
 * Depodaki listeden kullanılabilir prompt'lar. Boyut ve önizleme galeri sayfasına gömülü veriden eşlenir
 * (kimlik: `slug`); galeride bulunamayan kayıt atlanır.
 */
async function scanRepo() {
  const list = JSON.parse(await get(REPO_LIST))
  if (!Array.isArray(list) || list.length < MIN_REPO_ITEMS) throw new Error(`Depo listesinde yalnızca ${list?.length} kayıt var; biçim değişmiş olabilir. Liste değiştirilmedi.`)
  const gallery = new Map()
  const html = await get(REPO_GALLERY)
  for (const match of html.matchAll(/\{slug:"([^"]+)",authorHandle:[\s\S]*?remakePreviewUrl:"[^"]*"\}/g)) {
    const width = Number(match[0].match(/,width:(\d+)/)?.[1])
    const height = Number(match[0].match(/,height:(\d+)/)?.[1])
    const preview = match[0].match(/,originalPreviewUrl:"([^"]+)"/)?.[1]
    if (width && height) gallery.set(match[1], { width, height, preview })
  }
  if (gallery.size < MIN_REPO_ITEMS) throw new Error(`Galeriden yalnızca ${gallery.size} kayıt okundu; sayfa yapısı değişmiş olabilir. Liste değiştirilmedi.`)
  return list
    .filter((item) => !item.prompt_partial && item.category !== 'interactive' && item.prompt?.length >= REPO_MIN_LENGTH && gallery.has(item.slug))
    .map((item) => ({ ...item, ...gallery.get(item.slug) }))
}

/** X gönderi kimliği zamanı taşır (snowflake): gönderinin paylaşıldığı gün. */
const postDate = (url) => new Date(Number((BigInt(tweetId(url)) >> 22n) + 1288834974657n)).toISOString().slice(0, 10)

const tweetId = (url) => String(url ?? '').match(/(?:status\/)?(\d{6,})$/)?.[1]
const entryId = (handle, url) => `${handle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${tweetId(url).slice(-6)}`
/** Satır sonu boşlukları ve üçten fazla boş satır temizlenir; içerik değişmez. */
const tidy = (text) =>
  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
/** Rakamlar sayılmaz: "15-second" ile "30-second" sürümleri aynı prompt. */
const fingerprint = (text) => text.toLowerCase().replace(/[^\p{L}]+/gu, ' ').trim()

const readJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (fallback !== undefined && error.code === 'ENOENT') return fallback
    throw error
  }
}

const mediaDir = join(root, 'public', 'prompts')
const libraryPath = join(mediaDir, 'library.json')
const previous = await readJson(libraryPath, [])
const extras = await readJson(join(root, 'scripts', 'prompt-extras.json'), [])
const blocked = new Set((await readJson(join(root, 'scripts', 'prompt-blocklist.json'), [])).map(tweetId))

console.log(fromFile ? `Döküm okunuyor: ${fromFile}` : `${SOURCE} taranıyor…`)
const source = fromFile ? await readJson(fromFile) : await scan()

const entries = []
const byPrompt = new Map()
const seenPosts = new Set()

function add(entry, media) {
  const post = tweetId(entry.postUrl)
  if (!post || seenPosts.has(post) || blocked.has(post)) return
  seenPosts.add(post)
  if (entry.prompt.length < MIN_LENGTH) return
  const key = fingerprint(entry.prompt)
  const first = byPrompt.get(key)
  if (first) {
    first.uses += 1
    return
  }
  const record = { ...entry, uses: 1 }
  byPrompt.set(key, record)
  entries.push({ record, media })
}

for (const item of source) {
  // eski dökümlerde prompt `copies` içinde
  const prompt = item.prompt ?? item.copies?.find((c) => c.label === 'Copy prompt')?.text
  if (!prompt || !item.post) continue
  add(
    {
      id: entryId(item.handle, item.post),
      handle: item.handle,
      postUrl: item.post,
      prompt: tidy(prompt),
      width: item.width,
      height: item.height,
      date: item.date,
      stack: item.meta?.Stack,
      effort: item.meta?.Effort?.toLowerCase(),
      rounds: ROUNDS[item.meta?.Iterations],
    },
    { poster: item.poster, preview: item.preview },
  )
}
// elle seçilenler depodakilerden önce: aynı gönderi iki yerde varsa elle temizlenmiş metin kalır
for (const { poster, preview, ...entry } of extras) add({ ...entry, prompt: tidy(entry.prompt) }, { poster, preview })

console.log('İkinci kaynak (GitHub deposu) okunuyor…')
for (const item of await scanRepo()) {
  if (!tweetId(item.post_url)) continue
  add(
    {
      id: entryId(item.author, item.post_url),
      handle: item.author,
      postUrl: item.post_url,
      prompt: tidy(item.prompt),
      width: item.width,
      height: item.height,
      date: postDate(item.post_url),
    },
    { poster: item.poster_url, preview: item.preview },
  )
}

if (new Set(entries.map((e) => e.record.id)).size !== entries.length) throw new Error('Kimlik çakışması')

const before = new Set(previous.map((p) => p.id))
const after = new Set(entries.map((e) => e.record.id))
const added = entries.filter((e) => !before.has(e.record.id)).map((e) => e.record)
const removed = previous.filter((p) => !after.has(p.id))
console.log(`${entries.length} prompt (önce ${previous.length}); yeni: ${added.length}, çıkan: ${removed.length}`)
for (const p of added) console.log(`  + @${p.handle}  ${p.prompt.slice(0, 70).replace(/\s+/g, ' ')}`)
for (const p of removed) console.log(`  - @${p.handle}  ${p.id}`)

if (dry) {
  console.log('--dry: dosyalar değiştirilmedi.')
  process.exit(0)
}

await mkdir(mediaDir, { recursive: true })

async function download(url, file) {
  try {
    if ((await stat(file)).size > 0) return true
  } catch {
    // dosya yok: indir
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await writeFile(file, Buffer.from(await res.arrayBuffer()))
      return true
    } catch (error) {
      if (attempt === 2) console.warn(`indirilemedi: ${url} (${error.message})`)
      else await sleep(1000 * (attempt + 1))
    }
  }
  return false
}

let next = 0
const worker = async () => {
  while (next < entries.length) {
    const { record, media } = entries[next++]
    if (!(media.poster && (await download(media.poster, join(mediaDir, `${record.id}.webp`))))) record.noPoster = true
    if (!(media.preview && (await download(media.preview, join(mediaDir, `${record.id}.mp4`))))) record.noPreview = true
  }
}
await Promise.all(Array.from({ length: 4 }, worker))

// listeden çıkan kayıtların dosyaları
let pruned = 0
for (const file of await readdir(mediaDir)) {
  const match = file.match(/^(.+)\.(webp|mp4)$/)
  if (match && !after.has(match[1])) {
    await unlink(join(mediaDir, file))
    pruned++
  }
}

const library = entries.map(({ record }) => {
  const clean = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined))
  if (clean.uses === 1) delete clean.uses
  return clean
})
await writeFile(libraryPath, `${JSON.stringify(library, null, 1)}\n`)
console.log(`Yazıldı: ${library.length} prompt; kapak eksik ${library.filter((p) => p.noPoster).length}, önizleme eksik ${library.filter((p) => p.noPreview).length}; silinen eski dosya ${pruned}.`)
console.log('Sonra: npm test, gözden geçir, commit ve yayın.')
