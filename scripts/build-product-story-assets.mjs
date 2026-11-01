// "Product story" şablonunun görselleri ve yazı genişlikleri: HTML → başsız Chrome → PNG (public/templates/product-story).
//   node scripts/build-product-story-assets.mjs [grup ...]   (gruplar: room, ui, flat, metrics; boşsa hepsi)
// Hepsi bizim çizimimiz (referanstan piksel/asset alınmadı):
// - room: 1. sahnenin odası. Duvar, zemin, sütunlar, kaide ve kurdeleler beyaz/gri gölgeli çizilir, sahnede katman
//   rengiyle boyanır (`tint`); laptop ekranı Mango karşılama ekranı (koyu, logo kuralı gereği), EN/TR.
// - ui: arayüz görselleri (değerlendirme kartı, stüdyo paneli ve grafikleri, senaryo penceresi, istem kutusu, asistan
//   kartı), EN/TR. Yazılan metinler görsele gömülü değil: şablonda metin katmanı.
// - flat: yumuşak ışık lekesi, yükleniyor simgesi, yıldız (beyaz; sahnede boyanır).
// Betik ayrıca şablondaki kelimelerin genişliklerini (Inter 400 / 600, Fraunces 700; em) ölçüp
// src/project/productStoryMetrics.ts'e yazar: metin ya da dil değişirse `WORDS` listesine ekle.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/product-story'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'product-story-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)
const groups = process.argv.slice(2)
const want = (g) => groups.length === 0 || groups.includes(g)

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
@font-face { font-family: Fraunces; font-weight: 700; src: url(${font('fraunces-700.woff')}); }
@font-face { font-family: Grotesk; font-weight: 700; src: url(${font('space-grotesk-700.woff')}); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; color: #2A2420; }
.abs { position: absolute; }
${css}
</style></head><body>${body}</body></html>`

const chrome = (args) => execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', ...args], { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })

function shoot(name, w, h, body, { scale = 2, css = '' } = {}) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  const out = path.resolve(OUT, `${name}.png`)
  chrome([`--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000', '--virtual-time-budget=2500', `--screenshot=${out}`, pathToFileURL(html).href])
  console.log(name, `${Math.round(w * scale)}×${Math.round(h * scale)}`, fs.statSync(out).size)
}

// Renkler (arayüz görsellerinde; sahne renkleri şablonda katman rengi)
const INK = '#2E2E33'
const MUTED = '#8A8A93'
const LINE = '#E3E3EA'
// vurgular referansın renk düzeninde (mavi-lila); Mango logosu ve kelime işareti kendi renginde
const BLUE = '#5B64DB'
const BLUE_DEEP = '#4A55D6'
const LILAC = '#A9AEE5'
const PALE = '#ECEEFC'
const BRAND = '#FF7A00'
const GOLD = '#F5C842'
const LOGO = url('public/brand/mango-mark.png')

// Metinler (src/i18n/locales ile aynı olmalı: şablon katmanlarındaki metinler oradan gelir; görsellerdekiler buradan)
const TEXT = {
  en: {
    ready: 'Ready to start creating?',
    review: 'Project Review', cols: ['Motion', 'Timing', 'Sound', 'Typography'], score: ['Mango', 'Score'],
    nav: ['Home', 'Projects', 'Templates', 'Settings'], help: 'Help center', upgrade: 'Upgrade now',
    summary: 'Studio Summary', summarySub: 'Overview of your studio activity',
    tiles: [['Total projects', '60', 'All saved projects'], ['Renders this week', '24', 'Finished videos'], ['Exports', '18', 'Downloaded files'], ['Shared links', '7', 'Sent to clients']],
    charts: [['Projects by stage', 'From idea to final render'], ['Export formats', 'Share of formats this month'], ['Motion quality', 'Average score by category']],
    radar: ['Easing', 'Timing', 'Depth', 'Rhythm'],
    board: 'Storyboard', project: 'Project:', projectName: 'Summer Launch', kind: 'Product video', tabs: ['Script', 'Scenes', 'All formats'], generate: 'Generate Video',
    assistant: 'Scene assistant', sent: 'Sent',
  },
  tr: {
    ready: 'Üretmeye hazır mısın?',
    review: 'Proje Değerlendirmesi', cols: ['Hareket', 'Zamanlama', 'Ses', 'Tipografi'], score: ['Mango', 'Puanı'],
    nav: ['Ana sayfa', 'Projeler', 'Şablonlar', 'Ayarlar'], help: 'Yardım merkezi', upgrade: 'Yükselt',
    summary: 'Stüdyo Özeti', summarySub: 'Stüdyondaki hareketlerin özeti',
    tiles: [['Toplam proje', '60', 'Kayıtlı projeler'], ['Bu hafta render', '24', 'Biten videolar'], ['Dışa aktarma', '18', 'İndirilen dosyalar'], ['Paylaşılan bağlantı', '7', 'Müşterilere giden']],
    charts: [['Aşamaya göre projeler', 'Fikirden son render’a'], ['Dışa aktarma biçimleri', 'Bu ayki biçim payları'], ['Hareket kalitesi', 'Kategoriye göre ortalama']],
    radar: ['Yumuşaklık', 'Zamanlama', 'Derinlik', 'Ritim'],
    board: 'Senaryo', project: 'Proje:', projectName: 'Yaz Lansmanı', kind: 'Ürün videosu', tabs: ['Metin', 'Sahneler', 'Tüm biçimler'], generate: 'Video Oluştur',
    assistant: 'Sahne asistanı', sent: 'Gönderildi',
  },
}

