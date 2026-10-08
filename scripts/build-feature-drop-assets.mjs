// "Feature drop" şablonunun görselleri ve telefon ekranı videoları (public/templates/feature-drop):
//   node scripts/build-feature-drop-assets.mjs
// HTML → başsız Chrome (CDP) → saydam PNG / kare kare JPG → ffmpeg. Ölçüler 1080×1350 kadrajın pikselinde,
// PNG'ler 2 kat çözünürlükte. Hepsi bizim tasarımımız: Mango Studio'nun prompt kütüphanesi (temsili mobil arayüz),
// kendi şablon kapaklarımız, logo public/brand. Renkli öğeler (halkalar, etiket, cam kart, bantlar, ışık) BEYAZ çizilir
// ve sahnede katman rengiyle boyanır (tint): renkler editörden değişir.
// Betik ayrıca şablondaki kelimelerin genişliklerini (DM Sans 400 / 700, em) ölçüp src/project/featureDropMetrics.ts'e yazar.
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/feature-drop'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'feature-drop-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)
const only = process.argv.slice(2) // adlar verilirse yalnızca onlar üretilir (ör. `screens`, `peel`)
const want = (group) => only.length === 0 || only.includes(group)

const FONTS = `
@font-face { font-family: DM; font-weight: 400; src: url(${font('dm-sans-400.woff')}); }
@font-face { font-family: DM; font-weight: 700; src: url(${font('dm-sans-700.woff')}); }
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }`
const page = (w, h, body, css = '', script = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}
* { box-sizing: border-box; }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
.abs { position: absolute; }
${css}
</style></head><body>${body}${script ? `<script>${script}</script>` : ''}</body></html>`

// --- CDP
const PORT = 9347
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, 'about:blank'])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  target = await fetch(`http://127.0.0.1:${PORT}/json`).then((res) => res.json(), () => []).then((list) => list.find((t) => t.type === 'page'))
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => (ws.onopen = resolve))
let seq = 0
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  pending.get(message.id)?.(message)
  pending.delete(message.id)
}
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 600))
  return res.result?.result?.value
}
let n = 0
async function open(w, h, html, scale) {
  const file = path.join(TMP, `p${++n}.html`)
  fs.writeFileSync(file, html)
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false })
  await send('Page.navigate', { url: pathToFileURL(file).href })
  await sleep(350)
  await evaluate('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => 0)))).then(() => 1)')
  await sleep(120)
}
const grab = async (w, h, format = 'png') => Buffer.from((await send('Page.captureScreenshot', { format, quality: 93, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })).result.data, 'base64')
/** saydam PNG */
async function shoot(name, w, h, body, { scale = 2, css = '', script = '' } = {}) {
  await open(w, h, page(w, h, body, css, script), scale)
  fs.writeFileSync(`${OUT}/${name}.png`, await grab(w, h))
  console.log(name, `${Math.round(w * scale)}×${Math.round(h * scale)}`)
}

// --- metinler (src/i18n/locales ile aynı olmalı)
const COPY = {
  en: {
    title: 'Launch ad', by: 'by mango', copies: 'copies', feed: 'Feed', prompts: 'Prompts (128)', about: 'About', badge: 'Prompt', date: 'Oct 7',
    live: 'Launch ad prompt is now live.', older: '3 older', c1n: 'ayla.motion', c1d: 'Oct 6, 4:12 PM', c1a: 'this is the cleanest launch ad I have seen.', c1b: 'pasted the prompt into Claude and had my own version in a few minutes.',
    c2n: 'deniz', c2d: 'Oct 6, 2:40 PM', c2a: 'swapped the colors and the copy.', c2b: 'everything stays editable on the timeline.', c3n: 'mango', c3d: 'Oct 5, 6:40 AM', c3a: 'one prompt, one take', c3b: 'no keyframes were harmed in the making of this ad', cta: 'Copy prompt',
    details: 'Prompt details', lines: '42 lines', p1n: 'mango', p1m: 'Claude · 33 s', p1t: 'Turn a product walkthrough into a 33-second launch ad…', p1v: '1,284', p1c: '+12.4%',
    p2n: 'Scene notes', p2m: '17 scenes · 60 fps', p2t: 'Light background, mango accents, 3D phones', p2v: '4K', p2c: 'export',
    r1: 'ayla.motion', r1m: 'used 2 h ago', r1v: '312 copies', r2: 'deniz', r2m: 'used 5 h ago', r2v: '208 copies', r3: 'studio.kai', r3m: 'used yesterday', r3v: '164 copies', friends: 'Following (7)',
    app: 'Mango Studio', notif: 'New prompts just dropped. Copy one and make it yours.', now: 'now', made: 'videos made',
  },
  tr: {
    title: 'Lansman reklamı', by: 'mango', copies: 'kopya', feed: 'Akış', prompts: 'Prompt (128)', about: 'Hakkında', badge: 'Prompt', date: '7 Eki',
    live: 'Lansman reklamı prompt’u yayında.', older: '3 eski', c1n: 'ayla.motion', c1d: '6 Eki, 16:12', c1a: 'gördüğüm en temiz lansman reklamı.', c1b: 'prompt’u Claude’a yapıştırdım, birkaç dakikada kendi sürümüm hazırdı.',
    c2n: 'deniz', c2d: '6 Eki, 14:40', c2a: 'renkleri ve metni değiştirdim.', c2b: 'her şey zaman çizelgesinde düzenlenebilir kalıyor.', c3n: 'mango', c3d: '5 Eki, 06:40', c3a: 'tek prompt, tek çekim', c3b: 'bu reklamın yapımında hiçbir anahtar kare zarar görmedi', cta: 'Prompt’u kopyala',
    details: 'Prompt ayrıntıları', lines: '42 satır', p1n: 'mango', p1m: 'Claude · 33 sn', p1t: 'Ürün turunu 33 saniyelik lansman reklamına çevir…', p1v: '1.284', p1c: '+%12,4',
    p2n: 'Sahne notları', p2m: '17 sahne · 60 fps', p2t: 'Açık zemin, mango vurgular, 3D telefonlar', p2v: '4K', p2c: 'çıktı',
    r1: 'ayla.motion', r1m: '2 sa önce kullandı', r1v: '312 kopya', r2: 'deniz', r2m: '5 sa önce kullandı', r2v: '208 kopya', r3: 'studio.kai', r3m: 'dün kullandı', r3v: '164 kopya', friends: 'Takip edilenler (7)',
    app: 'Mango Studio', notif: 'Yeni prompt’lar geldi. Birini kopyala, kendine uyarla.', now: 'şimdi', made: 'video yapıldı',
  },
}
// şablondaki yazılar (genişlikleri ölçülür): sekmeler ve kapanış satırı
const WORDS = [
  'Feed', 'Prompts (128)', 'About', 'Prompt details', 'Akış', 'Prompt (128)', 'Hakkında', 'Prompt ayrıntıları', 'Prompt',
  'now live on', 'şimdi yayında:', 'mangostudio.design', 'Launch ad', 'Lansman reklamı', 'Oct 7', '7 Eki', ' ', 'Launch ad prompt is now live.', 'Lansman reklamı prompt’u yayında.',
]

