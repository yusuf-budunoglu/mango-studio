// "Icon close-up" şablonunun görselleri: HTML → başsız Chrome → PNG (public/templates/icon-closeup).
//   node scripts/build-icon-closeup-assets.mjs
// Hepsi bizim tasarımımız (başka markanın logosu yok): fildişi ana ekran + cam dock (ikonsuz), dört uygulama ikonu
// ayrı saydam PNG. İkonlar sahnede ayrı katman: kullanıcı kendi ikonunu koyar. Ölçüler ekranın CSS pikselinde
// (1080×2348); şablondaki `DOCK` / `ICON` sabitleri (src/project/iconCloseup.ts) bu dosyayla aynı olmalı.
// Logo kuralı gereği Mango logosu yalnızca koyu ikonun içinde.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/icon-closeup'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-closeup-'))
const url = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => url(`src/assets/fonts/${f}`)

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
${css}
</style></head><body>${body}</body></html>`

function shoot(name, w, h, body, { scale = 2, css = '', ext = 'png' } = {}) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  // Chrome uzantıya göre yazar: ekran saydam değil ve büyük, JPG çok daha küçük
  const out = path.resolve(OUT, `${name}.${ext}`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000', '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore' })
  console.log(name, `${w * scale}×${h * scale}`, fs.statSync(out).size)
}

// Marka renkleri (src/styles/brand.md)
const C = { ink: '#17130F', orange: '#FF7A00', gold: '#FFB21E', tangerine: '#FF5A1F', red: '#E2361B' }

// --- Ekran: fildişi duvar kağıdı, üstte sıcak sarı ışık (uzakta bulanıklaşınca renk geçişi verir), altta cam dock.
const SCREEN = { w: 1080, h: 2348 }
const DOCK = { x: 36, y: 2076, w: 1008, h: 236, r: 84 }
const dock = `<div style="position:absolute;left:${DOCK.x}px;top:${DOCK.y}px;width:${DOCK.w}px;height:${DOCK.h}px;border-radius:${DOCK.r}px;
  background:linear-gradient(180deg, rgba(255,255,255,.62) 0%, rgba(255,255,255,.34) 55%, rgba(255,248,235,.3) 100%);
  box-shadow: inset 0 5px 0 #fff, inset 4px 0 0 rgba(255,255,255,.8), inset -3px 0 0 rgba(255,255,255,.5),
    inset 0 -3px 0 rgba(255,255,255,.6), inset 0 -24px 36px rgba(150,104,40,.18), inset 0 20px 28px rgba(255,255,255,.5),
    0 0 0 2px rgba(255,255,255,.5), 0 -2px 14px rgba(255,255,255,.7), 0 24px 54px rgba(120,78,16,.24), 0 4px 10px rgba(120,78,16,.14);"></div>`
const status = `<div style="position:absolute;top:58px;left:120px;right:110px;display:flex;justify-content:space-between;font:600 50px Inter;color:${C.ink}"><span>9:41</span>
<svg width="200" height="50" viewBox="0 0 200 50" fill="${C.ink}">
  <rect x="0" y="30" width="11" height="14" rx="3"/><rect x="17" y="22" width="11" height="22" rx="3"/><rect x="34" y="14" width="11" height="30" rx="3"/><rect x="51" y="6" width="11" height="38" rx="3"/>
  <path d="M102 42 l-8 -9 a12 12 0 0 1 16 0z M84 23 a26 26 0 0 1 36 0 l-5 6 a18 18 0 0 0 -26 0z M76 14 a38 38 0 0 1 52 0 l-5 6 a30 30 0 0 0 -42 0z"/>
  <rect x="140" y="10" width="50" height="30" rx="9" fill="none" stroke="${C.ink}" stroke-width="3" opacity="0.6"/><rect x="145" y="15" width="36" height="20" rx="5"/><rect x="193" y="20" width="4" height="10" rx="2" opacity="0.6"/>
</svg></div>`
shoot(
  'screen',
  SCREEN.w,
  SCREEN.h,
  `${status}${dock}`,
  {
    ext: 'jpg',
    css: `body { background:
      radial-gradient(70% 34% at 78% 16%, rgba(255,178,30,.5), rgba(255,178,30,0) 70%),
      radial-gradient(80% 36% at 12% 44%, rgba(255,122,0,.26), rgba(255,122,0,0) 70%),
      radial-gradient(90% 30% at 70% 70%, rgba(255,200,120,.3), rgba(255,200,120,0) 72%),
      linear-gradient(180deg, #FFEFD2 0%, #FBEBD3 55%, #F7ECDD 100%); }`,
  },
)