// Şablondaki metin katmanlarının kelimeleri (genişlikleri ölçülür). i18n dosyalarıyla aynı tutulmalı.
const WORDS_TEXT = [
  'The studio for', 'motion design', 'Preview every scene at a', 'glance', 'And generate', 'Generate Video', 'from first idea', 'final render',
  'Hareketli tasarım için', 'akıllı stüdyo', 'Her sahneyi tek', 'bakışta', 'Ve üret', 'Video Oluştur', 'ilk fikirden', 'son kurguya',
  'I need a launch video for my app', 'Uygulamam için bir tanıtım videosu lazım', 'turn ideas into motion', 'fikri videoya çeviren stüdyo',
  'mangostudio.design',
]
const WORDS = [...new Set(WORDS_TEXT.flatMap((s) => s.split(' ')))]

fs.mkdirSync(OUT, { recursive: true })

// ------------------------------------------------------------------ yazı genişlikleri
if (want('metrics')) {
  const html = path.join(TMP, 'metrics.html')
  fs.writeFileSync(html, page(10, 10, '<pre id="o"></pre>', '') + `<script>
    Promise.all([document.fonts.load('400 100px Inter'), document.fonts.load('600 100px Inter'), document.fonts.load('700 100px Fraunces')]).then(() => {
      const ctx = document.createElement('canvas').getContext('2d'); const out = {};
      const em = (text) => ['400 1000px Inter', '600 1000px Inter', '700 1000px Fraunces'].map((f) => { ctx.font = f; return Math.round(ctx.measureText(text).width * 10) / 1e4 });
      for (const w of ${JSON.stringify([...WORDS, ' '])}) out[w] = em(w);
      document.getElementById('o').textContent = 'METRICS' + JSON.stringify(out) + 'END';
    })</script>`)
  const dom = chrome(['--virtual-time-budget=3000', '--dump-dom', pathToFileURL(html).href]).toString('utf8')
  const m = /METRICS(.*?)END/s.exec(dom)
  if (!m) throw new Error('kelime genişlikleri ölçülemedi')
  const data = JSON.parse(m[1].replace(/&amp;/g, '&'))
  const lines = Object.entries(data).map(([w, v]) => `  ${JSON.stringify(w)}: [${v.join(', ')}],`).join('\n')
  fs.writeFileSync('src/project/productStoryMetrics.ts', `// node scripts/build-product-story-assets.mjs metrics ile üretilir; elle düzenleme.\n// Kelime ilerleme genişlikleri (em): [Inter 400, Inter 600, Fraunces 700]\nexport const STORY_EM: Record<string, [number, number, number]> = {\n${lines}\n}\n`)
  console.log('metrics', Object.keys(data).length)
}

