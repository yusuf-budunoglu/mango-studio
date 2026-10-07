// "Fold rock" görsel şablonunun görselleri (public/templates/fold-rock):
//   node scripts/build-fold-rock-assets.mjs
// - rock.webp (2048×1080, saydam): koyu, katmanlı kaya sırtı. Tamamen kodla üretilir: three.js'te gürültüyle
//   yer değiştirilmiş bir yüzey (yataklar, kırıklar, ince tortu çizgileri) üç ışıkla çizilir; taban saydama solar,
//   böylece şablonun fon rengi ne olursa olsun kaya ona karışır. Referanstaki kayanın pikseli kullanılmadı.
// - screen.jpg (2048×1432, iç ekranın oranı 1.43): siyah zemin üstünde Netflix yazı logosu. Gerçek marka logosu,
//   kullanıcı kararıyla; markanın kendi biçimi ve kırmızısıyla (#E50914), değiştirilmeden çizilir. Şablonda telefonun
//   ekran görseli olduğu için panelden başka bir görselle değiştirilir.
// - glow.png (512×512, saydam): yumuşak beyaz ışık; şablonda katman rengiyle boyanır (`tint`).
// - label-logo.png (192×192): etiketteki koyu kare içinde Mango işareti (logo yalnızca koyu zeminde kullanılır).
// Sayfa başsız Chrome'da (CDP) çizilir; three.js modülleri için depo kökü yerel bir sunucudan verilir.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const OUT = 'public/templates/fold-rock'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const ROOT = path.resolve('.')
const PORT = 9372

// Netflix yazı logosu (1024 × 276.742 birimlik tuvalde tek yol)
const WORDMARK = { w: 1024, h: 276.742, red: '#E50914' }
const WORDMARK_PATH =
  'M140.803 258.904c-15.404 2.705-31.079 3.516-47.294 5.676l-49.458-144.856v151.073c-15.404 1.621-29.457 3.783-44.051 5.945v-276.742h41.08l56.212 157.021v-157.021h43.511v258.904zm85.131-157.558c16.757 0 42.431-.811 57.835-.811v43.24c-19.189 0-41.619 0-57.835.811v64.322c25.405-1.621 50.809-3.785 76.482-4.596v41.617l-119.724 9.461v-255.39h119.724v43.241h-76.482v58.105zm237.284-58.104h-44.862v198.908c-14.594 0-29.188 0-43.239.539v-199.447h-44.862v-43.242h132.965l-.002 43.242zm70.266 55.132h59.187v43.24h-59.187v98.104h-42.433v-239.718h120.808v43.241h-78.375v55.133zm148.641 103.507c24.594.539 49.456 2.434 73.51 3.783v42.701c-38.646-2.434-77.293-4.863-116.75-5.676v-242.689h43.24v201.881zm109.994 49.457c13.783.812 28.377 1.623 42.43 3.242v-254.58h-42.43v251.338zm231.881-251.338l-54.863 131.615 54.863 145.127c-16.217-2.162-32.432-5.135-48.648-7.838l-31.078-79.994-31.617 73.51c-15.678-2.705-30.812-3.516-46.484-5.678l55.672-126.75-50.269-129.992h46.482l28.377 72.699 30.27-72.699h47.295z'

