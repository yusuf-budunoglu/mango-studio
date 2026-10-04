// "Mango AI ad" şablonunun görselleri: HTML → başsız Chrome → saydam PNG (public/templates/saas-ad).
//   node scripts/build-saas-ad-assets.mjs
// Ölçüler 1920×1080 kadrajın pikselinde; PNG'ler 2 kat (yakın planlarda 4 kat) çözünürlükte çizilir.
// Hepsi bizim tasarımımız (Mango Studio renkleri, logo public/brand). Kart görselleri kendi şablon kapaklarımız.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/saas-ad'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'saas-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
@font-face { font-family: Grotesk; font-weight: 700; src: url(${font('space-grotesk-700.woff')}); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
${css}
</style></head><body>${body}</body></html>`

function shoot(name, w, h, body, { scale = 2, css = '' } = {}) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  const out = path.resolve(OUT, `${name}.png`)
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000',
    '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' })
  console.log(name, `${w * scale}×${h * scale}`)
}

// Mango degradesi (yazı ve düğmeler): kırmızı → turuncu → altın
const GRAD = 'linear-gradient(90deg,#E23D2A 0%,#F0642A 35%,#F59A2C 70%,#F2C230 100%)'
const SPARK = (c = '#fff') => `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5C11.1 16.9 7.1 12.9 1.5 12 7.1 11.1 11.1 7.1 12 1.5Z" fill="${c}"/></svg>`
const COPY = {
  en: { intel: 'with intelligence', chip: 'Attach files', gen: 'Generate', meet: 'Meet Mango Studio' },
  tr: { intel: 'yapay zekâyla', chip: 'Dosya ekle', gen: 'Oluştur', meet: 'Mango Studio ile tanış' },
}

fs.mkdirSync(OUT, { recursive: true })

// 1) Açılış fonunun renk lekeleri (yumuşak, kenarı saydam)
for (const [id, c] of Object.entries({ orange: '#F2641E', red: '#C92F28', gold: '#F3A61F', plum: '#6A1B4D', ember: '#8F2A12' })) {
  shoot(`blob-${id}`, 600, 600, `<div style="width:600px;height:600px;border-radius:50%;background:radial-gradient(closest-side,${c} 0%,${c}cc 35%,${c}00 100%)"></div>`, { scale: 1 })
}

// 2) Parlak kıvrımlı yüzey (turuncu cam), 2200×1240: üstte ve altta kavisli bantlar, kenarları parlak
shoot('gloss', 2200, 1240, `<svg width="2200" height="1240" viewBox="0 0 2200 1240">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#C2410C"/><stop offset=".55" stop-color="#E4621A"/><stop offset="1" stop-color="#B93A0B"/></linearGradient>
    <radialGradient id="glow" cx=".35" cy=".45" r=".6"><stop offset="0" stop-color="#FF9A3C" stop-opacity=".75"/><stop offset="1" stop-color="#FF9A3C" stop-opacity="0"/></radialGradient>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB25A"/><stop offset=".25" stop-color="#F07A22"/><stop offset="1" stop-color="#C74A10"/></linearGradient>
    <linearGradient id="band2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E86A1C"/><stop offset=".8" stop-color="#FF8F35"/><stop offset="1" stop-color="#FFC27A"/></linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="2200" height="1240" fill="url(#bg)"/>
  <rect width="2200" height="1240" fill="url(#glow)"/>
  <path d="M-40 60 Q1100 150 2240 20 L2240 -40 L-40 -40Z" fill="url(#band)"/>
  <path d="M-40 60 Q1100 150 2240 20" stroke="#FFD9A8" stroke-width="3" fill="none" opacity=".9"/>
  <path d="M-40 1130 L1780 930 Q1960 910 2040 1010 L2240 1240 L-40 1240Z" fill="url(#band2)"/>
  <path d="M-40 1130 L1780 930 Q1960 910 2040 1010 L2240 1240" stroke="#FFE7C4" stroke-width="4" fill="none"/>
  <path d="M1760 960 Q1950 930 2030 1030" stroke="#FFF1DC" stroke-width="18" fill="none" opacity=".55" filter="url(#soft)"/>
</svg>`, { scale: 1 })

for (const [lang, c] of Object.entries(COPY)) {
  // 3) Degrade başlık (beyaz fonda) + yıldız
  shoot(`intel-${lang}`, 1200, 180, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
    font:500 132px/1 Inter;letter-spacing:-0.035em;background:${GRAD};-webkit-background-clip:text;color:transparent">${c.intel}</div>`)
  // 4) Dosya ekle rozeti ve Oluştur düğmesi
  // Dosya ekle düğmesi: yumuşak köşeli (14 px) açık gri düğme, ince kenar ve hafif gölge; kenarı saydam (gölge payı 8 px)
  shoot(`chip-${lang}`, 206, 62, `<div style="position:absolute;left:8px;top:6px;box-sizing:border-box;height:46px;display:inline-flex;align-items:center;gap:9px;padding:0 18px 0 15px;border-radius:14px;background:#F5F6F8;border:1px solid #E3E6EB;box-shadow:0 1px 2px rgba(30,40,70,.08),0 3px 8px rgba(30,40,70,.05);font:500 19px Inter;color:#4A4F5A;white-space:nowrap">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4A4F5A" stroke-width="2" stroke-linecap="round"><path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L10 17.8a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>${c.chip}</div>`, { scale: 3 })
  // Oluştur düğmesi (yıldızsız; yıldız her sahnede aynı orantıda ayrı katman). Referans orantıları: en/boy 3.22,
  // yazı genişliğin %37.2'sinden başlar, büyük harf yüksekliği boyun %26'sı (Inter 500, 54 px)
  shoot(`generate-bare-${lang}`, 480, 150, `<div style="position:absolute;inset:0;border-radius:75px;background:${GRAD}"></div>
    <div style="position:absolute;left:178.6px;top:0;height:150px;display:flex;align-items:center;font:500 54px Inter;letter-spacing:-0.02em;color:#fff">${c.gen}</div>`, { scale: 4 })
  // 8) "Meet Mango Studio" satırı (degrade)
  shoot(`meet-${lang}`, 1400, 150, `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:500 118px/1 Inter;letter-spacing:-0.04em;white-space:nowrap;
    background:${GRAD};-webkit-background-clip:text;color:transparent">${c.meet}</div>`)
}
// 3. sahnede yazıyı soldan açan beyaz plaka (sol kenarı 160 px yumuşak)
shoot('eraser-white', 2000, 400, `<div style="width:2000px;height:400px;background:linear-gradient(90deg,rgba(255,255,255,0) 0,#fff 160px,#fff 100%)"></div>`, { scale: 1 })
// Oluştur düğmesinin yıldızı ayrı (tıklamada döner)
shoot('spark', 64, 64, SPARK(), { scale: 4 })
shoot('spark-grad', 64, 64, `<svg viewBox="0 0 24 24" width="64" height="64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2C230"/><stop offset="1" stop-color="#E23D2A"/></linearGradient></defs>
  <path d="M12 1.5c.9 5.6 4.9 9.6 10.5 10.5-5.6.9-9.6 4.9-10.5 10.5C11.1 16.9 7.1 12.9 1.5 12 7.1 11.1 11.1 7.1 12 1.5Z" fill="url(#g)"/></svg>`, { scale: 4 })

// İstem kartı (beyaz, yumuşak gölge) 1240×500 (+ gölge payı)
shoot('card', 1360, 620, `<div style="position:absolute;left:60px;top:50px;width:1240px;height:500px;border-radius:28px;background:#fff;box-shadow:0 24px 60px rgba(30,40,70,.10),0 2px 6px rgba(30,40,70,.06)"></div>`)
// Küçük kart (kontrol listesi, "hazır") 820×110 birim satır; kart yüksekliği değişebilsin diye üç boy
for (const [id, h] of Object.entries({ row1: 178, row2: 336, row3: 494 })) {
  shoot(`list-${id}`, 940, h + 120, `<div style="position:absolute;left:60px;top:50px;width:820px;height:${h}px;border-radius:22px;background:#fff;box-shadow:0 20px 50px rgba(30,40,70,.10),0 2px 6px rgba(30,40,70,.06)"></div>`)
}
shoot('list-ready', 1120, 300, `<div style="position:absolute;left:60px;top:50px;width:1000px;height:180px;border-radius:22px;background:#fff;box-shadow:0 20px 50px rgba(30,40,70,.10),0 2px 6px rgba(30,40,70,.06)"></div>`)
// İmleç (siyah ok, beyaz kenar) ve degrade yazı imleci
shoot('cursor', 120, 120, `<svg width="120" height="120" viewBox="0 0 120 120"><path d="M14 10 L100 52 L60 64 L46 104 Z" fill="#111" stroke="#fff" stroke-width="6" stroke-linejoin="round"/></svg>`)
shoot('caret', 16, 200, `<div style="width:16px;height:200px;border-radius:8px;background:linear-gradient(180deg,#F2C230,#F0642A 50%,#E23D2A)"></div>`)
// Onay ve dönen halka ikonları
shoot('check', 48, 48, `<svg width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#3F8C3C"/><path d="M14 24.5l7 7 13-14" stroke="#fff" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`, { scale: 3 })
shoot('spinner', 48, 48, `<svg width="48" height="48" viewBox="0 0 48 48">${Array.from({ length: 8 }, (_, i) => `<rect x="22" y="3" width="4" height="11" rx="2" fill="#F0642A" opacity="${(0.25 + (i / 8) * 0.75).toFixed(2)}" transform="rotate(${i * 45} 24 24)"/>`).join('')}</svg>`, { scale: 3 })

// 9) Kod: projenin JSON'u (Mango Studio formatı), sözdizimi renkli, yukarı kayar
const json = [
  ['{', 0], ['"name": "Launch video",', 1], ['"fps": 60, "width": 1920, "height": 1080,', 1], ['"layers": [', 1],
  ['{ "kind": "phone", "name": "Hero phone",', 2], ['"blocks": [', 3], ['{ "preset": "slide-up", "start": 0.2, "duration": 0.9 },', 4],
  ['{ "preset": "move", "params": { "rotY": -25, "scaleBy": 1.2 } },', 4], ['{ "preset": "float", "params": { "amount": 0.12 } }', 4], [']', 3], ['},', 2],
  ['{ "kind": "text", "text": "Your app, in motion.",', 2], ['"fontFamily": "space-grotesk", "fontWeight": 700,', 3], ['"blocks": [{ "preset": "soft-reveal", "start": 1.4 }]', 3], ['},', 2],
  ['{ "kind": "image", "name": "Logo", "image": "mango.png",', 2], ['"blocks": [{ "preset": "pop", "start": 3.1, "duration": 0.7 }]', 3], ['}', 2], ['],', 1],
  ['"camera": { "blocks": [', 1], ['{ "preset": "camera-push", "duration": 4, "params": { "distance": 1.5 } },', 2], ['{ "preset": "lens-punch", "start": 3.1 }', 2], [']},', 1],
  ['"effects": { "motionBlur": { "enabled": true }, "bloom": { "enabled": true } }', 1], ['}', 0],
]
// tek geçişte renklendir: anahtar turuncu, metin değeri yeşil, sayı mor
const hl = (s) => s.replace(/("[^"]*")(\s*:)?|(-?\d+\.?\d*)/g, (m, str, colon, num) =>
  num !== undefined ? `<span style="color:#8a4bd6">${num}</span>` : colon ? `<span style="color:#C4501E">${str}</span>${colon}` : `<span style="color:#3F8C3C">${str}</span>`)
shoot('code', 1500, json.length * 44 + 40, `<div style="padding:20px 0;font:400 30px/44px 'Consolas','Menlo',monospace;color:#2b2320;white-space:pre">${json.map(([l, i]) => `${'  '.repeat(i)}${hl(l)}`).join('\n')}</div>`)
shoot('glow-pink', 1200, 800, `<div style="width:1200px;height:800px;background:radial-gradient(closest-side,rgba(247,156,90,.55),rgba(242,100,120,.25) 55%,rgba(255,255,255,0))"></div>`, { scale: 1 })

// 11) Yelpaze kartları: kendi şablonlarımızın kapakları, Mango Studio şablon kartı görünümünde
const CARDS = [
  { id: 'fintech', title: 'Fintech promo', meta: '16:9 · 19.3 s', img: 'public/templates/posters/fintech.jpg' },
  { id: 'wallet', title: 'Wallet promo', meta: '9:16 · 19.1 s', img: 'public/templates/posters/wallet-promo.jpg' },
  { id: 'ai', title: 'AI search ad', meta: '9:16 · 21.8 s', img: 'public/templates/posters/ai-search-ad.jpg' },
  { id: 'words', title: 'Words to motion', meta: '16:9 · 11.3 s', img: 'public/templates/posters/words-motion.jpg' },
  { id: 'meadow', title: 'Meadow phone', meta: '9:16 · 8 s', img: 'public/templates/posters/meadow-phone.jpg' },
]
for (const c of CARDS) {
  shoot(`tpl-${c.id}`, 560, 520, `<div style="position:absolute;inset:10px;border-radius:26px;background:#fff;box-shadow:0 20px 40px rgba(0,0,0,.18);overflow:hidden">
    <div style="display:flex;align-items:center;gap:12px;padding:22px 24px 16px">
      <img src="${url('public/brand/mango-mark-96.png')}" style="width:34px;height:34px;border-radius:9px;background:#0A0A0B;padding:3px;box-sizing:border-box">
      <div style="font:700 24px Inter;color:#15171c;flex:1">${c.title}</div>
      <div style="font:700 17px Inter;color:#D9711C;background:#FDF0E4;padding:7px 14px;border-radius:14px">Use</div>
    </div>
    <div style="margin:0 24px;height:300px;border-radius:16px;background:#0A0A0B url(${url(c.img)}) center/cover no-repeat"></div>
    <div style="display:flex;justify-content:space-between;padding:18px 26px;font:400 19px Inter;color:#6a6f7a"><span>${c.meta}</span><span>60 fps · 4K</span></div>
  </div>`)
}

// 12) Kapanış: beyaz çizilir, sahnede katman rengiyle boyanır (tint) → renkler şablonda düzenlenebilir
shoot('rays', 2200, 1240, `<svg width="2200" height="1240" viewBox="0 0 2200 1240"><defs>
  <linearGradient id="r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <filter id="b"><feGaussianBlur stdDeviation="28"/></filter></defs>
  <g filter="url(#b)" fill="url(#r)">
    <path d="M150 -60 L330 -60 L1150 1240 L900 1240Z"/><path d="M520 -60 L640 -60 L1380 1240 L1210 1240Z" opacity=".7"/>
    <path d="M820 -60 L1010 -60 L1720 1240 L1480 1240Z" opacity=".85"/><path d="M1260 -60 L1340 -60 L1950 1240 L1830 1240Z" opacity=".55"/>
    <path d="M1600 -60 L1760 -60 L2300 1240 L2100 1240Z" opacity=".6"/></g></svg>`, { scale: 1 })
// cam kutu: dolgu ve çerçeve ayrı (ikisi de beyaz, renk katmandan)
shoot('end-pill-fill', 1060, 200, `<div style="position:absolute;left:20px;top:20px;width:1020px;height:160px;border-radius:80px;background:rgba(255,255,255,.10);box-shadow:0 30px 60px rgba(0,0,0,.35)"></div>`)
shoot('end-pill-ring', 1060, 200, `<div style="box-sizing:border-box;position:absolute;left:20px;top:20px;width:1020px;height:160px;border-radius:80px;border:2.5px solid rgba(255,255,255,.55);box-shadow:inset 0 2px 0 rgba(255,255,255,.25)"></div>`)
// neon çerçeve: parlak çizgi + dışa/içe yumuşak ışıma. Sahnede light-sweep bloğu yalnızca dönen ışıkların olduğu
// yerleri gösterir (kutu 1020×160, görselde 40 px boşluk → inset 40/240)
shoot('end-pill-neon', 1100, 240, `<div style="box-sizing:border-box;position:absolute;left:40px;top:40px;width:1020px;height:160px;border-radius:80px;border:3px solid #fff;box-shadow:0 0 5px rgba(255,255,255,.95),0 0 16px rgba(255,255,255,.6),0 0 34px rgba(255,255,255,.25),inset 0 0 12px rgba(255,255,255,.4)"></div>`)