fs.mkdirSync(OUT, { recursive: true })
const mark = url('public/brand/mango-mark.png')
const logo = url('public/brand/mango-logo-2048.png')
const poster = (id) => url(`public/templates/posters/${id}.jpg`)
const SPARK = (c = '#fff') => `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.2c1 5.8 5 9.8 10.8 10.8-5.8 1-9.8 5-10.8 10.8C11 17 7 13 1.2 12 7 11 11 7 12 1.2Z" fill="${c}"/></svg>`

try {
  await send('Page.enable')
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })

  // --- kelime genişlikleri
  if (want('metrics')) {
    await open(10, 10, page(10, 10, '<span style="font-family:DM;font-weight:400">a</span><span style="font-family:DM;font-weight:700">a</span>'), 1)
    const data = await evaluate(`(() => { const ctx = document.createElement('canvas').getContext('2d'); const out = {};
      for (const w of ${JSON.stringify([...new Set(WORDS)])}) { ctx.font = '400 1000px DM'; const a = ctx.measureText(w).width / 1000; ctx.font = '700 1000px DM'; out[w] = [Math.round(a * 1e4) / 1e4, Math.round(ctx.measureText(w).width * 10) / 1e4]; }
      return out })()`)
    const lines = Object.entries(data).map(([w, [a, b]]) => `  ${JSON.stringify(w)}: [${a}, ${b}],`).join('\n')
    fs.writeFileSync('src/project/featureDropMetrics.ts', `// node scripts/build-feature-drop-assets.mjs ile üretilir; elle düzenleme.\n// Yazı ilerleme genişlikleri (em): [DM Sans 400, DM Sans 700]\nexport const DROP_EM: Record<string, [number, number]> = {\n${lines}\n}\n`)
    console.log('metrics', Object.keys(data).length)
  }

  if (want('parts')) {
    // --- logo: tek renk (beyaz), bantlar parlaklıktan saydamlığa çevrilir (luminance maskesi) → sahnede boyanır
    await shoot('logo', 500, 500, `
      <div class="abs" style="inset:0;background:#fff;opacity:.5;mask:url(${logo}) -250px -193px/1000px 1000px no-repeat"></div>
      <div class="abs" style="inset:0;background:#fff;mask:url(${logo}) -250px -193px/1000px 1000px no-repeat;mask-mode:luminance"></div>`)
    // --- açılış halkaları: iki elips (∞ gibi), ince çizgi; ve arkalarındaki yumuşak gölge
    const lobes = (inner) => `<svg class="abs" style="inset:0" viewBox="0 0 1200 760">${[-1, 1].map((s) => `<g transform="translate(${600 + s * 250} 380) rotate(${s * 24})">${inner}</g>`).join('')}</svg>`
    await shoot('lobes', 1200, 760, lobes('<ellipse rx="318" ry="205" fill="none" stroke="#fff" stroke-opacity=".62" stroke-width="2.2"/><ellipse rx="230" ry="148" cx="-20" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.6"/>'), { scale: 1.5 })
    await shoot('lobes-shade', 1200, 760, lobes('<ellipse rx="215" ry="140" cx="-25" fill="#fff" fill-opacity=".85"/>'), { scale: 1, css: 'svg { filter: blur(26px); }' })
    // --- kenar dalgaları (2. sahne) ve geniş yaylar (5. ve 11. sahne)
    const rings = (cx, cy, radii) => radii.map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" fill-opacity=".035" stroke="#fff" stroke-opacity=".2" stroke-width="1.6"/>`).join('')
    await shoot('ripples', 1080, 1350, `<svg class="abs" style="inset:0" viewBox="0 0 1080 1350">
      ${rings(-420, 675, [470, 520, 570, 620])}${rings(1500, 675, [470, 520, 570, 620])}${rings(540, -560, [640, 700, 760, 820])}${rings(540, 1910, [640, 700, 760, 820])}</svg>`, { scale: 1.5 })
    await shoot('arcs', 1500, 1700, `<svg class="abs" style="inset:0" viewBox="0 0 1500 1700">${rings(-250, 2700, [1500, 1690, 1880, 2070, 2260, 2450, 2640, 2830])}</svg>`, { scale: 1.2 })
    await shoot('blob', 512, 512, '<div class="abs" style="inset:0;background:radial-gradient(closest-side, rgba(255,255,255,.95), rgba(255,255,255,.55) 30%, rgba(255,255,255,.16) 62%, rgba(255,255,255,0))"></div>', { scale: 1 })
    await shoot('spark', 64, 64, SPARK(), { scale: 8 })
    // --- etiket plakası (beyaz, boyanır) ve gölgesi
    await shoot('badge', 760, 420, '<div class="abs" style="left:60px;top:60px;width:640px;height:300px;border-radius:66px;background:linear-gradient(180deg,#fff 0%,rgba(255,255,255,.9) 100%);box-shadow:inset 0 3px 0 rgba(255,255,255,.9), inset 0 -4px 10px rgba(255,255,255,.35)"></div>')
    await shoot('badge-shadow', 900, 560, '<div class="abs" style="left:150px;top:150px;width:600px;height:260px;border-radius:66px;background:#fff;filter:blur(38px);opacity:.75"></div>', { scale: 1 })
    await shoot('chev', 48, 48, '<svg class="abs" style="inset:0" viewBox="0 0 48 48"><path d="M10 18 L24 32 L38 18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>', { scale: 2 })
    // telefon solarken gövdesi saydamlaşmasın diye önüne çekilen zemin kopyası (proje degradesiyle aynı: BG_TOP → BG_BOTTOM)
    await shoot('veil', 1200, 1500, '<div class="abs" style="inset:0;background:linear-gradient(180deg, #5365EF 5%, #B2BCF5 95%)"></div>', { scale: 1 })
    // --- yatay ışık bandı (10. sahne): beyaz, boyanır
    await shoot('band', 1600, 96, '<div class="abs" style="inset:0;background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.75) 55%, rgba(255,255,255,1) 70%, rgba(255,255,255,0))"></div>', { scale: 1 })
    await shoot('band-wide', 1600, 96, '<div class="abs" style="inset:0;background:linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.9) 30%, rgba(255,255,255,.6) 75%, rgba(255,255,255,0))"></div>', { scale: 1 })
  }

  // --- etiketin üstündeki koruyucu yaprağın soyulması: 31 kare (her biri bir video karesi), beyaz → boyanır
  if (want('peel')) {
    const W = 900, H = 600
    await open(W, H, page(W, H, `<canvas id="c" width="${W * 2}" height="${H * 2}" style="width:${W}px;height:${H}px"></canvas>`, '', `
      const c = document.getElementById('c'), g = c.getContext('2d')
      const PW = 640, PH = 300, R = 66, X0 = (${W} - PW) / 2, Y0 = (${H} - PH) / 2
      const plate = () => { g.beginPath(); g.roundRect(X0, Y0, PW, PH, R) }
      // katlama çizgisi: dikeyden 16° yatık, soldan sağa ilerler. p = 0 yaprak neredeyse tamamen soyulmuş değil; 1 = gitmiş
      window.draw = (p) => {
        g.setTransform(2, 0, 0, 2, 0, 0); g.clearRect(0, 0, ${W}, ${H})
        const a = 16 * Math.PI / 180, nx = Math.cos(a), ny = -Math.sin(a)      // çizginin normali (sağa doğru)
        const d0 = X0 - 150, d1 = X0 + PW + 190
        const d = d0 + (d1 - d0) * p                                             // çizginin y = orta hizasındaki x'i
        const cx = d, cy = ${H} / 2
        const side = (sign) => { g.beginPath(); const L = 2000, tx = -ny, ty = nx
          g.moveTo(cx + tx * L, cy + ty * L); g.lineTo(cx - tx * L, cy - ty * L); g.lineTo(cx - tx * L + sign * nx * L, cy - ty * L + sign * ny * L); g.lineTo(cx + tx * L + sign * nx * L, cy + ty * L + sign * ny * L); g.closePath() }
        // 1) henüz soyulmamış kısım (çizginin sağı): buzlu yaprak
        g.save(); side(1); g.clip(); plate(); g.fillStyle = 'rgba(255,255,255,.62)'; g.fill(); g.restore()
        // 2) kıvrılan kısım: çizginin solundaki yaprak çizgiye göre yansıtılır, kıvrım olduğu için enine daraltılır
        g.save(); side(1); g.clip()
        g.translate(cx, cy)
        // yansıtma + normal yönünde 0.62 kat sıkıştırma: M = I - (1 + k) n nᵀ
        const k = 0.62, m = 1 + k
        g.transform(1 - m * nx * nx, -m * nx * ny, -m * nx * ny, 1 - m * ny * ny, 0, 0)
        g.translate(-cx, -cy)
        g.shadowColor = 'rgba(255,255,255,.35)'; g.shadowBlur = 30
        plate(); g.fillStyle = '#fff'; g.fill(); g.restore()
        // kıvrımın silindir gölgesi: çizgiden uzaklaştıkça açılan hafif ton (boyanınca da okunur)
        g.save(); side(1); g.clip(); g.translate(cx, cy); g.transform(1 - m * nx * nx, -m * nx * ny, -m * nx * ny, 1 - m * ny * ny, 0, 0); g.translate(-cx, -cy); plate(); g.clip()
        g.setTransform(2, 0, 0, 2, 0, 0)
        const grad = g.createLinearGradient(cx, cy, cx + nx * 190, cy + ny * 190)
        grad.addColorStop(0, 'rgba(160,170,235,.55)'); grad.addColorStop(.22, 'rgba(255,255,255,0)'); grad.addColorStop(.75, 'rgba(255,255,255,0)'); grad.addColorStop(1, 'rgba(170,180,240,.4)')
        g.fillStyle = grad; g.fillRect(0, 0, ${W}, ${H}); g.restore()
      }
      draw(0)`), 1)
    for (let i = 0; i < 31; i++) {
      // hızlı başlar, sonu yavaş (referans: 288–318)
      const p = 1 - (1 - i / 30) ** 1.5
      await evaluate(`draw(${0.2 + 0.74 * p}); 1`)
      fs.writeFileSync(`${OUT}/peel-${String(i).padStart(2, '0')}.png`, await grab(W, H))
    }
    console.log('peel', 31)
  }

  // --- gözler (açılış ve kapanış): iki yumurta biçimli göz akı + göz bebekleri, ayrı görseller (ikisi de beyaz → boyanır).
  // Kırpma 5 durum (0–3 kapanırken, 4 kapalı: aşağı kıvrık çizgi); kapanışta gözler 16 karede mango amblemine dönüşür
  // (iki biçimin işaretli uzaklık alanları arasında geçiş). Kadraj logo.png ile aynı (500×500): katmanlar üst üste oturur.
  if (want('eyes')) {
    const S = 500
    await open(S, S, page(S, S, `<canvas id="c" width="${S * 2}" height="${S * 2}" style="width:${S}px;height:${S}px"></canvas><img id="logo" src="${url(`${OUT}/logo.png`)}" style="display:none">`, '', `
      const c = document.getElementById('c'), g = c.getContext('2d', { willReadFrequently: true }), N = ${S * 2}
      const E = [{ x: 152, y: 278, r: -7 }, { x: 348, y: 278, r: 7 }], RX = 84, RY = 106
      const reset = () => { g.setTransform(2, 0, 0, 2, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, ${S}, ${S}); g.fillStyle = '#fff'; g.strokeStyle = '#fff' }
      // göz akı: kapanırken dikeyde basılır, biraz genişler ve aşağı iner
      const white = (e, open) => { g.translate(e.x, e.y + (1 - open) * 16); g.rotate(e.r * Math.PI / 180); g.scale(1 + (1 - open) * 0.08, open); g.beginPath(); g.ellipse(0, 0, RX, RY, 0, 0, 7) }
      window.whites = (open) => { reset(); for (const e of E) { g.save()
        if (open > 0) { white(e, open); g.fill() }
        else { g.translate(e.x, e.y + 16); g.rotate(e.r * Math.PI / 180); g.beginPath(); g.moveTo(-RX * 1.06, -9); g.quadraticCurveTo(0, 27, RX * 1.06, -9); g.lineWidth = 17; g.lineCap = 'round'; g.stroke() }
        g.restore() } }
      // göz bebeği: göz akının içinde kalır (kırpılır), sağ üstünde ışık noktası (delik: alttaki göz akı görünür)
      window.pupils = (open) => { reset(); for (const e of E) { g.save(); white(e, open); g.clip()
        g.beginPath(); g.ellipse(0, 5, 38, 49, 0, 0, 7); g.fill()
        g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(14, -14, 10.5, 0, 7); g.fill(); g.restore(); g.globalCompositeOperation = 'source-over' } }
      // işaretli uzaklık alanı (Felzenszwalb): içeride eksi, dışarıda artı
      const INF = 1e12
      const edt1 = (f, n, d, v, z) => { let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF
        for (let q = 1; q < n; q++) { let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
          while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]) }
          k++; v[k] = q; z[k] = s; z[k + 1] = INF }
        k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]] } }
      const dist = (m, target) => { const out = new Float64Array(N * N), f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1)
        for (let x = 0; x < N; x++) { for (let y = 0; y < N; y++) f[y] = m[y * N + x] === target ? 0 : INF; edt1(f, N, d, v, z); for (let y = 0; y < N; y++) out[y * N + x] = d[y] }
        for (let y = 0; y < N; y++) { for (let x = 0; x < N; x++) f[x] = out[y * N + x]; edt1(f, N, d, v, z); for (let x = 0; x < N; x++) out[y * N + x] = Math.sqrt(d[x]) }
        return out }
      const sdf = () => { const px = g.getImageData(0, 0, N, N).data, m = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) m[i] = px[i * 4 + 3] > 90 ? 1 : 0
        const a = dist(m, 1), b = dist(m, 0), out = new Float32Array(N * N); for (let i = 0; i < N * N; i++) out[i] = m[i] ? 0.5 - b[i] : a[i] - 0.5; return out }
      let A, B
      window.init = async () => { const logo = document.getElementById('logo'); await logo.decode(); whites(1); A = sdf(); reset(); g.drawImage(logo, 0, 0, ${S}, ${S}); B = sdf(); return 1 }
      window.morph = (t) => { const img = g.createImageData(N, N), px = img.data
        for (let i = 0; i < N * N; i++) { const d = A[i] * (1 - t) + B[i] * t, a = Math.min(1, Math.max(0, 0.5 - d / 1.6)); px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 255; px[i * 4 + 3] = a * 255 }
        g.putImageData(img, 0, 0) }
      whites(1)`), 2)
    await evaluate('window.init()')
    const save = async (name, call) => { await evaluate(`${call}; 1`); fs.writeFileSync(`${OUT}/${name}.png`, await grab(S, S)) }
    await save('eye-w', 'whites(1)')
    await save('eye-p', 'pupils(1)')
    const OPEN = [0.8, 0.55, 0.32, 0.16]
    for (let i = 0; i < 4; i++) { await save(`eye-w-${i}`, `whites(${OPEN[i]})`); await save(`eye-p-${i}`, `pupils(${OPEN[i]})`) }
    await save('eye-w-4', 'whites(0)')
    for (let i = 1; i <= 16; i++) { const t = i / 16; await save(`eye-m-${String(i).padStart(2, '0')}`, `morph(${t * t * t * (t * (t * 6 - 15) + 10)})`) }
    console.log('eyes', 27)
  }

  // --- cam kart (5–7. sahne): gövde ve başlık şeridi kare kare (beyaz → boyanır). Sekmenin arkasındaki hap küçük karta
  // büyür (18 kare), küçük kart büyük karta açılırken kenarları sıvı gibi dalgalanır (30 kare). Kadraj 1040×640,
  // ortası kadrajın (540, 700) noktası. İçerik parçaları aynı kadrajda ayrı görseller (dile göre).
  const CW = 1040, CH = 640
  // küçük kart 944×184 (orta y 320), büyük kart 780×544 (orta y 322); başlık şeridi 90
  const SMALL = { x: 48, y: 228, w: 944, h: 184 }
  const BIG = { x: 130, y: 50, w: 780, h: 544, head: 90 }
  if (want('card')) {
    await open(CW, CH, page(CW, CH, `<canvas id="c" width="${CW * 2}" height="${CH * 2}" style="width:${CW}px;height:${CH}px"></canvas>`, '', `
      const c = document.getElementById('c'), g = c.getContext('2d')
      const mix = (a, b, t) => a + (b - a) * t
      const back = (t, k) => { t = Math.min(1, Math.max(0, t)); const u = t - 1; return 1 + (k + 1) * u * u * u + k * u * u }
      const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
      // köşeleri yuvarlak dikdörtgenin çevresi; her nokta normali boyunca dalga kadar kaydırılır
      const rr = (cx, cy, w, h, r, amp, ph) => { const pts = [], hw = w / 2 - r, hh = h / 2 - r, L = 4 * hw + 4 * hh + 2 * Math.PI * r; let acc = 0
        const push = (x, y, nx, ny, ds) => { const s = acc / L * 2 * Math.PI, o = amp * (0.6 * Math.sin(3 * s + ph) + 0.4 * Math.sin(5 * s - 1.7 * ph + 1)); pts.push([cx + x + nx * o, cy + y + ny * o]); acc += ds }
        const side = (x0, y0, x1, y1, nx, ny) => { const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 5)); for (let i = 0; i < n; i++) push(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, nx, ny, len / n) }
        const corner = (ox, oy, a0) => { for (let i = 0; i < 10; i++) { const a = a0 + Math.PI / 2 * i / 10; push(ox + r * Math.cos(a), oy + r * Math.sin(a), Math.cos(a), Math.sin(a), Math.PI / 2 * r / 10) } }
        side(-hw, -h / 2, hw, -h / 2, 0, -1); corner(hw, -hh, -Math.PI / 2); side(w / 2, -hh, w / 2, hh, 1, 0); corner(hw, hh, 0)
        side(hw, h / 2, -hw, h / 2, 0, 1); corner(-hw, hh, Math.PI / 2); side(-w / 2, hh, -w / 2, -hh, -1, 0); corner(-hw, -hh, Math.PI)
        const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p }
      const pill = (i) => { const u = back(i / 17, 0.9); return { p: rr(mix(527, 520, u), mix(270, 320, u), mix(316, 944, u), mix(76, 184, u), mix(22, 28, u), 3.5 * Math.sin(Math.PI * Math.min(1, i / 17)), i * 0.5) } }
      // boyut: yavaş başlar, 14 karede yerine varır, hafifçe taşıp geri döner (referans: 714–726); dalga ortada en büyük
      const grow = (i) => { const u = ss(0, 14, i) + 0.04 * Math.sin(Math.PI * Math.min(1, Math.max(0, (i - 9) / 13))), env = ss(2, 9, i) * (1 - ss(13, 29, i)), cy = mix(320, 322, u), h = mix(184, 544, u)
        return { p: rr(520, cy, mix(944, 780, u), h, mix(28, 30, u), 10 * env, i * 0.42), top: cy - h / 2 } }
      const reset = () => { g.setTransform(2, 0, 0, 2, 0, 0); g.globalAlpha = 1; g.shadowColor = 'transparent'; g.clearRect(0, 0, ${CW}, ${CH}); g.fillStyle = '#fff' }
      const fill = (s) => { reset(); g.shadowColor = 'rgba(255,255,255,.2)'; g.shadowBlur = 60; g.shadowOffsetY = 36; g.fill(s.p) }
      window.pillBody = (i) => fill(pill(i))
      window.growBody = (i) => fill(grow(i))
      window.growHead = (i) => { const s = grow(i); reset(); g.save(); g.clip(s.p); g.globalAlpha = ss(3, 13, i); g.fillRect(0, s.top - 30, ${CW}, 30 + ${BIG.head}); g.restore() }
      // açılırken kartın üzerinden geçen ışık: sağ altta parlak leke, üst kenarda ince çizgi (beyaz, boyanmaz)
      window.sheen = () => { const s = grow(29); reset(); g.save(); g.clip(s.p)
        let r = g.createRadialGradient(830, 590, 0, 830, 590, 330); r.addColorStop(0, 'rgba(255,255,255,.95)'); r.addColorStop(.35, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, ${CW}, ${CH})
        r = g.createRadialGradient(330, 330, 0, 330, 330, 260); r.addColorStop(0, 'rgba(255,255,255,.22)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, ${CW}, ${CH})
        g.restore() }
      pillBody(0)`), 1.5)
    const save = async (name, call) => { await evaluate(`${call}; 1`); fs.writeFileSync(`${OUT}/${name}.png`, await grab(CW, CH)) }
    for (let i = 0; i < 18; i++) await save(`card-p-${String(i).padStart(2, '0')}`, `pillBody(${i})`)
    for (let i = 0; i < 30; i++) { await save(`card-g-${String(i).padStart(2, '0')}`, `growBody(${i})`); await save(`card-h-${String(i).padStart(2, '0')}`, `growHead(${i})`) }
    await save('card-sheen', 'sheen()')
    console.log('card', 79)
  }
  // kartın içeriği: küçük karttaki tek satır, büyük karttaki iki kayıt, başlığın sağındaki sayı. Telefon ekranındaki
  // kart da aynı yerleşimden üretilir (koyu renklerle), böylece havadaki kart ekrandakinin tam üstüne oturur.
  const avatar = (s) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;border-radius:50%;background:#0B0B0D;flex:none"><img src="${mark}" style="width:${s * 0.66}px;height:${s * 0.66}px;object-fit:contain"></span>`
  const HEART = '<svg width="24" height="22" viewBox="0 0 24 22" style="vertical-align:-4px;margin-right:8px"><path d="M12 20.5C5.5 15.6 2 12.2 2 7.9 2 4.9 4.3 2.6 7.2 2.6c1.9 0 3.7 1 4.8 2.6 1.1-1.6 2.9-2.6 4.8-2.6C19.7 2.6 22 4.9 22 7.9c0 4.3-3.5 7.7-10 12.6Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>'
  const CLOCK = '<svg width="24" height="24" viewBox="0 0 24 24" style="vertical-align:-5px;margin-right:8px"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 6.8V12l3.4 2.2" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>'
  /** büyük karttaki kayıt: (left, top) kartın sol üst köşesine göre; genişlik 720 */
  const cardEntry = (left, top, name, meta, text, v, ch, likes, up = '#fff') => `<div class="abs" style="left:${left}px;top:${top}px;width:720px;color:#fff;font-family:Inter">
    <div style="display:flex;gap:20px;align-items:flex-start">${avatar(64)}<div style="flex:1"><div style="display:flex;justify-content:space-between;font:600 29px/34px Inter"><span>${name}</span><span>${v}</span></div>
    <div style="display:flex;justify-content:space-between;font:400 22px/28px Inter;margin-top:3px"><span style="opacity:.78">${CLOCK}${meta}</span><span style="color:${up};opacity:${up === '#fff' ? 0.9 : 1}">▲ ${ch}</span></div></div></div>
    <div style="margin:4px 0 0 31px;width:36px;height:30px;border-left:2.5px solid rgba(255,255,255,.4);border-bottom:2.5px solid rgba(255,255,255,.4);border-radius:0 0 0 16px"></div>
    <div style="margin:-22px 0 0 84px;font:400 27px/34px Inter;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</div>
    <div style="margin:10px 0 0 84px;font:500 22px/26px Inter;opacity:.82">${HEART}${likes}</div></div>`
  const cardEntries = (c, x, y, up) => [cardEntry(x + 30, y + 110, c.p1n, c.p1m, c.p1t, c.p1v, c.p1c, 965, up), cardEntry(x + 30, y + 326, c.p2n, c.p2m, c.p2t, c.p2v, c.p2c, 492, up)]

  for (const lang of ['en', 'tr']) {
    const c = COPY[lang]
    if (want('card')) {
      const two = { scale: 2 }
      await shoot(`card-row-${lang}`, CW, CH, `<div class="abs" style="left:${SMALL.x + 30}px;top:${SMALL.y + 100}px;width:${SMALL.w - 60}px;height:56px;display:flex;align-items:center;gap:16px;font:400 32px Inter;color:#fff;white-space:nowrap;overflow:hidden">${avatar(48)}<b style="font-weight:600">${c.p1n}:</b><span style="opacity:.95;overflow:hidden;text-overflow:ellipsis">${c.p1t}</span></div>`, two)
      const [e1, e2] = cardEntries(c, BIG.x, BIG.y)
      await shoot(`card-e1-${lang}`, CW, CH, e1, two)
      await shoot(`card-e2-${lang}`, CW, CH, e2, two)
      // başlığın sağındaki sayı: küçük kartın başlığındaki yerinde çizilir (sağ kenarı okun solunda), sahnede kartla birlikte taşınır
      await shoot(`card-meta-${lang}`, CW, CH, `<div class="abs" style="right:${CW - (SMALL.x + SMALL.w - 76)}px;top:${SMALL.y + 52 - 20}px;height:40px;line-height:40px;font:500 27px/40px Inter;color:#fff;white-space:nowrap">${c.lines}</div>`, two)
    }
    // --- 3. sahnenin bulanık alt yazısı (odak dışı): net metin katmanına solar
    if (want('parts')) {
      await shoot(`live-blur-${lang}`, 3300, 480, `<div class="abs" style="left:100px;top:0;height:480px;line-height:480px;font-family:DM;font-weight:400;font-size:215px;color:#fff;white-space:nowrap;filter:blur(15px)">${c.live}</div>`, { scale: 0.75 })
    }

    // --- telefon ekranları (css 390×848): temsili Mango Studio mobil arayüzü, koyu + mango vurgular
    if (want('screens')) {
      const CSS = `
        body { background: #0A0A0B; color: #F4F1EC; font-family: Inter; }
        .dim { color: #8E877C; } .or { color: #FF7A00; } .row { display: flex; align-items: center; }
        .tag { display: inline-block; padding: 1px 6px; border-radius: 6px; background: #F7C6EC; color: #D62FC0; font: 700 10px Inter; }
        .av { width: 26px; height: 26px; border-radius: 50%; background: #17171A; display: inline-flex; align-items: center; justify-content: center; flex: none; }
        .av img { width: 17px; height: 17px; object-fit: contain; }
        .a2 { background: linear-gradient(135deg, #FFB21E, #FF7A00); } .a3 { background: linear-gradient(135deg, #46A83F, #B7D84A); } .a4 { background: linear-gradient(135deg, #F04E37, #FFB21E); }`
      const status = `<div class="abs row" style="left:0;top:0;width:390px;height:50px;padding:14px 30px 0;justify-content:space-between;font:600 15px Inter"><span>9:41</span><span class="row" style="gap:6px"><svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#fff"/><rect x="5" y="5" width="3" height="7" rx="1" fill="#fff"/><rect x="10" y="2.5" width="3" height="9.5" rx="1" fill="#fff"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#fff"/></svg><svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="#fff" opacity=".5"/><rect x="2" y="2" width="19" height="8" rx="2" fill="#fff"/><rect x="24" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".6"/></svg></span></div>`
      const header = `<div class="abs row" style="left:16px;top:58px;width:358px;gap:10px"><span class="dim" style="font-size:22px">‹</span><span class="av" style="width:34px;height:34px"><img src="${mark}" style="width:23px;height:23px"></span><div><div style="font:600 15px Inter">${c.title} <span class="or">✦</span></div><div class="dim" style="font:400 12px Inter">${c.by}</div></div><span style="margin-left:auto;color:#FFB21E;font-size:17px">★</span><span class="dim" style="font-size:16px">⇪</span></div>`
      const preview = `<div class="abs" style="left:16px;top:108px;width:358px;height:201px;border-radius:16px;overflow:hidden;background:#17171A"><img src="${poster('launch-ad')}" style="width:100%;height:100%;object-fit:cover"><div class="abs" style="left:12px;bottom:12px;padding:4px 9px;border-radius:8px;background:rgba(0,0,0,.6);font:600 11px Inter">0:33 · 60 fps</div></div>`
      const stats = `<div class="abs row" style="left:16px;top:322px;width:358px;justify-content:space-between"><div><div id="count" style="font:600 26px Inter;letter-spacing:-.5px">${c.p1v}</div><div style="font:500 12px Inter;color:#46A83F">▲ ${c.p1c} <span class="dim">24h</span></div></div><div style="text-align:right"><div style="font:600 15px Inter">${c.copies}</div><div class="dim" style="font:400 12px Inter">${c.made}</div></div></div>`
      const tabs = (active) => `<div class="abs" style="left:0;top:384px;width:390px;height:42px;background:#0A0A0B;border-bottom:1px solid #26262B;z-index:3">${[c.feed, c.prompts, c.about].map((label, i) => `<span class="abs" style="left:${[16, 108, 300][i]}px;top:11px;width:${[70, 170, 74][i]}px;text-align:center;font:${i === active ? 600 : 500} 13px Inter;color:${i === active ? '#F4F1EC' : '#8E877C'}">${label}</span>`).join('')}<div class="abs" style="left:${[16, 108, 300][active]}px;bottom:-1px;width:${[70, 170, 74][active]}px;height:2px;background:#FF7A00"></div></div>`
      const cta = `<div class="abs" style="left:0;top:752px;width:390px;height:96px;background:linear-gradient(180deg, rgba(10,10,11,0), #0A0A0B 28%);z-index:4"><div class="abs row" style="left:16px;top:22px;width:358px;height:48px;border-radius:14px;background:#FF7A00;color:#140B02;font:700 15px Inter;justify-content:center">${c.cta}</div><div class="abs" style="left:128px;top:84px;width:134px;height:5px;border-radius:3px;background:#F4F1EC"></div></div>`
      const post = (cls, name, tag, date, lines, likes, hl) => `<div style="margin:0 8px 6px;padding:10px 8px;border-radius:14px;${hl ? 'background:#1B1B20' : ''}"><div class="row" style="gap:9px"><span class="av ${cls}">${cls ? '' : `<img src="${mark}">`}</span><span style="font:600 13px Inter">${name}</span>${tag ? `<span class="tag">${c.badge}</span>` : ''}<span class="dim" style="font:400 11px Inter">${date}</span></div><div style="margin:6px 0 0 35px;font:400 13px/1.45 Inter">${lines.join('<br><br>')}</div><div class="dim" style="margin:8px 0 0 35px;font:500 11px Inter">♡ ${likes} &nbsp; ◯ ${Math.round(likes / 12)}</div></div>`
      const feed = `<div class="abs" style="left:0;top:427px;width:390px;height:421px;overflow:hidden"><div id="feed" class="abs" style="left:0;top:7px;width:390px">
        ${post('', 'mango', true, c.date, [c.live], 293, true)}${post('a2', c.c1n, false, c.c1d, [c.c1a, c.c1b], 965)}${post('a3', c.c2n, false, c.c2d, [c.c2a, c.c2b], 634)}${post('', c.c3n, true, c.c3d, [`<i>${c.c3a}</i>`, `<i>${c.c3b}</i>`], 4293)}${post('a4', c.r3, false, c.c1d, [c.c1a], 329)}</div></div>`
      const SC = 720 / 390
      const video = async (name, html, seconds) => {
        const dir = path.join(TMP, name)
        fs.mkdirSync(dir)
        await open(390, 848, html, SC)
        for (let i = 0; i < Math.round(seconds * 30); i++) {
          await evaluate(`window.setTime(${i / 30}); 1`)
          fs.writeFileSync(path.join(dir, `${String(i).padStart(4, '0')}.jpg`), await grab(390, 848, 'jpeg'))
        }
        execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '30', '-i', path.join(dir, '%04d.jpg'), '-vf', 'scale=720:1566', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '21', '-preset', 'slow', '-g', '10', '-keyint_min', '10', '-movflags', '+faststart', `${OUT}/${name}.mp4`])
        console.log(`${name}.mp4`, (fs.statSync(`${OUT}/${name}.mp4`).size / 1024).toFixed(0), 'KB')
      }
      const HELP = 'const clamp = (v) => Math.min(1, Math.max(0, v)); const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v) }; const $ = (id) => document.getElementById(id);'
      // 4. sahne: akış sekmesi; ilk gönderi vurgulu, sonra akış adım adım kayar (her 8 karede bir adım: referanstaki tıkırtı)
      await video(`feed-${lang}`, page(390, 848, status + header + preview + stats + tabs(0) + feed + cta, CSS, `${HELP}
        window.setTime = (t) => { let y = 0; for (let i = 0; i < 9; i++) y += 42 * ease((t - 0.75 - i * 0.2667) / 0.2); $('feed').style.transform = 'translateY(' + (-y) + 'px)' }
        setTime(0)`), 4)
      // 7. sahne: prompt sekmesi: ayrıntı kartı açık + kullananlar listesi
      const mini = (cls, name, meta, v) => `<div class="row" style="margin:0 16px;padding:11px 0;gap:10px"><span class="av ${cls}"></span><div><div style="font:600 13px Inter">${name}</div><div class="dim" style="font:400 11px Inter">◷ ${meta}</div></div><div style="margin-left:auto;text-align:right"><div style="font:600 13px Inter">${v}</div><div style="font:500 11px Inter;color:#46A83F">▲ ${c.p1c}</div></div></div>`
      await open(390, 848, page(390, 848, `${status}${header}${preview}${stats}${tabs(1)}
        <div class="abs dim" style="left:16px;top:436px;font:500 11px Inter">● ${c.friends}</div>
        <div class="abs" style="left:0;top:458px;width:390px"><div style="position:relative;margin:0 10px;width:370px;height:${(BIG.h * 370) / BIG.w}px"><div class="abs" style="left:0;top:0;width:${BIG.w}px;height:${BIG.h}px;transform:scale(${370 / BIG.w});transform-origin:0 0;border-radius:30px;background:#262A52;box-shadow:inset 0 0 0 2px #4B52A8;overflow:hidden">
          <div class="abs" style="left:0;top:0;width:${BIG.w}px;height:${BIG.head}px;background:#343A78;box-shadow:inset 0 0 0 2px #4B52A8"></div>
          <span class="abs" style="left:${72 - 25.5 - 13.5}px;top:${45 - 13.5}px;width:27px;height:27px">${SPARK('#F7C6EC')}</span>
          <div class="abs" style="left:72px;top:25px;height:40px;font:700 30px/40px DM;color:#F7C6EC;white-space:nowrap">${c.details}</div>
          <div class="abs" style="right:76px;top:25px;height:40px;font:500 27px/40px Inter;color:#C9CCF2;white-space:nowrap">${c.lines}</div>
          <svg class="abs" style="left:${BIG.w - 44 - 12}px;top:${45 - 12}px" width="24" height="24" viewBox="0 0 48 48"><path d="M10 30 L24 16 L38 30" fill="none" stroke="#C9CCF2" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          ${cardEntries(c, 0, 0, '#5FD068').join('')}</div></div>
        <div style="margin-top:6px">${mini('a2', c.r1, c.r1m, c.r1v)}${mini('a3', c.r2, c.r2m, c.r2v)}${mini('a4', c.r3, c.r3m, c.r3v)}</div></div>`, CSS), 1080 / 390)
      fs.writeFileSync(`${OUT}/prompts-${lang}.jpg`, await grab(390, 848, 'jpeg'))
      console.log(`prompts-${lang}.jpg`)
      // 9. sahne: üstten bildirim iner, sayaç artar
      await video(`notify-${lang}`, page(390, 848, `${status}${header}${preview}${stats}${tabs(0)}${feed}
        <div id="n" class="abs row" style="left:12px;top:52px;width:366px;height:66px;padding:0 12px;gap:11px;border-radius:22px;background:rgba(58,58,66,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 14px 34px rgba(0,0,0,.55);z-index:9"><span class="av" style="width:38px;height:38px;border-radius:10px;background:#0A0A0B"><img src="${mark}" style="width:26px;height:26px"></span><div style="flex:1"><div class="row" style="justify-content:space-between;font:600 13px Inter"><span>${c.app}</span><span class="dim" style="font:400 11px Inter">${c.now}</span></div><div style="font:400 12.5px/1.3 Inter;color:#E9E5DE">${c.notif}</div></div></div>`, CSS, `${HELP}
        const sep = ${JSON.stringify(lang === 'tr' ? '.' : ',')}
        window.setTime = (t) => { const k = ease((t - 0.3) / 0.28); const n = $('n'); n.style.opacity = k; n.style.transform = 'translateY(' + (-34 * (1 - k)) + 'px) scale(' + (0.72 + 0.28 * k) + ')'
          const v = 1284 + Math.floor(clamp((t - 0.6) / 1.6) * 6) * 3; $('count').textContent = '1' + sep + String(v - 1000) }
        setTime(0)`), 3.4)
    }
  }
} finally {
  ws.close()
  chrome.kill()
  await sleep(300)
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 })
}