// Sayfanın betiği: dört görseli çizer, veri adresi olarak `window.__out`'a bırakır.
const PAGE_JS = String.raw`
import * as THREE from 'three'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

const out = {}

// ---------- kaya ----------
{
  const P = { w: 2048, h: 1080, seed: 7, segU: 1200, segV: 760 }
  const perlin = new ImprovedNoise()
  const S = P.seed * 13.37
  const n2 = (x, y) => perlin.noise(x + S, y - S * 0.7, 0.37 + S * 0.11)
  const fbm = (x, y, oct = 5, lac = 2.03, gain = 0.5) => {
    let a = 0.5, f = 1, sum = 0
    for (let i = 0; i < oct; i++) { sum += a * n2(x * f, y * f); f *= lac; a *= gain }
    return sum
  }
  const ridge = (x, y, oct = 4) => {
    let amp = 0.5, f = 1, sum = 0
    for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(n2(x * f, y * f) * 2); sum += r * r * amp; f *= 2.1; amp *= 0.5 }
    return sum
  }
  const smooth = (a, b, t) => { const k = Math.min(1, Math.max(0, (t - a) / (b - a))); return k * k * (3 - 2 * k) }
  const hash = (n) => { const s = Math.sin(n * 127.1 + S) * 43758.5453; return s - Math.floor(s) }

  // Sırt, önden görülen uzun bir tümsek: u enine (x), v ön yüzü tabandan (v = 0) sırt çizgisine ve biraz arkasına tırmanır.
  // Taban kadrajın epey altında: yüz bir kenarla bitmez, görüntüden çıkar.
  const W = 8.4, DEPTH = 2.2, FOOT = 1.5
  // sırt çizgisinin yüksekliği: ortanın solunda tepe, solda ikinci bir omuz, sağa doğru alçalır
  const crest = (x) =>
    1.04 + 0.4 * Math.exp(-(((x + 0.55) / 1.2) ** 2)) + 0.2 * Math.exp(-(((x + 2.9) / 1.25) ** 2)) - 0.44 * smooth(0.5, 3.8, x) +
    0.07 * fbm(x * 1.5, 3.1, 4) + 0.04 * fbm(x * 4.6, 7.7, 3) + 0.018 * fbm(x * 13, 1.9, 2)
  // Yatak ne kadar dışarı taşıyor: sert yataklar çıkıntı, yumuşaklar oyuk; her yatağın kalınlığı ve çıkıntısı ayrı.
  // Birkaç kırık: yataklar yumuşak, dolaşan bir çizgi boyunca yarım yatak kadar kayar.
  const strata = (x, y) => {
    const fx = 0.55 * (x + 0.9 * fbm(x * 0.3, y * 0.5 + 7, 3))
    const block = Math.floor(fx)
    const fault = 0.06 * (hash(block) - 0.5 + (hash(block + 1) - hash(block)) * smooth(0.82, 1, fx - block))
    const warp = 0.3 * fbm(x * 0.55, y * 0.9, 4) + 0.07 * fbm(x * 2.1, y * 3.2, 3)
    const yy = y + 0.1 * x + warp + fault
    const l = yy * 12.5
    const bed = Math.floor(l), f = l - bed
    const reach = 0.25 + 0.75 * hash(bed), edge = 0.05 + 0.16 * hash(bed + 31.7)
    const ledge = (smooth(0, edge, f) - smooth(1 - edge * 0.7, 1, f)) * reach
    // ince tortu çizgileri: yataklar boyunca uzatılmış gürültü
    const lines = fbm(x * 1.6 + 4, yy * 52, 3) * 0.5 + fbm(x * 4.1, yy * 130, 2) * 0.25
    return 0.05 * ledge + 0.03 * lines
  }
  const point = (u, v, target) => {
    const x = (u - 0.5) * W
    const H = crest(x)
    const phi = v * (Math.PI * 0.64) // 0 = taban, PI/2 = sırt çizgisi
    const sy = Math.sin(Math.min(phi, Math.PI / 2)), cz = Math.cos(phi)
    let y = -FOOT + (H + FOOT) * Math.pow(sy, 0.86) - (phi > Math.PI / 2 ? (phi - Math.PI / 2) * 0.9 : 0)
    let z = DEPTH * Math.sign(cz) * Math.pow(Math.abs(cz), 0.74)
    // yüzün dışa bakan yönü (y-z düzleminde)
    const ny = Math.sin(phi) * 0.75, nz = Math.cos(phi)
    const lump = (0.2 * fbm(x * 0.7 + 9, y * 1.1 + 2, 4) + 0.07 * fbm(x * 2.2, y * 2.9, 3)) * (1 - 0.55 * smooth(0.6, 1, v / 0.78))
    // yatakların üstünde kırık, yontulmuş yüzey ve seyrek keskin oyuklar
    const rough = 0.07 * (ridge(x * 1.9 + 3, y * 3.4, 4) - 0.45) + 0.012 * fbm(x * 16, y * 22, 2)
    const chip = Math.max(0, fbm(x * 2.6 + 30, y * 5.5, 3) - 0.16) * 0.22
    const d = lump + strata(x, y) + rough - chip
    return target.set(x, y + d * ny, z + d * nz)
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(P.w, P.h)
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  const scene = new THREE.Scene()
  const geo = new THREE.PlaneGeometry(1, 1, P.segU, P.segV)
  const pos = geo.attributes.position
  const tmp = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    point(pos.getX(i) + 0.5, pos.getY(i) + 0.5, tmp)
    pos.setXYZ(i, tmp.x, tmp.y, tmp.z)
  }
  geo.computeVertexNormals()

  // ince taneler: döşenen gürültüden normal haritası (burada çizilir), yataklar boyunca uzatılmış
  const size = 512
  const grain = document.createElement('canvas'); grain.width = grain.height = size
  const gctx = grain.getContext('2d'); const img = gctx.createImageData(size, size)
  const hgt = new Float32Array(size * size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x / size) * 6.283, v = (y / size) * 6.283
    hgt[y * size + x] = perlin.noise(Math.cos(u) * 3 + 11, Math.sin(u) * 3 + Math.cos(v) * 3, Math.sin(v) * 3 + 5) + 0.5 * perlin.noise(Math.cos(u) * 7 + 2, Math.sin(u) * 7 + Math.cos(v) * 7, Math.sin(v) * 7 + 9)
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const hx = hgt[y * size + ((x + 1) % size)] - hgt[y * size + ((x + size - 1) % size)]
    const hy = hgt[((y + 1) % size) * size + x] - hgt[((y + size - 1) % size) * size + x]
    const i = (y * size + x) * 4
    img.data[i] = 128 + 127 * Math.max(-1, Math.min(1, -hx * 6)); img.data[i + 1] = 128 + 127 * Math.max(-1, Math.min(1, -hy * 6)); img.data[i + 2] = 255; img.data[i + 3] = 255
  }
  gctx.putImageData(img, 0, 0)
  const normalMap = new THREE.CanvasTexture(grain); normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.repeat.set(9, 26)
  scene.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3a3b42, roughness: 0.68, metalness: 0, normalMap, normalScale: new THREE.Vector2(0.28, 0.28) })))

  // ışık: sol üstten yumuşak ana ışık yatakları sıyırır, sağ arkadan soğuk kenar ışığı sırtı belirtir, önden çok hafif dolgu
  const key = new THREE.DirectionalLight(0xe9edf7, 3.8); key.position.set(-5.5, 5.5, 3.2); scene.add(key)
  const rim = new THREE.DirectionalLight(0xa9b8dd, 1.6); rim.position.set(4.5, 4.5, -4); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xffffff, 0.3); fill.position.set(1.5, 0.8, 8); scene.add(fill)
  scene.add(new THREE.AmbientLight(0x9098ac, 0.05))
  const cam = new THREE.PerspectiveCamera(22, P.w / P.h, 0.1, 100)
  cam.position.set(0, 0.42, 9.6)
  cam.lookAt(0, 0.7, 0)
  renderer.render(scene, cam)

  // taban saydama solar
  const c = document.createElement('canvas'); c.width = P.w; c.height = P.h
  const ctx = c.getContext('2d')
  ctx.drawImage(renderer.domElement, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  const g = ctx.createLinearGradient(0, P.h * 0.62, 0, P.h)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, P.w, P.h)
  out.rock = c.toDataURL('image/webp', 0.92)
}

// ---------- ekran: siyah zemin, ortada yazı logosu ----------
{
  const W = 2048, H = 1432, mark = window.WORDMARK
  const c = document.createElement('canvas'); c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)
  const width = W * 0.6, k = width / mark.w
  ctx.translate((W - width) / 2, (H - mark.h * k) / 2)
  ctx.scale(k, k)
  ctx.fillStyle = mark.red
  ctx.fill(new Path2D(mark.path))
  out.screen = c.toDataURL('image/jpeg', 0.95)
}

// ---------- ışık ----------
{
  const N = 512
  const c = document.createElement('canvas'); c.width = c.height = N
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2)
  g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.38, 'rgba(255,255,255,0.5)'); g.addColorStop(0.7, 'rgba(255,255,255,0.14)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  out.glow = c.toDataURL('image/png')
}

// ---------- etiket logosu: koyu kare içinde Mango işareti ----------
{
  const N = 192
  const c = document.createElement('canvas'); c.width = c.height = N
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#17130F'
  ctx.beginPath(); ctx.roundRect(0, 0, N, N, 46); ctx.fill()
  const mark = new Image()
  mark.src = '/public/brand/mango-mark.png'
  await mark.decode()
  const m = N * 0.74
  ctx.drawImage(mark, (N - m) / 2, (N - m) / 2, m, m)
  out['label-logo'] = c.toDataURL('image/png')
}

window.__out = out
`

