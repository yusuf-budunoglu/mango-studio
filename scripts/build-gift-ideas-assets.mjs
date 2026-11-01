// "Gift ideas" şablonunun görselleri ve yazı genişlikleri: HTML → başsız Chrome → PNG (public/templates/gift-ideas).
//   node scripts/build-gift-ideas-assets.mjs [emoji paketinin img/apple/64 klasörü]
// Renkli yüzeyler (tuş, kart, hap, düğme, kenar ışığı, parıltı, ışık çizgisi) beyaz çizilir, sahnede katman rengiyle
// boyanır (`tint`). Kilit ekranı ve parıltı simgesi bizim çizimimiz. Emojiler Apple emoji görselleri (kullanıcı kararı,
// 2026-10-14; emoji-datasource-apple paketi "ticari kullanım için lisanslı değil" diyor): `emoji/` klasöründe, şablonda
// tek listeden okunur; başka bir setle değiştirmek için aynı adlarla PNG koymak yeter.
// Betik ayrıca şablondaki harf ve kelime genişliklerini (Inter 400 / 600 / 700, em) ölçüp src/project/giftIdeasMetrics.ts'e yazar.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/gift-ideas'
const EMOJI_SRC = process.argv[2]
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gift-ideas-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
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

// Şablondaki harfler ve kelimeler (src/project/giftIdeas.ts ve çeviriler ile aynı olmalı)
const WORDS = [
  'h', 'e', 'y', 'hey', 'M', 'a', 'n', 'g', 'o', '.', 'Mango', 'Mango...', '...',
  'Christmas', 'present', 'ideas...', 'Christmas present ideas...', 'Describe your change',
  'Shoes', 'New Sofa', 'Clothes', 'Soccer Ball', 'Headphones', 'Room Plants',
  'Mango Studio', 'mangostudio', '.design',
  'hey Mango...', 'Yılbaşı hediye fikirleri...', 'Değişikliğini anlat', 'Ayakkabı', 'Yeni Koltuk', 'Giysi', 'Futbol Topu', 'Kulaklık', 'Saksı Bitkisi',
  'Yılbaşı', 'hediye', 'fikirleri...',
]

fs.mkdirSync(path.join(OUT, 'emoji'), { recursive: true })

// --- harf ve kelime genişlikleri (Inter 400, 600, 700; em)
{
  const html = path.join(TMP, 'metrics.html')
  fs.writeFileSync(html, page(10, 10, '<pre id="o"></pre>', '') + `<script>
    Promise.all([400, 600, 700].map((w) => document.fonts.load(w + ' 100px Inter'))).then(() => {
      const ctx = document.createElement('canvas').getContext('2d'); const out = {};
      const em = (text) => [400, 600, 700].map((w) => { ctx.font = w + ' 1000px Inter'; return Math.round(ctx.measureText(text).width * 10) / 1e4 });
      for (const w of ${JSON.stringify([...new Set(WORDS), ' '])}) out[w] = em(w);
      document.getElementById('o').textContent = 'METRICS' + JSON.stringify(out) + 'END';
    })</script>`)
  const dom = chrome(['--virtual-time-budget=3000', '--dump-dom', pathToFileURL(html).href]).toString('utf8')
  const m = /METRICS(.*?)END/s.exec(dom)
  if (!m) throw new Error('yazı genişlikleri ölçülemedi')
  const data = JSON.parse(m[1].replace(/&amp;/g, '&'))
  const lines = Object.entries(data).map(([w, v]) => `  ${JSON.stringify(w)}: [${v.join(', ')}],`).join('\n')
  fs.writeFileSync('src/project/giftIdeasMetrics.ts', `// node scripts/build-gift-ideas-assets.mjs ile üretilir; elle düzenleme.\n// Harf / kelime ilerleme genişlikleri (em): [Inter 400, Inter 600, Inter 700]\nexport const GIFT_EM: Record<string, [number, number, number]> = {\n${lines}\n}\n`)
  console.log('metrics', Object.keys(data).length)
}

