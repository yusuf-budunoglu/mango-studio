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
const SHADOW = '0 30px 70px rgba(255,122,0,.26), 0 4px 14px rgba(40,25,5,.10)'
// Beyaz yüzeyler (panel, arayüz, satır, sayaç zemini) açık zeminde kaybolmasın: belirgin turuncu kenar çizgisi + renkli gölge
const EDGE = '2.5px solid rgba(255,122,0,.5)'
const GLOW = '0 46px 120px rgba(255,122,0,.34), 0 8px 26px rgba(60,30,0,.10)'
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
  'Hazır', 'biçim', 'dışa', 'aktar', 'Yaz.', 'Düzenle.', 'Aktar', 'Sadece', 'yaz', 'Templates', 'Şablonlar',
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
shoot('bar-track', 2400, 260, `<div style="${pill('background:#fff;box-sizing:border-box;border:2.5px solid rgba(255,122,0,.42);box-shadow:0 18px 44px rgba(255,122,0,.30), 0 4px 12px rgba(60,30,0,.10)')}"></div>`, { scale: 1 })
// çubuğun ucu: 333 px'lik kısa parça (sağ ucu yuvarlak, sol ucu düz). Telefon kadrajdayken uzun çubuk yerine bu çizilir.
shoot('bar-tip', 340, 260, `<div style="position:absolute;left:0;top:${(260 - BAR_H) / 2}px;width:333px;height:${BAR_H}px;border-radius:0 ${BAR_H / 2}px ${BAR_H / 2}px 0;background:#fff"></div>`, { scale: 4 })
shoot('dot', 200, 200, `<div style="position:absolute;left:${(200 - BAR_H) / 2}px;top:${(200 - BAR_H) / 2}px;width:${BAR_H}px;height:${BAR_H}px;border-radius:50%;background:#fff"></div>`, { scale: 2 })
// sıvı geçiş: telefonun üst kenarından, o kenarla AYNI boyda çıkan yelpaze. Sol kenar 352 px (sahnede 2.7 kat: ~950 px,
// yatay duran telefonun üst kenarı kadar), köşeleri telefon gibi yuvarlak; sağ uç çubuk kalınlığında (BAR_H).
// Görsel 560×480, yelpaze (60, 64)'ten başlar ve 440 px geniştir; kenarları yumuşak.
const fy0 = 240 - BAR_H / 2
const fy1 = 240 + BAR_H / 2
shoot('funnel', 560, 480, `<svg width="560" height="480" viewBox="0 0 560 480"><defs><filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter></defs>
  <path filter="url(#b)" d="M60 112 Q60 64 108 64 C250 70 300 ${fy0} 470 ${fy0} L500 ${fy0} L500 ${fy1} L470 ${fy1} C300 ${fy1} 250 410 108 416 Q60 416 60 368 Z" fill="#fff"/></svg>`, { scale: 5 })
// onay halkası (soluk dolgu + çizgi) ve işaret: halka 212 px, tuval 400 px (ışıma kenarda kesilmesin)
shoot('ring', 400, 400, `<div style="position:absolute;left:94px;top:94px;width:212px;height:212px;border-radius:50%;border:5px solid #fff;background:rgba(255,255,255,.16);box-sizing:border-box;box-shadow:0 14px 44px rgba(255,255,255,.3)"></div>`, { scale: 3 })
shoot('tick', 400, 400, `<svg width="400" height="400" viewBox="0 0 400 400"><path d="M160 204 l28 28 54 -62" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, { scale: 3 })
// düğme gövdesi (yazı ayrı metin katmanı), gölgesi, tıklama halkası (çizgi) ve yumuşak dalga (dolgu)
shoot('button', 760, 260, `<div style="position:absolute;left:40px;top:40px;width:680px;height:180px;border-radius:44px;background:#fff"></div>`, { scale: 3 })
shoot('button-shadow', 760, 260, `<div style="position:absolute;left:70px;top:90px;width:620px;height:130px;border-radius:44px;background:#fff;filter:blur(30px);opacity:.6"></div>`, { scale: 1 })
shoot('pulse', 700, 460, `<div style="position:absolute;inset:24px;border-radius:44px;border:4px solid rgba(255,255,255,.95);box-shadow:0 0 34px rgba(255,255,255,.5);box-sizing:border-box"></div>`, { scale: 2 })
shoot('pulse-soft', 900, 620, `<div style="position:absolute;inset:110px;border-radius:60px;background:#fff;filter:blur(38px);opacity:.75"></div>`, { scale: 1 })
// yıldızın izi: V biçimi (sol üstten iner, seker, sağa yükselir); başı sönük
shoot('trail', 600, 460, `<svg width="600" height="460" viewBox="0 0 600 460"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".45" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="8"/></filter></defs>
  <path filter="url(#b)" d="M40 40 C140 90 250 250 330 400 C380 320 450 250 560 220" stroke="url(#g)" stroke-width="30" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, { scale: 1 })
