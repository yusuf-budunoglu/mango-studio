// "Launch ad" şablonunun görselleri: HTML → başsız Chrome → saydam PNG (public/templates/launch-ad).
//   node scripts/build-launch-ad-assets.mjs
// Ölçüler 1920×1080 kadrajın pikselinde; PNG'ler 2 kat (yakın planlarda 3–4 kat) çözünürlükte çizilir.
// Hepsi bizim tasarımımız: aydınlık Mango Studio arayüzü, kendi şablon kapaklarımız, logo public/brand
// (logo kuralı gereği yalnızca koyu rozet içinde).
// Renkli öğeler (çubuk, halka, yıldız, düğme, ışık) beyaz çizilir ve sahnede katman rengiyle boyanır (tint).
// Betik ayrıca şablondaki kelimelerin genişliklerini (Inter 500, em) ölçüp src/project/launchAdMetrics.ts'e yazar.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/launch-ad'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'launch-'))
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

const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 })

function shoot(name, w, h, body, { scale = 2, css = '' } = {}) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  const out = path.resolve(OUT, `${name}.png`)
  chrome([`--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000', '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href])
  console.log(name, `${w * scale}×${h * scale}`)
}

// Marka renkleri (src/styles/brand.md); zemin aydınlık, vurgular mango
const C = { panel2: '#FAF8F5', line: '#E9E4DB', ink: '#17130F', muted: '#8C857B', orange: '#FF7A00', gold: '#FFB21E', leaf: '#46A83F', red: '#E2361B' }
const SHADOW = '0 30px 70px rgba(255,122,0,.20), 0 4px 14px rgba(40,25,5,.08)'
const poster = (id) => url(`public/templates/posters/${id}.jpg`)
const SPARK = (c = '#fff') => `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.2c1 5.8 5 9.8 10.8 10.8-5.8 1-9.8 5-10.8 10.8C11 17 7 13 1.2 12 7 11 11 7 12 1.2Z" fill="${c}"/></svg>`
/** logo koyu rozet içinde */
const CHIP = (size) => `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.28)}px;background:#0A0A0B;flex:none"><img src="${url('public/brand/mango-mark.png')}" style="width:${Math.round(size * 0.78)}px;height:${Math.round(size * 0.78)}px"></span>`

const COPY = {
  en: { templates: 'Templates', studio: 'Studio', prompts: 'Prompts', all: 'All', videos: 'Videos', designs: 'Designs', search: 'Search', new: 'New project', name: 'Name', format: 'Format', edited: 'Edited', today: 'Today', yesterday: 'Yesterday', rowTitle: 'Launch video', rowMeta: '16:9 · 60 fps · 33 s' },
  tr: { templates: 'Şablonlar', studio: 'Studio', prompts: "Prompt'lar", all: 'Tümü', videos: 'Videolar', designs: 'Tasarımlar', search: 'Ara', new: 'Yeni proje', name: 'Ad', format: 'Biçim', edited: 'Düzenlendi', today: 'Bugün', yesterday: 'Dün', rowTitle: 'Tanıtım videosu', rowMeta: '16:9 · 60 kare/sn · 33 sn' },
}
// şablondaki kelimeler (src/i18n/locales ile aynı olmalı): genişlikleri ölçülür
const WORDS = [
  'Turn', 'ideas', 'into', 'Motion', 'Any', 'style', 'Instantly', 'Just', 'prompt', 'and', 'go', 'Text.', 'Shapes.', 'Devices.', 'One', 'motion', 'studio',
  'Rendered', 'Every', 'format', 'Export', 'in', '4K', 'Prompt.', 'Edit.', 'Mango', 'Studio', 'mangostudio', '.design', '/100', '100',
  'Fikirden', 'videoya', 'Hareket', 'Her', 'tarz', 'Anında', 'Yaz', 've', 'izle', 'Metin.', 'Şekil.', 'Cihaz.', 'Tek', 'hareket', 'stüdyosu',
  'Hazır', 'biçim', 'dışa', 'aktar', 'Yaz.', 'Düzenle.', 'Aktar', 'Sadece', 'yaz',
]

fs.mkdirSync(OUT, { recursive: true })

// --- kelime genişlikleri (Inter 500 ve 600, em)
{
  const html = path.join(TMP, 'metrics.html')
  fs.writeFileSync(html, page(10, 10, '<pre id="o"></pre>', '') + `<script>
    document.fonts.load('500 100px Inter').then(() => document.fonts.load('600 100px Inter')).then(() => {
      const ctx = document.createElement('canvas').getContext('2d'); const out = {};
      for (const w of ${JSON.stringify([...new Set(WORDS)])}) { ctx.font = '500 1000px Inter'; const a = ctx.measureText(w).width / 1000; ctx.font = '600 1000px Inter'; out[w] = [Math.round(a * 1e4) / 1e4, Math.round(ctx.measureText(w).width * 10) / 1e4]; }
      ctx.font = '500 1000px Inter'; out[' '] = [Math.round(ctx.measureText(' ').width * 10) / 1e4, 0];
      document.getElementById('o').textContent = 'METRICS' + JSON.stringify(out) + 'END';
    })</script>`)
  const dom = chrome(['--virtual-time-budget=3000', '--dump-dom', pathToFileURL(html).href]).toString('utf8')
  const m = /METRICS(.*?)END/s.exec(dom)
  if (!m) throw new Error('kelime genişlikleri ölçülemedi')
  const data = JSON.parse(m[1].replace(/&amp;/g, '&'))
  const lines = Object.entries(data).map(([w, [a, b]]) => `  ${JSON.stringify(w)}: [${a}, ${b}],`).join('\n')
  fs.writeFileSync('src/project/launchAdMetrics.ts', `// node scripts/build-launch-ad-assets.mjs ile üretilir; elle düzenleme.\n// Kelime ilerleme genişlikleri (em): [Inter 500, Inter 600]\nexport const LAUNCH_EM: Record<string, [number, number]> = {\n${lines}\n}\n`)
  console.log('metrics', Object.keys(data).length)
}

// --- beyaz çizilen, sahnede boyanan parçalar (tint)
shoot('spark', 64, 64, SPARK(), { scale: 16 })
shoot('glow', 600, 600, `<div style="width:600px;height:600px;border-radius:50%;background:radial-gradient(closest-side,rgba(255,255,255,.6) 0%,rgba(255,255,255,.25) 40%,rgba(255,255,255,0) 100%)"></div>`, { scale: 1 })
// ilerleme çubuğu: 130 px kalın hap (referanstaki orantı), kadrajın solundan taşar; BAR_H launchAd.ts ile aynı
const BAR_H = 130
const pill = (extra) => `position:absolute;left:0;top:${(260 - BAR_H) / 2}px;width:2360px;height:${BAR_H}px;border-radius:${BAR_H / 2}px;${extra}`
shoot('bar', 2400, 260, `<div style="${pill('background:#fff')}"></div>`, { scale: 1 })
// parlaklık (boyanmaz): üstte beyaz yansıma, solda açılan ton, uçta sarı
shoot('bar-shine', 2400, 260, `<div style="${pill('background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(255,255,255,0) 60%),linear-gradient(90deg,rgba(255,255,255,.55),rgba(255,255,255,0) 22%,rgba(255,255,255,0) 70%,rgba(255,236,170,.6))')}"></div>`, { scale: 1 })
shoot('bar-glow', 2400, 260, `<div style="position:absolute;left:0;top:150px;width:2300px;height:60px;border-radius:30px;background:#fff;filter:blur(34px);opacity:.75"></div>`, { scale: 1 })
shoot('bar-track', 2400, 260, `<div style="${pill('background:#fff;box-shadow:0 14px 40px rgba(40,25,5,.10), inset 0 0 0 1.5px #EEE9E1')}"></div>`, { scale: 1 })
shoot('dot', 200, 200, `<div style="position:absolute;left:${(200 - BAR_H) / 2}px;top:${(200 - BAR_H) / 2}px;width:${BAR_H}px;height:${BAR_H}px;border-radius:50%;background:#fff"></div>`, { scale: 2 })
// sıvı geçiş: solda kadrajı kaplayan dolgu, sağa doğru çubuk kalınlığına iner; kenarları yumuşak
const y0 = 800 - BAR_H / 2
const y1 = 800 + BAR_H / 2
shoot('funnel', 2600, 1600, `<svg width="2600" height="1600" viewBox="0 0 2600 1600"><defs><filter id="b" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="16"/></filter></defs>
  <path filter="url(#b)" d="M-60 -60 C700 60 850 ${y0} 1500 ${y0} L2480 ${y0} A${BAR_H / 2} ${BAR_H / 2} 0 0 1 2480 ${y1} L1500 ${y1} C850 ${y1} 700 1540 -60 1660 Z" fill="#fff"/></svg>`, { scale: 1 })
// onay halkası (soluk dolgu + çizgi) ve işaret
shoot('ring', 240, 240, `<div style="position:absolute;inset:14px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.16);box-sizing:border-box;box-shadow:0 18px 50px rgba(255,255,255,.35)"></div>`, { scale: 4 })
shoot('tick', 240, 240, `<svg width="240" height="240" viewBox="0 0 240 240"><path d="M80 124 l28 28 54 -62" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, { scale: 4 })
// düğme gövdesi (yazı ayrı metin katmanı), gölgesi, tıklama halkası (çizgi) ve yumuşak dalga (dolgu)
shoot('button', 760, 260, `<div style="position:absolute;left:40px;top:40px;width:680px;height:180px;border-radius:44px;background:#fff"></div>`, { scale: 3 })
shoot('button-shadow', 760, 260, `<div style="position:absolute;left:70px;top:90px;width:620px;height:130px;border-radius:44px;background:#fff;filter:blur(30px);opacity:.6"></div>`, { scale: 1 })
shoot('pulse', 700, 460, `<div style="position:absolute;inset:24px;border-radius:44px;border:4px solid rgba(255,255,255,.95);box-shadow:0 0 34px rgba(255,255,255,.5);box-sizing:border-box"></div>`, { scale: 2 })
shoot('pulse-soft', 900, 620, `<div style="position:absolute;inset:110px;border-radius:60px;background:#fff;filter:blur(38px);opacity:.75"></div>`, { scale: 1 })
// yıldızın arkasında bıraktığı iz (kavisli, başı sönük)
shoot('trail', 600, 400, `<svg width="600" height="400" viewBox="0 0 600 400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".55"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="7"/></filter></defs>
  <path filter="url(#b)" d="M40 60 C150 120 260 260 330 330 C400 290 470 200 560 150" stroke="url(#g)" stroke-width="26" fill="none" stroke-linecap="round"/></svg>`, { scale: 1 })

// --- proje karosu (turuncu degrade cam, oynat üçgeni + yıldız): karo 340 px, görsel 400×440 (alt gölge payı)
shoot('tile', 400, 440, `<div style="position:absolute;left:30px;top:20px;width:340px;height:340px;border-radius:76px;background:linear-gradient(145deg,${C.gold} 0%,${C.orange} 52%,${C.red} 125%);box-shadow:0 46px 70px rgba(255,122,0,.42), inset 0 3px 0 rgba(255,255,255,.5), inset 0 -10px 30px rgba(180,40,0,.25)">
    <div style="position:absolute;left:0;right:0;top:0;height:150px;border-radius:76px 76px 120px 120px;background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(255,255,255,0))"></div>
    <svg style="position:absolute;left:112px;top:96px" width="140" height="150" viewBox="0 0 100 108"><path d="M14 8 L88 54 L14 100 Z" fill="#fff" stroke="#fff" stroke-width="14" stroke-linejoin="round"/></svg>
    <div style="position:absolute;right:38px;top:34px;width:60px;height:60px">${SPARK('#fff')}</div>
  </div>`, { scale: 3 })

// --- bırakma paneli: beyaz cam, altta zaman çizelgesi şeritleri
shoot('panel', 1700, 1000, `<div style="position:absolute;inset:60px;border-radius:46px;background:linear-gradient(180deg,#FFFFFF,#FCFBF9);border:2px solid #F1ECE4;border-bottom:3px solid rgba(255,122,0,.55);box-shadow:0 50px 110px rgba(255,122,0,.16)">
    <div style="position:absolute;left:50px;right:50px;top:50px;bottom:250px;border-radius:30px;border:2.5px dashed #E6DFD4"></div>
    ${[0, 1, 2].map((i) => `<div style="position:absolute;left:${50 + i * 110}px;bottom:${178 - i * 58}px;width:${[620, 460, 760][i]}px;height:38px;border-radius:14px;background:${[C.orange, C.gold, C.leaf][i]}"></div>`).join('')}
    <div style="position:absolute;left:50px;right:50px;bottom:240px;height:1.5px;background:#EFE9E0"></div>
  </div>`)

// --- şablon kartları: kendi kapaklarımız, beyaz kart + turuncu kenar ve ışık (kart 500×400, görselde (50, 40)'ta)
const CARDS = [
  { id: 'fintech', title: 'Fintech promo', meta: '16:9 · 19.3 s' },
  { id: 'words-motion', title: 'Words to motion', meta: '16:9 · 11.3 s' },
  { id: 'fold-promo', title: 'Fold promo', meta: '16:9 · 20 s' },
  { id: 'mango-ai-ad', title: 'AI video ad', meta: '16:9 · 21 s' },
  { id: 'crystal', title: 'Crystal', meta: '9:16 · 27.6 s' },
  { id: 'wallet-promo', title: 'Wallet promo', meta: '9:16 · 19.1 s' },
]
const cardHtml = (c, border = `1.5px solid ${C.line}`) => `<div style="position:relative;width:500px;height:400px;border-radius:26px;background:#fff;border:${border};overflow:hidden;box-sizing:border-box">
    <div style="margin:16px 16px 0;height:288px;border-radius:16px;background:#111 url(${poster(c.id)}) center/cover no-repeat"></div>
    <div style="display:flex;align-items:center;gap:10px;padding:16px 20px 0">
      <div style="font:600 23px Inter;color:${C.ink};flex:1;white-space:nowrap">${c.title}</div>
      <div style="width:10px;height:10px;border-radius:50%;background:${C.leaf}"></div>
    </div>
    <div style="padding:6px 20px;font:400 17px Inter;color:${C.muted}">${c.meta} · 60 fps</div>
  </div>`
for (const c of CARDS) shoot(`card-${c.id}`, 600, 500, `<div style="position:absolute;left:50px;top:40px;box-shadow:${SHADOW};border-radius:26px">${cardHtml(c, '2.5px solid rgba(255,122,0,.6)')}</div>`, { scale: 3 })

for (const [lang, t] of Object.entries(COPY)) {
  const side = `<div style="position:absolute;left:0;top:0;bottom:0;width:250px;border-right:1px solid ${C.line};padding:28px 22px;box-sizing:border-box;background:${C.panel2}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:36px">${CHIP(40)}<div style="font:700 21px Inter;color:${C.ink};letter-spacing:.04em">MANGO</div></div>
      ${[t.templates, t.studio, t.prompts].map((n, i) => `<div style="padding:12px 14px;margin-bottom:6px;border-radius:12px;font:500 19px Inter;color:${i === 1 ? C.ink : C.muted};background:${i === 1 ? '#FFF1E2' : 'transparent'}">${i === 1 ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${C.orange};margin-right:12px;vertical-align:middle"></span>` : '<span style="display:inline-block;width:20px"></span>'}${n}</div>`).join('')}
    </div>`
  const top = (active) => `<div style="position:absolute;left:290px;right:40px;top:26px;height:50px;display:flex;align-items:center;gap:26px">
      ${[t.all, t.videos, t.designs].map((n, i) => `<div style="font:${i === active ? 600 : 500} 20px Inter;color:${i === active ? C.orange : C.muted};padding-bottom:8px;border-bottom:3px solid ${i === active ? C.orange : 'transparent'}">${n}</div>`).join('')}
      <div style="flex:1"></div>
      <div style="width:260px;height:44px;border-radius:14px;background:${C.panel2};border:1px solid ${C.line};font:400 17px/44px Inter;color:${C.muted};padding-left:18px;box-sizing:border-box">${t.search}</div>
      <div style="height:44px;padding:0 20px;border-radius:14px;background:${C.ink};font:600 17px/44px Inter;color:#fff">+ ${t.new}</div>
    </div>`
  // çerçeve görselde 60 px içeride: arayüz 1600×1000
  const frame = (inner) => `<div style="position:absolute;inset:60px;border-radius:30px;background:#fff;border:1.5px solid ${C.line};border-left:3px solid rgba(255,122,0,.6);overflow:hidden;box-shadow:0 50px 120px rgba(255,122,0,.18), 0 6px 20px rgba(40,25,5,.06)">${inner}</div>`
  // Studio: kart ızgarası (3 × 2). Kart konumları şablonda da kullanılıyor (launchAd.ts PICK).
  shoot(`studio-${lang}`, 1720, 1120, frame(`${side}${top(1)}
    ${CARDS.map((c, i) => `<div style="position:absolute;left:${290 + (i % 3) * 430}px;top:${110 + Math.floor(i / 3) * 440}px;transform:scale(.8);transform-origin:0 0">${cardHtml(c)}</div>`).join('')}`))
  // Studio: liste görünümü
  const rows = [['Launch video', t.today], ['Fintech promo', t.today], ['Words to motion', t.yesterday], ['Fold promo', t.yesterday], ['Crystal', '2 Oct'], ['Wallet promo', '28 Sep']]
  if (lang === 'tr') { rows[0][0] = t.rowTitle; rows[4][1] = '2 Eki'; rows[5][1] = '28 Eyl' }
  const ids = ['mango-ai-ad', 'fintech', 'words-motion', 'fold-promo', 'crystal', 'wallet-promo']
  shoot(`list-${lang}`, 1720, 1120, frame(`${side}${top(0)}
    <div style="position:absolute;left:290px;right:40px;top:104px;height:40px;display:flex;font:500 16px/40px Inter;color:${C.muted};border-bottom:1px solid ${C.line}"><div style="width:700px;padding-left:120px;box-sizing:border-box">${t.name}</div><div style="width:260px">${t.format}</div><div>${t.edited}</div></div>
    ${rows.map(([name, when], i) => `<div style="position:absolute;left:290px;right:40px;top:${152 + i * 128}px;height:116px;border-radius:18px;background:${i === 0 ? '#FFF6EC' : 'transparent'};border:1px solid ${i === 0 ? '#FFD9B0' : 'transparent'};display:flex;align-items:center;font:500 21px Inter;color:${C.ink}">
        <div style="width:96px;height:66px;margin:0 22px 0 14px;border-radius:12px;background:#111 url(${poster(ids[i])}) center/cover no-repeat;flex:none"></div>
        <div style="width:566px">${name}</div><div style="width:260px;color:${C.muted};font-weight:400">${i < 4 ? '16:9' : '9:16'} · 60 fps</div><div style="color:${C.muted};font-weight:400">${when}</div></div>`).join('')}`))
  // yakın plandaki satır (düğme ayrı katman): satır 2600×320, görselde 100 px içeride
  shoot(`row-${lang}`, 2800, 520, `<div style="position:absolute;left:100px;top:100px;width:2600px;height:320px;border-radius:56px;background:#fff;box-shadow:0 60px 110px rgba(255,122,0,.16), 0 6px 20px rgba(40,25,5,.05);display:flex;align-items:center">
      <div style="width:44px;height:44px;margin-left:56px;border-radius:12px;border:3px solid #DDD6CA;box-sizing:border-box;flex:none"></div>
      <div style="width:300px;height:200px;margin:0 50px 0 46px;border-radius:26px;background:#111 url(${poster('mango-ai-ad')}) center/cover no-repeat;flex:none"></div>
      <div><div style="font:600 70px Inter;color:${C.ink};letter-spacing:-.01em">${t.rowTitle}</div><div style="margin-top:14px;font:400 44px Inter;color:${C.muted}">${t.rowMeta}</div></div>
    </div>`, { scale: 1.5 })
}

// --- telefon ekranları (1080×2348): aydınlık Mango arayüzü; metin yalnızca marka adı
const phoneHead = `<div style="position:absolute;left:60px;right:60px;top:170px;display:flex;align-items:center;gap:22px">${CHIP(90)}<div style="font:700 54px Inter;color:${C.ink}">Mango Studio</div></div>`
const lines = (top, widths) => widths.map((w, i) => `<div style="position:absolute;left:60px;top:${top + i * 62}px;width:${w}px;height:26px;border-radius:13px;background:#E7E1D7"></div>`).join('')
shoot('screen-gallery', 1080, 2348, `<div style="position:absolute;inset:0;background:#fff">${phoneHead}
    ${['mango-ai-ad', 'fintech', 'fold-promo'].map((id, i) => `<div style="position:absolute;left:60px;right:60px;top:${330 + i * 640}px;height:480px;border-radius:44px;background:#111 url(${poster(id)}) center/cover no-repeat"></div>${lines(840 + i * 640, [520, 340])}`).join('')}
  </div>`, { scale: 1 })
shoot('screen-vertical', 1080, 2348, `<div style="position:absolute;inset:0;background:#fff">${phoneHead}
    ${['crystal', 'wallet-promo', 'meadow-phone', 'ai-search-ad'].map((id, i) => `<div style="position:absolute;left:${60 + (i % 2) * 495}px;top:${330 + Math.floor(i / 2) * 960}px;width:465px;height:920px;border-radius:44px;background:#111 url(${poster(id)}) center/cover no-repeat"></div>`).join('')}
  </div>`, { scale: 1 })
shoot('screen-prompt', 1080, 2348, `<div style="position:absolute;inset:0;background:#fff">${phoneHead}
    <div style="position:absolute;left:60px;right:60px;top:340px;height:560px;border-radius:44px;background:#111 url(${poster('mango-ai-ad')}) center/cover no-repeat"></div>
    ${lines(990, [820, 640, 900, 520, 760, 880, 420, 700, 610, 840, 500])}
    <div style="position:absolute;left:60px;right:60px;bottom:150px;height:150px;border-radius:75px;background:linear-gradient(90deg,${C.red},${C.orange} 45%,${C.gold})"><div style="position:absolute;left:50%;top:50%;width:80px;height:80px;margin:-40px">${SPARK('#fff')}</div></div>
  </div>`, { scale: 1 })
shoot('screen-text', 1080, 2348, `<div style="position:absolute;inset:0;background:#fff">${phoneHead}
    ${lines(340, Array.from({ length: 26 }, (_, i) => [900, 780, 940, 620, 860, 700, 920, 540][i % 8]))}
    <div style="position:absolute;left:60px;right:60px;bottom:150px;height:260px;border-radius:44px;background:linear-gradient(120deg,${C.orange},${C.gold})"></div>
  </div>`, { scale: 1 })

fs.rmSync(TMP, { recursive: true, force: true })
