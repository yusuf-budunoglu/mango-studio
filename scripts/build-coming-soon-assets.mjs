// "Coming soon" şablonunun görselleri ve yazı genişlikleri: HTML → başsız Chrome → PNG (public/templates/coming-soon).
//   node scripts/build-coming-soon-assets.mjs
// Hepsi bizim çizimimiz: mikrofon simgesi ve ışık lekesi beyaz çizilir, sahnede katman rengiyle boyanır (`tint`);
// bildirimdeki yuvarlak görsel Mango logosu (kullanıcı kendi görseliyle değiştirir).
// Betik ayrıca şablondaki kelimelerin genişliklerini (Inter 400 / 500 / 600, em) ölçüp
// src/project/comingSoonMetrics.ts'e yazar: yeni kelime ya da dil eklenince `WORDS` listesine ekle.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/coming-soon'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'coming-soon-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
${css}
</style></head><body>${body}</body></html>`

const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })

function shoot(name, w, h, body, { scale = 2, css = '' } = {}) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  const out = path.resolve(OUT, `${name}.png`)
  chrome([`--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000', '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href])
  console.log(name, `${w * scale}×${h * scale}`, fs.statSync(out).size)
}

// şablondaki kelimeler (src/i18n/locales ile aynı olmalı): genişlikleri ölçülür
const WORDS = [
  'Make', 'a', 'launch', 'teaser', 'Mango', 'Studio', 'Your', 'is', 'ready', '9:41', 'AM', 'Coming', 'Soon',
  'Tanıtım', 'videosu', 'yap', 'videon', 'hazır', '09:41', 'Çok', 'Yakında',
]

fs.mkdirSync(OUT, { recursive: true })

// --- kelime genişlikleri (Inter 400, 500 ve 600; em)
{
  const html = path.join(TMP, 'metrics.html')
  fs.writeFileSync(html, page(10, 10, '<pre id="o"></pre>', '') + `<script>
    Promise.all([400, 500, 600].map((w) => document.fonts.load(w + ' 100px Inter'))).then(() => {
      const ctx = document.createElement('canvas').getContext('2d'); const out = {};
      const em = (text) => [400, 500, 600].map((w) => { ctx.font = w + ' 1000px Inter'; return Math.round(ctx.measureText(text).width * 10) / 1e4 });
      for (const w of ${JSON.stringify([...new Set(WORDS), ' '])}) out[w] = em(w);
      document.getElementById('o').textContent = 'METRICS' + JSON.stringify(out) + 'END';
    })</script>`)
  const dom = chrome(['--virtual-time-budget=3000', '--dump-dom', pathToFileURL(html).href]).toString('utf8')
  const m = /METRICS(.*?)END/s.exec(dom)
  if (!m) throw new Error('kelime genişlikleri ölçülemedi')
  const data = JSON.parse(m[1].replace(/&amp;/g, '&'))
  const lines = Object.entries(data).map(([w, v]) => `  ${JSON.stringify(w)}: [${v.join(', ')}],`).join('\n')
  fs.writeFileSync('src/project/comingSoonMetrics.ts', `// node scripts/build-coming-soon-assets.mjs ile üretilir; elle düzenleme.\n// Kelime ilerleme genişlikleri (em): [Inter 400, Inter 500, Inter 600]\nexport const SOON_EM: Record<string, [number, number, number]> = {\n${lines}\n}\n`)
  console.log('metrics', Object.keys(data).length)
}

// --- mikrofon: ince çizgili simge (kapsül, altında yay, sap ve taban); beyaz çizilir, sahnede boyanır
shoot(
  'mic',
  256,
  256,
  `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
    <rect x="97" y="34" width="62" height="112" rx="31"/>
    <path d="M68 114 v6 a60 60 0 0 0 120 0 v-6"/>
    <path d="M128 181 v32 M94 216 h68"/>
  </svg>`,
  { scale: 2 },
)

// --- ışık lekesi: kapanıştaki renkli kelimenin arkasında; bulanık yuvarlak köşeli kutu (beyaz, sahnede boyanır)
shoot('glow', 640, 400, '<div style="position:absolute;left:150px;top:150px;width:340px;height:100px;border-radius:50px;background:#fff;filter:blur(42px)"></div>', { scale: 1 })

// --- bildirimdeki yuvarlak görsel: koyu daire içinde Mango logosu (logo 2048 px görselde 976 px yüksek, merkezi y = 907)
{
  const k = 150 / 976
  shoot(
    'avatar',
    256,
    256,
    `<div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 35% 28%, #2B2219 0%, #17130F 70%)">
      <img src="${url('public/brand/mango-logo-2048.png')}" style="position:absolute;width:${2048 * k}px;height:${2048 * k}px;left:${128 - 1024 * k}px;top:${128 - 907 * k}px">
    </div>`,
    { scale: 2 },
  )
}

fs.rmSync(TMP, { recursive: true, force: true })