// bırakma dalgası: beyaz yumuşak köşeli levha, çevresinde turuncuya çalan gölge (boyanmaz)
shoot('ripple', 900, 700, `<div style="position:absolute;left:170px;top:150px;width:560px;height:400px;border-radius:56px;background:#fff;box-shadow:0 30px 80px rgba(255,122,0,.40), 0 0 0 2.5px rgba(255,122,0,.42)"></div>`, { scale: 1 })
// konfeti: düzensiz dörtgen, net ve bulanık (yakın parçalar) hali; ikisi de boyanır
const QUAD = '<svg width="200" height="200" viewBox="0 0 200 200"><path d="M46 38 L162 54 L140 150 L34 132 Z" fill="#fff"/></svg>'
shoot('confetti', 200, 200, QUAD, { scale: 2 })
shoot('confetti-blur', 200, 200, `<div style="filter:blur(9px)">${QUAD}</div>`, { scale: 2 })
// kart şeridinin kenar solması (zemin renginde boyanır) ve halkadan karta dönüşen boş kart
shoot('edge-fade', 400, 800, `<div style="width:400px;height:800px;background:linear-gradient(90deg,#fff 0%,rgba(255,255,255,.85) 30%,rgba(255,255,255,0) 100%)"></div>`, { scale: 1 })
shoot('blank-card', 500, 500, `<div style="position:absolute;left:100px;top:90px;width:300px;height:300px;border-radius:70px;background:#fff;border:2.5px solid rgba(255,122,0,.55);box-sizing:border-box;box-shadow:0 26px 60px rgba(255,122,0,.22)"></div>`, { scale: 2 })

// --- 3D klasör: dört parça aynı tuvalde (520×600, gövde 340×290, merkezi (260, 300)); sahnede farklı derinlikte dizilir
const FOLD = (inner) => `<div style="position:absolute;left:90px;top:155px;width:340px;height:290px">${inner}</div>`
shoot('folder-shadow', 520, 600, FOLD(`<div style="position:absolute;left:20px;right:20px;top:120px;bottom:-40px;border-radius:60px;background:rgba(255,122,0,.5);filter:blur(44px)"></div>`), { scale: 2 })
shoot('folder-back', 520, 600, FOLD(`<div style="position:absolute;inset:0;border-radius:40px;background:linear-gradient(160deg,#FF8A1F,#E55300)"></div>
  <div style="position:absolute;left:0;top:-34px;width:170px;height:80px;border-radius:30px 34px 0 0;background:#F56A00"></div>`), { scale: 3 })
shoot('folder-papers', 520, 600, FOLD(`<div style="position:absolute;left:150px;top:-52px;width:160px;height:210px;border-radius:16px;background:#2A1A0E;transform:rotate(7deg);box-shadow:0 6px 16px rgba(60,20,0,.25)"><div style="position:absolute;inset:14px;border-radius:10px;background:linear-gradient(135deg,${C.red},${C.orange} 55%,${C.gold})"></div></div>
  <div style="position:absolute;left:44px;top:-44px;width:176px;height:220px;border-radius:16px;background:#fff;transform:rotate(-5deg);box-shadow:0 6px 16px rgba(60,20,0,.22)">
    <svg style="position:absolute;left:62px;top:40px" width="52" height="56" viewBox="0 0 100 108"><path d="M14 8 L88 54 L14 100 Z" fill="${C.orange}" stroke="${C.orange}" stroke-width="14" stroke-linejoin="round"/></svg>
    <div style="position:absolute;left:28px;right:28px;top:116px;height:12px;border-radius:6px;background:#EADFD0"></div><div style="position:absolute;left:28px;width:80px;top:140px;height:12px;border-radius:6px;background:#EADFD0"></div></div>`), { scale: 3 })
shoot('folder-front', 520, 600, FOLD(`<div style="position:absolute;left:0;right:0;top:78px;bottom:0;border-radius:26px 40px 40px 40px;background:linear-gradient(180deg,rgba(255,196,120,.86),rgba(255,138,24,.94) 55%,rgba(244,98,0,.97));box-shadow:inset 0 3px 0 rgba(255,255,255,.6), inset 0 -12px 30px rgba(190,60,0,.22)"></div>
  <div style="position:absolute;left:0;top:78px;right:0;height:90px;border-radius:26px 40px 60px 60px;background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(255,255,255,0))"></div>
  <div style="position:absolute;left:34px;bottom:58px;width:120px;height:16px;border-radius:8px;background:rgba(255,255,255,.95)"></div>
  <div style="position:absolute;left:34px;bottom:34px;width:76px;height:10px;border-radius:5px;background:rgba(255,255,255,.6)"></div>
  <div style="position:absolute;right:30px;bottom:34px;width:34px;height:34px">${SPARK('#fff')}</div>`), { scale: 3 })
