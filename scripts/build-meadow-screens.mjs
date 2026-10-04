// "Meadow phone" şablonunun telefon ekranı: Mango Studio karşılama ekranı (EN/TR).
//   node scripts/build-meadow-screens.mjs
// HTML → başsız Chrome → public/templates/meadow/screen-<dil>.png (1080×2348, telefon ekran oranı ~0.46).
// Marka kuralı gereği logo koyu zeminde; renkler src/styles/brand.md paletinden.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/meadow'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'meadow-'))
const font = (f) => pathToFileURL(path.resolve('src/assets/fonts', f)).href
const logo = pathToFileURL(path.resolve('public/brand/mango-logo-2048.png')).href

const COPY = {
  en: { tagline: 'Turn your words<br>into motion', start: 'Get started', account: 'I already have an account', terms: 'By continuing, you agree to our<br><u>Terms of Service</u> and <u>Privacy Policy</u>' },
  tr: { tagline: 'Kelimelerini<br>harekete dönüştür', start: 'Hemen başla', account: 'Zaten hesabım var', terms: 'Devam ederek <u>Hizmet Şartları</u> ve<br><u>Gizlilik Politikası</u>’nı kabul edersin' },
}

const sparkle = (x, y, s, c) => `<svg style="position:absolute;left:${x - s / 2}px;top:${y - s / 2}px" width="${s}" height="${s}" viewBox="0 0 10 10"><path d="M5 0 C5.6 3.6 6.4 4.4 10 5 C6.4 5.6 5.6 6.4 5 10 C4.4 6.4 3.6 5.6 0 5 C3.6 4.4 4.4 3.6 5 0Z" fill="${c}"/></svg>`
const dot = (x, y, r, c) => `<div style="position:absolute;left:${x - r}px;top:${y - r}px;width:${2 * r}px;height:${2 * r}px;border-radius:50%;background:${c}"></div>`

function page(lang) {
  const c = COPY[lang]
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
@font-face { font-family: Grotesk; font-weight: 700; src: url(${font('space-grotesk-700.woff')}); }
html, body { margin: 0; width: 1080px; height: 2348px; overflow: hidden; }
body { position: relative; background: radial-gradient(120% 60% at 50% 30%, #1d1409 0%, #0A0A0B 62%); font-family: Inter, sans-serif; color: #F4EFE7; -webkit-font-smoothing: antialiased; }
.status { position: absolute; top: 58px; left: 120px; right: 110px; display: flex; justify-content: space-between; font: 700 50px Inter; }
.glow { position: absolute; left: 190px; top: 380px; width: 700px; height: 700px; border-radius: 50%; background: radial-gradient(closest-side, rgba(217,113,28,0.45), rgba(217,113,28,0) 70%); }
.logo { position: absolute; left: 50%; top: 240px; width: 1000px; transform: translateX(-50%) rotate(-8deg); filter: drop-shadow(0 30px 40px rgba(0,0,0,0.5)); }
.word { position: absolute; top: 1270px; width: 100%; text-align: center; font: 700 100px Grotesk; letter-spacing: -0.035em; }
.word span { color: #D9711C; }
.tag { position: absolute; top: 1440px; width: 100%; text-align: center; font: 400 64px/1.3 Inter; color: #F4EFE7; }
.btn { position: absolute; left: 90px; right: 90px; height: 170px; border-radius: 40px; display: flex; align-items: center; justify-content: center; font: 700 58px Inter; }
.primary { top: 1740px; background: #D9711C; color: #140b03; box-shadow: 0 20px 50px rgba(217,113,28,0.35); }
.ghost { top: 1940px; background: #18181B; color: #F4EFE7; border: 2px solid #28262A; }
.terms { position: absolute; top: 2150px; width: 100%; text-align: center; font: 400 36px/1.45 Inter; color: #9C968C; }
.terms u { color: #F4EFE7; text-decoration-thickness: 2px; }
</style></head><body>
<div class="status"><span>9:41</span><svg width="200" height="50" viewBox="0 0 200 50" fill="#F4EFE7">
  <rect x="0" y="30" width="11" height="14" rx="3"/><rect x="17" y="22" width="11" height="22" rx="3"/><rect x="34" y="14" width="11" height="30" rx="3"/><rect x="51" y="6" width="11" height="38" rx="3"/>
  <path d="M102 42 l-8 -9 a12 12 0 0 1 16 0z M84 23 a26 26 0 0 1 36 0 l-5 6 a18 18 0 0 0 -26 0z M76 14 a38 38 0 0 1 52 0 l-5 6 a30 30 0 0 0 -42 0z"/>
  <rect x="140" y="10" width="50" height="30" rx="9" fill="none" stroke="#F4EFE7" stroke-width="3" opacity="0.6"/><rect x="145" y="15" width="36" height="20" rx="5"/><rect x="193" y="20" width="4" height="10" rx="2" opacity="0.6"/>
</svg></div>
<div class="glow"></div>
${dot(250, 560, 34, '#a3301b')}${dot(860, 1000, 26, '#6d8a2c')}${dot(820, 470, 18, '#c99324')}
${sparkle(240, 900, 90, '#c99324')}${sparkle(880, 700, 110, '#c99324')}${sparkle(560, 1170, 70, '#d27a1e')}${sparkle(360, 420, 50, '#F4EFE7')}
<img class="logo" src="${logo}">
<div class="word">mangostudio<span>.design</span></div>
<div class="tag">${c.tagline}</div>
<div class="btn primary">${c.start}</div>
<div class="btn ghost">${c.account}</div>
<div class="terms">${c.terms}</div>
</body></html>`
}

fs.mkdirSync(OUT, { recursive: true })
for (const lang of Object.keys(COPY)) {
  const html = path.join(TMP, `${lang}.html`)
  fs.writeFileSync(html, page(lang))
  const out = path.resolve(OUT, `screen-${lang}.png`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', '--window-size=1080,2348', '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore' })
  console.log(`screen-${lang}`, fs.statSync(out).size)
}