// --- kilit ekranı (telefon ekranı 1080×2348): açık turkuaz zemin, köşeden inen lacivert kıvrım, saat ve widget'lar
shoot(
  'lockscreen',
  1080,
  2348,
  `<div style="position:absolute;inset:0;background:linear-gradient(160deg,#C9F0EA 0%,#8FE0D4 30%,#52C9BE 58%,#7EE3C9 100%)"></div>
   <div style="position:absolute;left:330px;top:-260px;width:1300px;height:1500px;border-radius:50%;background:radial-gradient(ellipse at 40% 60%,#5E74F0 0%,#2D3FB8 45%,#1A2A86 75%);transform:rotate(-24deg)"></div>
   <div style="position:absolute;left:520px;top:120px;width:900px;height:1100px;border-radius:50%;background:radial-gradient(ellipse at 30% 50%,rgba(140,170,255,.55) 0%,rgba(40,60,190,0) 70%);transform:rotate(-30deg)"></div>
   <div style="position:absolute;left:-200px;top:1180px;width:1200px;height:900px;border-radius:50%;background:radial-gradient(ellipse at 50% 40%,rgba(255,255,255,.55) 0%,rgba(255,255,255,0) 70%)"></div>
   <div style="position:absolute;left:0;right:0;top:56px;display:flex;justify-content:flex-end;gap:16px;padding-right:80px;color:#fff;font-weight:600;font-size:40px">
     <span style="letter-spacing:2px">▂▄▆█</span><span>⌔</span><span style="display:inline-block;width:64px;height:30px;border-radius:9px;background:#fff;margin-top:8px"></span></div>
   <div style="position:absolute;left:0;right:0;top:230px;text-align:center;color:rgba(255,255,255,.92);font-weight:600;font-size:52px">Apr 1 · SFO 9:41 AM</div>
   <div style="position:absolute;left:0;right:0;top:300px;text-align:center;color:rgba(214,240,255,.82);font-weight:700;font-size:330px;letter-spacing:-6px;line-height:1">9:41</div>
   <div style="position:absolute;left:150px;top:700px;color:rgba(255,255,255,.95);font-weight:600;font-size:46px;line-height:1.25">☁ 72°<br>Partly Cloudy<br>H:88° L:64°</div>
   <div style="position:absolute;left:560px;top:700px;width:170px;height:170px;border-radius:50%;border:12px solid rgba(255,255,255,.75);box-sizing:border-box;display:grid;place-items:center;color:#fff;font-weight:700;font-size:62px">67</div>
   <div style="position:absolute;left:790px;top:700px;width:170px;height:170px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center;color:#fff;font-weight:700;font-size:50px">8:29</div>`,
  { scale: 1 },
)

// --- tuş: buzlu cam kare (beyaz, sahnede boyanır); üstü hafif parlak, kenarı yumuşak
shoot(
  'tile',
  220,
  220,
  `<div style="position:absolute;left:20px;top:20px;width:180px;height:180px;border-radius:40px;background:linear-gradient(160deg,rgba(255,255,255,1) 0%,rgba(255,255,255,.86) 55%,rgba(255,255,255,.78) 100%);box-shadow:0 6px 18px rgba(255,255,255,.35), inset 0 2px 0 rgba(255,255,255,1)"></div>`,
  { scale: 2 },
)

// --- telefon ekranının kenar ışığı (Siri gibi): ekran ölçüsünde yuvarlak çerçevenin sol / sağ yarısı, bulanık
// ekran 1.54 × 3.34 birim; görsel 616 × 1336 (1 birim = 400 px), kenardan içe doğru solan ışık
{
  const ring = (side) => `<div style="position:absolute;left:28px;top:28px;width:560px;height:1280px;border-radius:84px;box-shadow:inset ${side === 'left' ? '26px' : '-26px'} 0 34px -6px #fff, inset 0 ${side === 'left' ? '-22px' : '22px'} 40px -14px #fff;-webkit-mask-image:linear-gradient(${side === 'left' ? '90deg' : '270deg'},#000 0%,#000 46%,transparent 62%)"></div>`
  shoot('glow-left', 616, 1336, ring('left'), { scale: 1 })
  shoot('glow-right', 616, 1336, ring('right'), { scale: 1 })
}