// --- İkonlar: 256 px tuvalde 192 px yumuşak köşeli kare (süper elips), altında gölge payı. Ekranda 176 px çizilir.
const CANVAS = 256
const SIZE = 192
/** iOS benzeri yumuşak köşe: süper elips (n = 5) */
function squircle(size, n = 5) {
  const a = size / 2
  const pts = []
  for (let i = 0; i < 240; i++) {
    const t = (i / 240) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push(`${(a + a * Math.sign(c) * Math.abs(c) ** (2 / n)).toFixed(2)},${(a + a * Math.sign(s) * Math.abs(s) ** (2 / n)).toFixed(2)}`)
  }
  return `M${pts.join('L')}Z`
}
const SQ = squircle(SIZE)
const icon = (name, defs, fill, glyph, shadow = 'rgba(92,52,0,.32)', gloss = 0.26) =>
  shoot(
    name,
    CANVAS,
    CANVAS,
    `<svg width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}" style="position:absolute;left:0;top:0;overflow:visible">
      <defs>${defs}
        <filter id="sh" x="-40%" y="-40%" width="180%" height="190%"><feGaussianBlur stdDeviation="9"/></filter>
        <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${gloss}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>
        <clipPath id="clip"><path d="${SQ}"/></clipPath>
      </defs>
      <g transform="translate(${(CANVAS - SIZE) / 2} ${(CANVAS - SIZE) / 2})">
        <path d="${SQ}" transform="translate(0 10) scale(.96) translate(4 4)" fill="${shadow}" filter="url(#sh)"/>
        <path d="${SQ}" fill="${fill}"/>
        <g clip-path="url(#clip)">${glyph}<rect width="${SIZE}" height="${SIZE}" fill="url(#gloss)"/></g>
        <path d="${SQ}" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="1.5"/>
      </g>
    </svg>`,
    { scale: 4 },
  )

// 1) Mango Studio: koyu zemin + logo (asıl ikon; kullanıcı kendi ikonuyla değiştirir)
icon(
  'icon-mango',
  `<radialGradient id="bg" cx=".5" cy=".3" r=".9"><stop offset="0" stop-color="#241a10"/><stop offset=".6" stop-color="#0d0c0b"/><stop offset="1" stop-color="#050505"/></radialGradient>`,
  'url(#bg)',
  // logonun mürekkep kutusu 2048'lik dosyada (694, 419)–(1354, 1395): ikonun ortasına, yüksekliğin %65'i
  `<image href="${url('public/brand/mango-logo-2048.png')}" x="-34" y="-19.2" width="260" height="260"/>`,
  'rgba(40,22,0,.45)',
  0.08,
)
// 2) Oynat: mango degradesi + beyaz üçgen
icon(
  'icon-play',
  `<linearGradient id="bg" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${C.gold}"/><stop offset=".55" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.tangerine}"/></linearGradient>`,
  'url(#bg)',
  `<path d="M76 62 q0 -12 11 -6 l52 31 q10 6 0 12 l-52 31 q-11 6 -11 -6z" fill="#fff"/>`,
)
// 3) Yıldız: beyaz zemin + marka degradeli yıldız
icon(
  'icon-spark',
  `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f3ece2"/></linearGradient>
   <linearGradient id="sp" x1=".1" y1=".9" x2=".9" y2=".1"><stop offset="0" stop-color="${C.red}"/><stop offset=".4" stop-color="${C.tangerine}"/><stop offset=".7" stop-color="${C.orange}"/><stop offset="1" stop-color="${C.gold}"/></linearGradient>`,
  'url(#bg)',
  `<path transform="translate(40 40) scale(4.67)" d="M12 1.2c1 5.8 5 9.8 10.8 10.8-5.8 1-9.8 5-10.8 10.8C11 17 7 13 1.2 12 7 11 11 7 12 1.2Z" fill="url(#sp)"/>
   <path transform="translate(128 36) scale(1.5)" d="M12 1.2c1 5.8 5 9.8 10.8 10.8-5.8 1-9.8 5-10.8 10.8C11 17 7 13 1.2 12 7 11 11 7 12 1.2Z" fill="${C.gold}"/>`,
  'rgba(92,52,0,.26)',
)
// 4) Zaman çizelgesi: grafit zemin + üç klip şeridi
icon(
  'icon-timeline',
  `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b2520"/><stop offset="1" stop-color="#14110e"/></linearGradient>`,
  'url(#bg)',
  `<rect x="40" y="52" width="84" height="24" rx="12" fill="${C.gold}"/><rect x="72" y="84" width="82" height="24" rx="12" fill="${C.orange}"/><rect x="40" y="116" width="58" height="24" rx="12" fill="#F5F2EC"/>
   <rect x="108" y="38" width="5" height="116" rx="2.5" fill="#fff" opacity=".9"/>`,
  'rgba(40,22,0,.4)',
  0.08,
)