const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png' }
const html = `<!doctype html><html><head><meta charset="utf-8">
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head>
<body><script>window.WORDMARK = ${JSON.stringify({ ...WORDMARK, path: WORDMARK_PATH })}</script><script type="module" src="/__page.js"></script></body></html>`
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (url === '/') return void res.writeHead(200, { 'content-type': 'text/html' }).end(html)
  if (url === '/__page.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(PAGE_JS)
  const file = path.join(ROOT, url)
  if (!file.startsWith(ROOT)) return void res.writeHead(403).end()
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(data)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-rock-'))
// kaya 1.8 milyon üçgen: yazılım çizimi (swiftshader) her makinede aynı sonucu verir
const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, 'about:blank'])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')
  } catch {
    // Chrome henüz dinlemiyor
  }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => (ws.onopen = resolve))
let seq = 0
const pending = new Map()
const errors = []
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description ?? 'sayfa hatası')
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.result?.value

try {
  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
  let names = null
  for (let i = 0; i < 240 && !names && !errors.length; i++) {
    await sleep(500)
    names = await evaluate('window.__out ? Object.keys(window.__out) : null')
  }
  if (!names) throw new Error(`görseller çizilemedi: ${errors.join(' | ') || 'zaman aşımı'}`)
  fs.mkdirSync(OUT, { recursive: true })
  for (const name of names) {
    const url = await evaluate(`window.__out[${JSON.stringify(name)}]`)
    const ext = url.slice(11, url.indexOf(';')).replace('jpeg', 'jpg')
    const file = `${OUT}/${name}.${ext}`
    fs.writeFileSync(file, Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))
    console.log(file, fs.statSync(file).size)
  }
} finally {
  ws.close()
  chrome.kill()
  server.close()
  await sleep(800)
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 })
}