// ------------------------------------------------------------------ oda (1. sahne). Ölçüler son kadrajın pikseli;
// tuval kadrajdan 240 / 135 px taşar (dolly zoom'da kenarlar boş kalmasın): kadraj (0,0) → tuval (240,135).
if (want('room')) {
  const OX = 240
  const OY = 135
  const RW = 1920 + 2 * OX
  const RH = 1080 + 2 * OY
  // pencere: kadrajda x 464–1447, y 180–640 (köşe 56)
  const win = { x: 464 + OX, y: 180 + OY, w: 983, h: 460, r: 56 }
  // duvar: beyaz, üstte ve kenarlarda gölgeli; pencere deliği saydam (maske), deliğin içinde kalınlık (iç yüz)
  shoot('room-wall', RW, RH, `
    <div class="abs" style="left:0;top:0;width:${RW}px;height:${855 + OY}px;
      background: radial-gradient(ellipse 900px 520px at ${win.x + win.w / 2}px ${win.y + win.h / 2}px, #ffffff 0%, #f1f1f1 45%, #c9c9c9 100%);
      clip-path: path(evenodd, 'M0 0 H${RW} V${855 + OY} H0 Z M${win.x + win.r} ${win.y} H${win.x + win.w - win.r} A${win.r} ${win.r} 0 0 1 ${win.x + win.w} ${win.y + win.r} V${win.y + win.h - win.r} A${win.r} ${win.r} 0 0 1 ${win.x + win.w - win.r} ${win.y + win.h} H${win.x + win.r} A${win.r} ${win.r} 0 0 1 ${win.x} ${win.y + win.h - win.r} V${win.y + win.r} A${win.r} ${win.r} 0 0 1 ${win.x + win.r} ${win.y} Z');
"></div>
    <!-- pencerenin iç yüzü (kalınlık): alt kenarda aydınlık pervaz, üstte ve yanlarda gölge -->
    <div class="abs" style="left:${win.x}px;top:${win.y}px;width:${win.w}px;height:${win.h}px;border-radius:${win.r}px;
      box-shadow: inset 0 26px 22px -10px rgba(0,0,0,0.28), inset 22px 0 18px -12px rgba(0,0,0,0.18), inset -22px 0 18px -12px rgba(0,0,0,0.18), inset 0 -18px 0 -6px rgba(255,255,255,0.9);"></div>
    <!-- pencerenin altındaki çıkıntı (raf) -->
    <div class="abs" style="left:${win.x - 40}px;top:${640 + OY}px;width:${win.w + 80}px;height:60px;background:linear-gradient(#ffffff,#d8d8d8);border-radius:0 0 18px 18px;opacity:0.9"></div>
    <div class="abs" style="left:0;top:${700 + OY}px;width:${RW}px;height:40px;background:linear-gradient(rgba(0,0,0,0.22),rgba(0,0,0,0));"></div>
  `, { scale: 1 })
  // zemin: parlak, ufukta pencerenin yansıması, yatay ışık çizgileri; aşağıya doğru aydınlanır
  shoot('room-floor', RW, 1080 - 690 + OY, `
    <div class="abs" style="inset:0;background:linear-gradient(#e9e9e9 0%, #bdbdbd 18%, #cfcfcf 45%, #f2f2f2 100%)"></div>
    <div class="abs" style="left:${win.x - 60}px;top:6px;width:${win.w + 120}px;height:120px;background:radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.95), rgba(255,255,255,0) 70%);filter:blur(6px)"></div>
    ${Array.from({ length: 14 }, (_, i) => {
      const y = 30 + i * i * 2.1 + i * 10
      const x = (i * 397) % 1600
      return `<div class="abs" style="left:${x}px;top:${y}px;width:${700 + (i % 4) * 260}px;height:${2 + (i % 3)}px;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.9),rgba(255,255,255,0));filter:blur(1.5px)"></div>`
    }).join('')}
  `, { scale: 1 })
  // sütunlar ve yan duvarlar (kadrajda sol sütun x 130–230, sağ 1690–1790)
  const column = (x, flip) => `
    <div class="abs" style="left:${x + OX}px;top:0;width:100px;height:${760 + OY}px;background:linear-gradient(90deg, ${flip ? '#bdbdbd, #f4f4f4 60%, #ffffff' : '#ffffff, #f4f4f4 40%, #bdbdbd'});box-shadow:0 0 30px rgba(0,0,0,0.15)"></div>
    <div class="abs" style="left:${flip ? x + OX + 100 : 0}px;top:0;width:${flip ? RW - (x + OX + 100) : x + OX}px;height:${760 + OY}px;background:linear-gradient(90deg, ${flip ? '#d9d9d9, #ffffff' : '#ffffff, #d9d9d9'})"></div>
    <div class="abs" style="left:${flip ? x + OX + 160 : x + OX - 150}px;top:${120 + OY}px;width:90px;height:${520}px;border-radius:26px;background:linear-gradient(#fbfbfb,#e6e6e6);opacity:0.9"></div>`
  shoot('room-columns', RW, RH, column(130, false) + column(1690, true), { scale: 1 })
  // pencerenin dışındaki bulutlar (yumuşak beyaz kümeler; boyanır)
  shoot('room-clouds', 1200, 360, Array.from({ length: 9 }, (_, i) => {
    const x = 40 + i * 130
    const s = 160 + ((i * 53) % 120)
    return `<div class="abs" style="left:${x}px;top:${200 - s / 3}px;width:${s * 1.6}px;height:${s}px;border-radius:50%;background:#fff;filter:blur(26px);opacity:0.85"></div>`
  }).join(''), { scale: 1 })
  // kaide: silindir (üst elips aydınlık, yan yüz degrade)
  shoot('pedestal', 620, 330, `
    <div class="abs" style="left:50px;top:40px;width:520px;height:290px;background:linear-gradient(90deg,#cfcfcf,#ffffff 35%,#f2f2f2 60%,#c4c4c4);border-radius:0 0 30px 30px"></div>
    <div class="abs" style="left:50px;top:6px;width:520px;height:74px;border-radius:50%;background:radial-gradient(ellipse at 45% 40%, #ffffff, #ececec 70%, #d6d6d6);box-shadow:0 4px 0 #e0e0e0"></div>
  `, { scale: 2 })
  // kurdeleler: üst köşeden geniş bir bantla inip pencerenin önünde sivri uçla biten saten şerit (sol; sağ olanı aynası).
  // Tuval 560 × 560: bandın üstü x 20–190 (y 0), sivri uç (540, 500); şablon bu noktaları kullanır.
  const ribbon = (flip) => `
    <svg width="560" height="560" viewBox="0 0 560 560" style="${flip ? 'transform:scaleX(-1)' : ''}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#dcdcdc"/><stop offset="0.6" stop-color="#ffffff"/><stop offset="1" stop-color="#e2e2e2"/>
        </linearGradient>
        <linearGradient id="h" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.9"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
        </linearGradient>
        <filter id="s"><feGaussianBlur stdDeviation="0.8"/></filter>
      </defs>
      <path d="M40 0 H140 C 170 160, 290 340, 540 500 C 470 498, 390 468, 310 418 C 190 330, 80 190, 40 0 Z" fill="url(#g)" filter="url(#s)"/>
      <path d="M150 0 C 180 160, 280 340, 520 492" stroke="url(#h)" stroke-width="6" fill="none" filter="url(#s)"/>
    </svg>`
  shoot('ribbon-l', 560, 560, ribbon(false), { scale: 2 })
  shoot('ribbon-r', 560, 560, ribbon(true), { scale: 2 })
  // laptop ekranı: koyu karşılama (oran 1.54), Mango logosu + kelime işareti + soru + ok
  for (const lang of ['en', 'tr']) {
    shoot(`laptop-screen-${lang}`, 1540, 1000, `
      <div class="abs" style="inset:0;background:radial-gradient(ellipse 900px 600px at 40% 35%, #6A75EA 0%, #4F5ADB 75%)"></div>
      <div class="abs" style="left:0;right:0;top:330px;display:flex;align-items:center;justify-content:center;gap:28px">
        <img src="${LOGO}" style="width:150px;height:150px">
        <span style="font-family:Grotesk;font-weight:700;font-size:110px;letter-spacing:-0.04em;color:#fff">mango<span style="color:${BRAND}">studio</span></span>
      </div>
      <div class="abs" style="left:0;right:0;top:560px;text-align:center;font-size:52px;font-weight:500;color:#F4F1EC">${TEXT[lang].ready}</div>
      <div class="abs" style="left:${770 - 40}px;top:660px;width:74px;height:74px;border-radius:50%;border:5px solid ${GOLD};box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:${GOLD};font-size:44px;font-weight:700">→</div>
    `, { scale: 1 })
  }
}