// --- Görsel şablonun (icon-closeup-image) ikonları: Google, YouTube ve X. Gerçek marka logoları, kullanıcı kararıyla;
// logolar markaların kendi biçim ve renkleriyle, değiştirilmeden çizilir. Video şablonunda kullanılmaz.
const WHITE = `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#f1efec"/></linearGradient>`
icon(
  'icon-google',
  WHITE,
  'url(#bg)',
  `<g transform="translate(42 42) scale(2.25)">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </g>`,
  'rgba(92,52,0,.26)',
  0,
)
icon(
  'icon-youtube',
  WHITE,
  'url(#bg)',
  `<g transform="translate(30 49.8) scale(4.62)">
    <path fill="#FF0000" d="M27.9727 3.12324C27.6435 1.89323 26.6768 0.926623 25.4468 0.597366C23.2197 0 14.285 0 14.285 0C14.285 0 5.35042 0 3.12323 0.597366C1.89323 0.926623 0.926623 1.89323 0.597366 3.12324C0 5.35042 0 10 0 10C0 10 0 14.6496 0.597366 16.8768C0.926623 18.1068 1.89323 19.0734 3.12323 19.4026C5.35042 20 14.285 20 14.285 20C14.285 20 23.2197 20 25.4468 19.4026C26.6768 19.0734 27.6435 18.1068 27.9727 16.8768C28.5701 14.6496 28.5701 10 28.5701 10C28.5701 10 28.5677 5.35042 27.9727 3.12324Z"/>
    <path fill="#fff" d="M11.4253 14.2854L18.8477 10.0004L11.4253 5.71533V14.2854Z"/>
  </g>`,
  'rgba(92,52,0,.26)',
  0,
)
icon(
  'icon-x',
  '',
  '#000000',
  `<path transform="translate(46 46) scale(4.17)" fill="#fff" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>`,
  'rgba(20,12,0,.45)',
  0,
)

// --- Etiket kutusu: beyaz hap (sahnede katman rengiyle boyanır), çevresinde saydam pay. Ölçü kadraj pikselinde
// (1080×1080). Pay bilerek geniş: saydam pikseller de derinliğe yazar, böylece alan derinliği kutunun çevresini
// "net" sayar ve beyaz kutunun bulanık fona taşan halesi oluşmaz. Genişlik yazıya göre (şablondaki `pillW`).
const LABEL = { h: 58, margin: 48, w: { en: 323, tr: 339 } }
for (const [lang, w] of Object.entries(LABEL.w))
  shoot(
    `label-box-${lang}`,
    w + 2 * LABEL.margin,
    LABEL.h + 2 * LABEL.margin,
    `<div style="position:absolute;left:${LABEL.margin}px;top:${LABEL.margin}px;width:${w}px;height:${LABEL.h}px;border-radius:20px;background:#fff"></div>`,
    { scale: 3 },
  )