// --- giriş hapı: buzlu beyaz, ince kenar çizgisi (beyaz çizilir, boyanır)
shoot(
  'pill',
  900,
  250,
  `<div style="position:absolute;left:12px;top:12px;width:876px;height:226px;border-radius:113px;background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(255,255,255,.9));box-shadow:inset 0 0 0 3px rgba(255,255,255,1), 0 10px 30px rgba(255,255,255,.45)"></div>`,
  { scale: 2 },
)
// --- düğme: yumuşak hap (beyaz, pembeye boyanır)
shoot('button', 520, 100, `<div style="position:absolute;left:10px;top:10px;width:500px;height:80px;border-radius:40px;background:#fff;filter:blur(.6px)"></div>`, { scale: 2 })
// --- kart yüzü ve arka levhası (beyaz, boyanır)
shoot('card', 320, 360, `<div style="position:absolute;left:10px;top:10px;width:300px;height:340px;border-radius:26px;background:linear-gradient(170deg,#fff 0%,rgba(255,255,255,.94) 100%);box-shadow:inset 0 0 0 2px rgba(255,255,255,1)"></div>`, { scale: 2 })
// --- ışık lekesi (bokeh): dağınık bulanık noktalar, iki farklı yerleşim (beyaz, maviye / turuncuya boyanır)
{
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const dots = (n, big) =>
    Array.from({ length: n }, () => {
      const r = big ? 3 + rand() * 7 : 1.2 + rand() * 3
      return `<div style="position:absolute;left:${Math.round(rand() * 1920)}px;top:${Math.round(rand() * 1080)}px;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:#fff;opacity:${(0.3 + rand() * 0.7).toFixed(2)};filter:blur(${(r * 0.8).toFixed(1)}px);box-shadow:0 0 ${Math.round(r * 3)}px ${Math.round(r)}px rgba(255,255,255,.6)"></div>`
    }).join('')
  shoot('bokeh-a', 1920, 1080, dots(320, false), { scale: 1 })
  shoot('bokeh-b', 1920, 1080, dots(90, true), { scale: 1 })
}
// --- parıltı: keskin çekirdekli küçük ışık noktaları ve dört kollu yıldız parlamaları (beyaz, maviye / turuncuya boyanır).
// Tünelde kameraya doğru akan katmanlar; ortası seyrek (giriş hapı orada durur).
{
  let seed = 19
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const glitter = (n, stars) => {
    const out = []
    while (out.length < n) {
      const x = rand() * 1920
      const y = rand() * 1080
      if (Math.hypot((x - 960) / 1.8, y - 540) < 170 && rand() < 0.8) continue
      const r = 1.2 + rand() ** 2 * 3.8
      out.push(`<div style="position:absolute;left:${(x - r).toFixed(0)}px;top:${(y - r).toFixed(0)}px;width:${(r * 2).toFixed(1)}px;height:${(r * 2).toFixed(1)}px;border-radius:50%;background:#fff;opacity:${(0.55 + rand() * 0.45).toFixed(2)};box-shadow:0 0 ${(r * 3).toFixed(0)}px ${(r * 1.2).toFixed(0)}px rgba(255,255,255,.75)"></div>`)
    }
    for (let i = 0; i < stars; i++) {
      const x = rand() * 1920
      const y = rand() * 1080
      const L = 26 + rand() * 40
      const arm = (rot) => `<div style="position:absolute;left:${(x - L).toFixed(0)}px;top:${(y - 1.5).toFixed(0)}px;width:${(L * 2).toFixed(0)}px;height:3px;transform:rotate(${rot}deg);background:linear-gradient(90deg,transparent,#fff 45%,#fff 55%,transparent);filter:blur(.6px)"></div>`
      out.push(arm(0), arm(90), `<div style="position:absolute;left:${(x - 5).toFixed(0)}px;top:${(y - 5).toFixed(0)}px;width:10px;height:10px;border-radius:50%;background:#fff;box-shadow:0 0 16px 6px rgba(255,255,255,.9)"></div>`)
    }
    return out.join('')
  }
  shoot('glitter-a', 1920, 1080, glitter(230, 6), { scale: 1 })
  shoot('glitter-b', 1920, 1080, glitter(120, 4), { scale: 1 })
}
// --- ışık çizgisi: ince, ucu sönen parlak çizgi (beyaz)
shoot('streak', 1200, 40, `<div style="position:absolute;left:0;top:17px;width:1200px;height:6px;border-radius:3px;background:linear-gradient(90deg,transparent,#fff 30%,#fff 70%,transparent);filter:blur(1.5px)"></div>`, { scale: 1 })
// --- köşe ışığı: zeminin kenarlarındaki leylak tonu (beyaz halka, boyanır)
shoot('vignette', 1920, 1080, `<div style="position:absolute;inset:-200px;border-radius:50%;box-shadow:inset 0 0 360px 160px #fff"></div>`, { scale: 1 })
// --- beyaz zemin parlaması (kapanış ve geçiş)
shoot('glow', 640, 400, '<div style="position:absolute;left:150px;top:150px;width:340px;height:100px;border-radius:50px;background:#fff;filter:blur(42px)"></div>', { scale: 1 })
// --- mikrofon (beyaz, boyanır)
shoot(
  'mic',
  256,
  256,
  `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round" stroke-linejoin="round">
    <rect x="97" y="34" width="62" height="112" rx="31"/><path d="M68 114 v6 a60 60 0 0 0 120 0 v-6"/><path d="M128 181 v32 M94 216 h68"/></svg>`,
  { scale: 2 },
)
// --- parıltı simgesi: bizim çizimimiz, altı renkli yaprak (düğmedeki ve kartların yanındaki simge)
shoot(
  'sparkle',
  256,
  256,
  `<svg width="256" height="256" viewBox="0 0 256 256" fill="none" stroke-width="12" stroke-linecap="round">
    ${['#FF9F0A', '#FF375F', '#BF5AF2', '#5E5CE6', '#0A84FF', '#30D158']
      .map((c, i) => `<ellipse cx="128" cy="128" rx="96" ry="36" stroke="${c}" transform="rotate(${i * 30} 128 128)" opacity=".9"/>`)
      .join('')}</svg>`,
  { scale: 2 },
)

// --- emojiler (Apple, 64 px): şablondaki adlarla
const EMOJI = { gift: '1f381', joy: '1f602', butterfly: '1f98b', tree: '1f384', soccer: '26bd', gem: '1f48e', shoes: '1f45f', sofa: '1f6cb-fe0f', shirt: '1f455', headphones: '1f3a7', plant: '1fab4' }
if (EMOJI_SRC) {
  for (const [name, code] of Object.entries(EMOJI)) {
    fs.copyFileSync(path.join(EMOJI_SRC, `${code}.png`), path.join(OUT, 'emoji', `${name}.png`))
  }
  console.log('emoji', Object.keys(EMOJI).length)
} else {
  console.log('emoji: kaynak klasör verilmedi, mevcut emoji/ dosyaları korunur')
}

fs.rmSync(TMP, { recursive: true, force: true })