// ------------------------------------------------------------------ yumuşak ışık, simgeler (beyaz; sahnede boyanır)
if (want('flat')) {
  shoot('glow', 512, 512, '<div class="abs" style="left:96px;top:96px;width:320px;height:320px;border-radius:50%;background:#fff;filter:blur(60px)"></div>', { scale: 1 })
  // yükleniyor simgesi: 8 kısa çizgi (yıldız gibi), ışınların parlaklığı azalan
  shoot('spinner', 128, 128, `<svg width="128" height="128" viewBox="-64 -64 128 128">${Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4
    const o = 1 - i * 0.09
    return `<line x1="${Math.cos(a) * 22}" y1="${Math.sin(a) * 22}" x2="${Math.cos(a) * 50}" y2="${Math.sin(a) * 50}" stroke="#fff" stroke-opacity="${o}" stroke-width="11" stroke-linecap="round"/>`
  }).join('')}</svg>`, { scale: 2 })
  // istem kutusundaki yıldız (dört köşeli parıltı)
  shoot('sparkle', 128, 128, '<svg width="128" height="128" viewBox="0 0 128 128"><path d="M64 6 C 70 44, 84 58, 122 64 C 84 70, 70 84, 64 122 C 58 84, 44 70, 6 64 C 44 58, 58 44, 64 6 Z" fill="#fff"/></svg>', { scale: 2 })
  // düğmenin ve kartların arkasındaki ışıma: yuvarlak köşeli kutu, bulanık (boyanır)
  shoot('glow-box', 1200, 500, '<div class="abs" style="left:150px;top:150px;width:900px;height:200px;border-radius:40px;background:#fff;filter:blur(60px)"></div>', { scale: 1 })
}