// --- bırakma paneli: beyaz cam, altta zaman çizelgesi şeritleri (panel 1580×880, görselde 160 px içeride)
shoot('panel', 1900, 1200, `<div style="position:absolute;inset:160px;border-radius:46px;background:#fff;border:${EDGE};border-bottom:4px solid rgba(255,122,0,.7);box-shadow:${GLOW}">
    <div style="position:absolute;left:50px;right:50px;top:50px;bottom:250px;border-radius:30px;border:2.5px dashed #D9CFC0;background:#FBF8F3"></div>
    ${[0, 1, 2].map((i) => `<div style="position:absolute;left:${50 + i * 110}px;bottom:${178 - i * 58}px;width:${[620, 460, 760][i]}px;height:38px;border-radius:14px;background:${[C.orange, C.gold, C.leaf][i]}"></div>`).join('')}
    <div style="position:absolute;left:50px;right:50px;bottom:240px;height:1.5px;background:#EFE9E0"></div>
  </div>`)

// --- şablon kartları: kendi kapaklarımız, beyaz kart + turuncu kenar ve ışık (kart 500×400, görsel 720×620, kart (110, 90)'da)
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
for (const c of CARDS) shoot(`card-${c.id}`, 720, 620, `<div style="position:absolute;left:110px;top:90px;box-shadow:${SHADOW};border-radius:26px">${cardHtml(c, '2.5px solid rgba(255,122,0,.6)')}</div>`, { scale: 3 })

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
  // çerçeve görselde 140 px içeride: arayüz 1600×1000, görsel 1880×1280
  const frame = (inner) => `<div style="position:absolute;inset:140px;border-radius:30px;background:#fff;border:${EDGE};border-left:4px solid rgba(255,122,0,.75);overflow:hidden;box-shadow:${GLOW}">${inner}</div>`
  // Studio: kart ızgarası (3 × 2). Kart konumları şablonda da kullanılıyor (launchAd.ts PICK).
  const studio = frame(`${side}${top(1)}
    ${CARDS.map((c, i) => `<div style="position:absolute;left:${290 + (i % 3) * 430}px;top:${110 + Math.floor(i / 3) * 440}px;transform:scale(.8);transform-origin:0 0">${cardHtml(c)}</div>`).join('')}`)
  shoot(`studio-${lang}`, 1880, 1280, studio)
  // kart seçilince arkada kalan arayüz bulanıklaşır: aynı görselin bulanık hali üste solarak gelir
  shoot(`studio-blur-${lang}`, 1880, 1280, `<div style="position:absolute;inset:0;filter:blur(16px)">${studio}</div>`, { scale: 1 })
  // Studio: liste görünümü
  const rows = [['Launch video', t.today], ['Fintech promo', t.today], ['Words to motion', t.yesterday], ['Fold promo', t.yesterday], ['Crystal', '2 Oct'], ['Wallet promo', '28 Sep']]
  if (lang === 'tr') { rows[0][0] = t.rowTitle; rows[4][1] = '2 Eki'; rows[5][1] = '28 Eyl' }
  const ids = ['mango-ai-ad', 'fintech', 'words-motion', 'fold-promo', 'crystal', 'wallet-promo']
  shoot(`list-${lang}`, 1880, 1280, frame(`${side}${top(0)}
    <div style="position:absolute;left:290px;right:40px;top:104px;height:40px;display:flex;font:500 16px/40px Inter;color:${C.muted};border-bottom:1px solid ${C.line}"><div style="width:700px;padding-left:120px;box-sizing:border-box">${t.name}</div><div style="width:260px">${t.format}</div><div>${t.edited}</div></div>
    ${rows.map(([name, when], i) => `<div style="position:absolute;left:290px;right:40px;top:${152 + i * 128}px;height:116px;border-radius:18px;background:${i === 0 ? '#FFF6EC' : 'transparent'};border:1px solid ${i === 0 ? '#FFD9B0' : 'transparent'};display:flex;align-items:center;font:500 21px Inter;color:${C.ink}">
        <div style="width:96px;height:66px;margin:0 22px 0 14px;border-radius:12px;background:#111 url(${poster(ids[i])}) center/cover no-repeat;flex:none"></div>
        <div style="width:566px">${name}</div><div style="width:260px;color:${C.muted};font-weight:400">${i < 4 ? '16:9' : '9:16'} · 60 fps</div><div style="color:${C.muted};font-weight:400">${when}</div></div>`).join('')}`))
  // yakın plandaki satır (düğme ayrı katman): satır 2600×320, görsel 3000×720, 200 px içeride
  shoot(`row-${lang}`, 3000, 720, `<div style="position:absolute;left:200px;top:200px;width:2600px;height:320px;border-radius:56px;background:#fff;box-sizing:border-box;border:3px solid rgba(255,122,0,.45);box-shadow:0 60px 120px rgba(255,122,0,.30), 0 8px 24px rgba(60,30,0,.08);display:flex;align-items:center">
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