// ------------------------------------------------------------------ arayüz görselleri (EN / TR)
if (want('ui')) {
  const M = 160
  const dots = (x, y, s = 14) => `<div class="abs" style="left:${x}px;top:${y}px;display:flex;gap:${s * 0.55}px">${['#F25C54', '#FFB21E', '#46A83F'].map((c) => `<span style="width:${s}px;height:${s}px;border-radius:50%;background:${c}"></span>`).join('')}</div>`
  const brand = (x, y, s) => `<div class="abs" style="left:${x}px;top:${y}px;display:flex;align-items:center;gap:${s * 0.25}px"><img src="${LOGO}" style="width:${s * 1.25}px;height:${s * 1.25}px"><span style="font-family:Grotesk;font-weight:700;font-size:${s}px;letter-spacing:-0.04em;color:${INK}">mango<span style="color:${BRAND}">studio</span></span></div>`
  // beyaz yüzey açık zeminde kaybolmasın: turuncu kenar çizgisi (sol üstte belirgin) + sıcak gölge
  // Sayfa ışığı (referanstaki gibi): sol ve üst kenarda parlayan mavi kenar (sol kenar boydan boya, üst kenar sağa doğru
  // söner), içte kenara yakın hafif mavi yansıma ve dışarı taşan bulanık hale. Hale için görsellerde geniş saydam pay (M).
  const RIM = `linear-gradient(90deg, ${BLUE} 0%, rgba(91,100,219,0.6) 2.5%, rgba(91,100,219,0) 9%), linear-gradient(180deg, rgba(122,130,232,0.95) 0%, rgba(122,130,232,0) 9%), linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 100%)`
  const edge = (r) => `<div class="abs" style="inset:0;border-radius:${r}px;padding:6px;background:${RIM};-webkit-mask:linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude"></div>
    <div class="abs" style="inset:0;border-radius:${r}px;box-shadow:inset 22px 0 46px -24px rgba(91,100,219,0.45), inset 0 18px 40px -24px rgba(122,130,232,0.35);pointer-events:none"></div>`
  /** sayfanın arkasındaki hale: aynı kenar ışığının bulanık kopyası, dışarı taşar */
  const halo = (w, h, r) => `<div class="abs" style="left:${M - 22}px;top:${M - 16}px;width:${w + 30}px;height:${h + 24}px;border-radius:${r + 20}px;background:linear-gradient(90deg, rgba(91,100,219,1) 0%, rgba(122,130,232,0.45) 12%, rgba(169,174,229,0.12) 40%, rgba(169,174,229,0) 70%), linear-gradient(180deg, rgba(122,130,232,0.6) 0%, rgba(169,174,229,0) 25%);filter:blur(44px);opacity:0.9"></div>`

  for (const lang of ['en', 'tr']) {
    const T = TEXT[lang]
    // --- değerlendirme kartı (2. ve 7. sahne): 1666 × 820, alt kenar saydama solar; puan sütunu ayrı görsel
    const CW = 1666
    const CH = 820
    const colX = [666, 822, 980, 1136]
    const rows = [['Launch Ad', [4.9, 5.0, 4.6, 4.2]], ['Feature Drop', [4.7, 4.8, 4.4, 4.9]], ['Coming Soon', [3.4, 4.1, 3.8, 4.4]], ['Crystal', [2.6, 3.1, 2.8, 3.7]]]
    const rowY = [361, 439, 517, 595]
    const heat = (v) => (v >= 4.5 ? '#E4F6E7' : v >= 4 ? '#F1F8E3' : v >= 3.5 ? '#FDF6DD' : v >= 3 ? '#FDEFE0' : '#FCE3E1')
    shoot(`card-review-${lang}`, CW + 2 * M, CH + 2 * M, `
      <div class="abs" style="inset:0;-webkit-mask:linear-gradient(#000 0%, #000 ${((M + CH * 0.74) / (CH + 2 * M)) * 100}%, transparent ${((M + CH) / (CH + 2 * M)) * 100}%)">
      ${halo(CW, CH, 40)}
      <div class="abs" style="left:${M}px;top:${M}px;width:${CW}px;height:${CH}px;border-radius:40px 40px 0 0;background:#fff">
        ${edge(40)}
        ${brand(48, 40, 30)}
        ${dots(CW - 120, 50, 16)}
        <div class="abs" style="left:0;right:0;top:${132 - 38}px;text-align:center;font-size:64px;font-weight:700;letter-spacing:-0.02em;color:${INK}">${T.review}</div>
        <div class="abs" style="left:246px;top:228px;width:1176px;height:560px;border-radius:22px;background:#fff;box-shadow:0 10px 40px rgba(60,60,120,0.10)"></div>
        ${T.cols.map((c, i) => `<div class="abs" style="left:${colX[i] - 75}px;width:150px;top:${276 - 24}px;text-align:center;font-size:21px;font-weight:600;line-height:1.1;color:${INK}">${c}</div>`).join('')}
        <div class="abs" style="left:${1290 - 75}px;width:150px;top:${276 - 24}px;text-align:center;font-size:21px;font-weight:600;line-height:1.1"><span style="color:${BLUE_DEEP}">${T.score[0]}</span><br><span style="color:${BLUE}">${T.score[1]}</span></div>
        ${rows.map(([name, vals], r) => `
          <div class="abs" style="right:${CW - 568}px;top:${rowY[r] - 24}px;font-size:34px;font-weight:400;color:#5A524B;white-space:nowrap">${name}</div>
          ${vals.map((v, i) => `<div class="abs" style="left:${colX[i] - 78}px;top:${rowY[r] - 39}px;width:156px;height:78px;background:${heat(v)};display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:600;color:${INK}">${v.toFixed(1)}</div>`).join('')}
        `).join('')}
      </div></div>
    `, { scale: 1.5 })
    // puan sütunu: turuncu degrade hücreler, beyaz rakamlar (kartla aynı tuvalde: üst üste oturur)
    const scores = [4.8, 4.6, 3.9, 2.9]
    shoot(`card-score-${lang}`, CW + 2 * M, CH + 2 * M, `
      <div class="abs" style="left:${M}px;top:${M}px;width:${CW}px;height:${CH}px;-webkit-mask:linear-gradient(#000 0%, #000 74%, transparent 100%)">
        ${scores.map((v, r) => `<div class="abs" style="left:${1290 - 65}px;top:${rowY[r] - 39}px;width:130px;height:78px;background:${['#5B64DB', '#6E78E2', '#8790E8', '#A3AAEE'][r]};display:flex;align-items:center;justify-content:center;font-size:36px;font-weight:600;color:#fff">${v.toFixed(1)}</div>`).join('')}
      </div>
    `, { scale: 1.5 })

    // --- stüdyo paneli (3. sahne): 2200 × 1300; grafikler ayrı görseller (büyüyerek gelirler)
    const DW = 2200
    const DH = 1900
    const tileColors = ['#EAF0FD', '#F1ECFD', '#FCECF6', '#E8F7FB']
    const tileInk = [BLUE_DEEP, '#7A4FD8', '#C9479A', '#2A93B5']
    shoot(`dashboard-${lang}`, DW + 2 * M, DH + 2 * M, `
      ${halo(DW, DH, 48)}
      <div class="abs" style="left:${M}px;top:${M}px;width:${DW}px;height:${DH}px;border-radius:48px;background:#fff">
        ${edge(48)}
        ${brand(70, 64, 34)}
        ${dots(DW - 150, 70, 18)}
        ${T.nav.map((n, i) => `<div class="abs" style="left:56px;top:${190 + i * 70}px;width:360px;height:52px;border-radius:12px;${i === 1 ? 'background:${PALE};' : ''}display:flex;align-items:center;gap:16px;padding-left:24px;box-sizing:border-box;font-size:24px;color:${i === 1 ? BLUE : MUTED};font-weight:${i === 1 ? 600 : 400}"><span style="width:18px;height:18px;border-radius:5px;border:2.5px solid currentColor"></span>${n}</div>`).join('')}
        <div class="abs" style="left:80px;top:${DH - 220}px;font-size:20px;color:${MUTED}">${T.help}</div>
        <div class="abs" style="left:70px;top:${DH - 170}px;width:250px;height:56px;border-radius:12px;border:2px solid ${LINE};display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:600;color:${INK}">${T.upgrade}</div>
        <div class="abs" style="left:470px;top:0;width:2px;height:${DH}px;background:${LINE}"></div>
        <div class="abs" style="left:${DW - 470}px;top:150px;display:flex;align-items:center;gap:16px"><span style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#8E9BF0,${BLUE_DEEP})"></span><span><b style="font-size:24px">Maya Lee</b><br><span style="font-size:17px;color:${MUTED}">maya@mangostudio.design</span></span></div>
        <div class="abs" style="left:540px;top:270px;width:${DW - 610}px;height:300px;border-radius:24px;background:#fff;box-shadow:0 8px 34px rgba(60,60,120,0.10)">
          <div class="abs" style="left:40px;top:34px;font-size:28px;font-weight:700">${T.summary}</div>
          <div class="abs" style="left:40px;top:74px;font-size:18px;color:${MUTED}">${T.summarySub}</div>
          ${T.tiles.map(([a, v, c], i) => `<div class="abs" style="left:${40 + i * 390}px;top:118px;width:360px;height:150px;border-radius:16px;background:${tileColors[i]}">
            <div class="abs" style="left:24px;top:22px;font-size:18px;color:${INK};font-weight:600">${a}</div>
            <div class="abs" style="left:24px;top:52px;font-size:46px;font-weight:700;color:${tileInk[i]}">${v}</div>
            <div class="abs" style="left:24px;top:112px;font-size:16px;color:${MUTED}">${c}</div></div>`).join('')}
        </div>
        ${T.charts.map(([a, c], i) => `<div class="abs" style="left:${540 + i * 530}px;top:610px;width:500px;height:1240px;border-radius:24px;background:#fff;box-shadow:0 8px 34px rgba(60,60,120,0.10)">
          <div class="abs" style="left:34px;top:30px;font-size:27px;font-weight:700">${a}</div>
          <div class="abs" style="left:34px;top:70px;font-size:17px;color:${MUTED}">${c}</div></div>`).join('')}
      </div>
    `, { scale: 1 })
    // radar etiketleri (grafikle birlikte belirir)
    shoot(`chart-radar-${lang}`, 460, 460, `
      <svg width="460" height="460" viewBox="-230 -230 460 460" class="abs">
        ${[150, 100, 50].map((r) => `<polygon points="0,${-r} ${r},0 0,${r} ${-r},0" fill="none" stroke="${LINE}" stroke-width="2"/>`).join('')}
        <polygon points="0,-128 118,0 0,96 -84,0" fill="#8B6CF0" fill-opacity="0.55" stroke="#7A5AE8" stroke-width="4"/>
      </svg>
      ${T.radar.map((n, i) => `<div class="abs" style="font-size:18px;font-weight:600;color:${INK};${['left:0;right:0;top:18px;text-align:center', 'right:4px;top:200px', 'left:0;right:0;bottom:18px;text-align:center', 'left:4px;top:200px'][i]}">${n}</div>`).join('')}
    `, { scale: 1 })

    // --- senaryo penceresi (6–7. sahne): 1500 × 1000; yazılan satırlar metin katmanı
    const BW = 1500
    const BH = 1000
    shoot(`board-${lang}`, BW + 2 * M, BH + 2 * M, `
      ${halo(BW, BH, 30)}
      <div class="abs" style="left:${M}px;top:${M}px;width:${BW}px;height:${BH}px;border-radius:30px;background:#fff">
        ${edge(30)}
        ${brand(44, 40, 24)}
        ${dots(BW - 110, 46, 14)}
        ${T.nav.map((n, i) => `<div class="abs" style="left:30px;top:${150 + i * 52}px;width:270px;height:40px;border-radius:9px;${i === 1 ? 'background:${PALE};' : ''}display:flex;align-items:center;gap:12px;padding-left:18px;box-sizing:border-box;font-size:18px;color:${i === 1 ? BLUE : MUTED};font-weight:${i === 1 ? 600 : 400}"><span style="width:13px;height:13px;border-radius:4px;border:2px solid currentColor"></span>${n}</div>`).join('')}
        <div class="abs" style="left:66px;top:640px;font-size:15px;color:${MUTED}">${T.help}</div>
        <div class="abs" style="left:52px;top:670px;width:180px;height:40px;border-radius:9px;border:2px solid ${LINE};display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:${INK}">${T.upgrade}</div>
        <div class="abs" style="left:330px;top:0;width:2px;height:${BH}px;background:${LINE}"></div>
        <div class="abs" style="left:${BW - 330}px;top:92px;display:flex;align-items:center;gap:12px"><span style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,#8E9BF0,${BLUE_DEEP})"></span><span><b style="font-size:19px">Maya Lee</b><br><span style="font-size:13px;color:${MUTED}">maya@mangostudio.design</span></span></div>
        <div class="abs" style="left:376px;top:172px;font-size:52px;font-weight:700;letter-spacing:-0.02em;color:${INK}">${T.board}</div>
        <div class="abs" style="left:376px;top:265px;font-size:32px;color:${MUTED};font-weight:400">${T.project} <span style="color:${INK}">${T.projectName}</span></div>
        <div class="abs" style="left:376px;top:303px;font-size:18px;color:#B4ACA5">${T.kind}</div>
        ${T.tabs.map((n, i) => `<div class="abs" style="left:${376 + [0, 168, 338][i]}px;top:367px;height:46px;padding:0 22px;border-radius:9px;border:${i === 0 ? `3px solid ${INK}` : `2px solid #CFC8C1`};display:flex;align-items:center;font-size:20px;font-weight:${i === 0 ? 600 : 400};color:${i === 0 ? INK : MUTED}">${n}</div>`).join('')}
        <div class="abs" style="left:1010px;top:366px;width:230px;height:48px;border-radius:9px;background:#36363C;box-shadow:0 6px 26px rgba(91,100,219,0.55);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:600;color:#fff">${T.generate}</div>
      </div>
    `, { scale: 1.5 })


    // --- sahne asistanı kartı (10. sahne): 900 × 1180; satırlar metin katmanı
    shoot(`assistant-${lang}`, 900 + 2 * M, 1180 + 2 * M, `
      ${halo(900, 1180, 44)}
      <div class="abs" style="left:${M}px;top:${M}px;width:900px;height:1180px;border-radius:44px;background:#fff">
        ${edge(44)}
        ${brand(56, 110, 30)}
        <div class="abs" style="left:56px;top:300px;font-size:58px;font-weight:700;letter-spacing:-0.02em;color:${INK}">${T.assistant}</div>
      </div>
    `, { scale: 1.5 })
  }
  // istem kutusu (9. sahne): 1400 × 132 (referans oranı); yazı metin katmanı, yıldız ayrı görsel
  shoot('prompt-box', 1520, 252, `
    <div class="abs" style="left:60px;top:60px;width:1400px;height:132px;border-radius:24px;background:#fff;box-shadow:0 18px 50px rgba(30,40,140,0.28)"></div>
  `, { scale: 1.5 })
  // grafikler (dile bağlı değil): huni, pasta
  shoot('chart-funnel', 420, 300, `<svg width="420" height="300" viewBox="0 0 420 300"><path d="M10 20 H410 L240 120 V280 L180 280 V120 Z" fill="${BLUE}"/><path d="M10 20 H410 L330 66 H90 Z" fill="${BLUE_DEEP}"/></svg>`, { scale: 1 })
  shoot('chart-pie', 360, 360, `<svg width="360" height="360" viewBox="-180 -180 360 360"><circle r="170" fill="${BLUE}"/><path d="M0 0 L0 -170 A170 170 0 0 1 147 85 Z" fill="#8E9BF0"/><path d="M0 0 L147 85 A170 170 0 0 1 -60 159 Z" fill="${BLUE_DEEP}"/></svg>`, { scale: 1 })
}

fs.rmSync(TMP, { recursive: true, force: true })
