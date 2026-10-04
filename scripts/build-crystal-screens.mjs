// "Crystal" şablonunun telefon ekranı: karanlık bir mağarada parlayan opal kristal + odak skoru arayüzü (EN/TR).
//   python scripts/build-crystal-assets.py   (kristal ve mağara görselleri)
//   node scripts/build-crystal-screens.mjs
// HTML → başsız Chrome → public/templates/crystal/screen-<dil>.jpg (2160×4696: telefon ekran oranı ~0.46, yakın
// çekimler için 2 kat çözünürlük). Arayüz öğeleri nane renginde parlar (yazı gölgesi), kendi tasarımımız.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/crystal'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'crystal-'))
const file = (p) => pathToFileURL(path.resolve(p)).href
const font = (f) => file(`src/assets/fonts/${f}`)

const COPY = {
  en: {
    score: 'Focus score', sleep: 'Sleep', focus: 'Focus', calm: 'Calm', tagSleep: 'Sleep', tagPickup: 'Last pickup',
    title: 'Trouble winding down?', body: 'Try a guided session to ease<br>into sleep', button: 'Start the session', allowed: '2 apps allowed',
    home: 'Home', apps: 'Apps', timer: 'Timer',
  },
  tr: {
    score: 'Odak skoru', sleep: 'Uyku', focus: 'Odak', calm: 'Huzur', tagSleep: 'Uyku', tagPickup: 'Son bakış',
    title: 'Gevşemekte zorlanıyor musun?', body: 'Rahatça uykuya dalmak için<br>rehberli bir seans dene', button: 'Seansı başlat', allowed: '2 uygulamaya izin var',
    home: 'Ana sayfa', apps: 'Uygulamalar', timer: 'Zamanlayıcı',
  },
}

// ikonlar (çizgi, nane)
const ic = {
  moon: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="currentColor"/></svg>`,
  glass: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 3h12M6 21h12M7 3c0 5 10 6 10 9s-10 4-10 9M17 3c0 5-10 6-10 9"/></svg>`,
  cloud: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M7 19a5 5 0 0 1-.6-9.96A6.5 6.5 0 0 1 19 9.5 4.75 4.75 0 0 1 18 19Z" fill="currentColor"/></svg>`,
  bed: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M3 18V7M3 13h18v5M21 13a3 3 0 0 0-3-3h-7v3M7 11.5a1.5 1.5 0 1 0 0-.01"/></svg>`,
  play: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5Z" fill="currentColor"/></svg>`,
  grid: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><circle cx="7" cy="7" r="4"/><circle cx="17" cy="7" r="4"/><circle cx="7" cy="17" r="4"/><circle cx="17" cy="17" r="4"/></svg>`,
  ring: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="8"/></svg>`,
  user: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10.5"/><circle cx="12" cy="9.5" r="3.4" fill="currentColor"/><path d="M5.5 18.5c1.6-2.6 3.8-3.6 6.5-3.6s4.9 1 6.5 3.6" fill="currentColor"/></svg>`,
  flame: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9Z" fill="#f2a43a"/></svg>`,
  moonStar: (s) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="currentColor"><path d="M17 16A7 7 0 0 1 8.2 6.3 7.5 7.5 0 1 0 17 16Z"/><path d="M17.5 3l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/></svg>`,
}

// halka: ilerleme kadar dolu, gerisi soluk (kapsül biçimli)
const pill = (icon, value, label, progress) => `
<div class="metric">
  <div class="pill">
    <svg class="track" viewBox="0 0 300 150"><rect x="8" y="8" width="284" height="134" rx="67" pathLength="100"
      fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-dasharray="${progress} 100" stroke-dashoffset="-6" /></svg>
    <span class="pv">${icon}${value}</span>
  </div>
  <div class="pl">${label}</div>
</div>`

function page(lang) {
  const c = COPY[lang]
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 500; src: url(${font('inter-500.woff')}); }
@font-face { font-family: Inter; font-weight: 600; src: url(${font('inter-600.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
@font-face { font-family: Grotesk; font-weight: 700; src: url(${font('space-grotesk-700.woff')}); }
html, body { margin: 0; width: 2160px; height: 4696px; overflow: hidden; }
body { position: relative; background: #050807; font-family: Inter, sans-serif; color: #E9FFF6; -webkit-font-smoothing: antialiased; }
.mint { color: #DFFFF1; text-shadow: 0 0 18px rgba(86,238,186,0.75), 0 0 60px rgba(86,238,186,0.35); }
.cave { position: absolute; left: 0; top: 0; width: 2160px; height: 2300px; }
.gem { position: absolute; left: 790px; top: 760px; width: 760px; filter: drop-shadow(0 0 80px rgba(86,238,186,0.35)); }
.status { position: absolute; top: 112px; left: 250px; right: 220px; display: flex; justify-content: space-between; font: 600 100px Inter; }
.brand { position: absolute; top: 300px; left: 120px; display: flex; align-items: center; gap: 26px; font: 700 150px Grotesk; letter-spacing: -0.04em; }
.brand img { width: 250px; height: 250px; margin-right: -30px; object-fit: contain; filter: drop-shadow(0 0 30px rgba(255,170,60,0.35)); }
.top-right { position: absolute; top: 330px; right: 120px; display: flex; align-items: center; gap: 46px; font: 600 86px Inter; }
.streak { display: flex; align-items: center; gap: 10px; color: #ffd9a0; }
.score { position: absolute; top: 2010px; width: 100%; text-align: center; }
.score .label { font: 600 66px Inter; }
.score .value { font: 700 230px/1 Inter; letter-spacing: -0.02em; margin-top: 10px; }
.score .value small { font-size: 90px; vertical-align: 70px; margin-left: 20px; }
.bracket { position: absolute; top: 2370px; left: 450px; width: 1260px; height: 60px; border: 6px solid rgba(160,230,200,0.35); border-bottom: none; border-radius: 40px 40px 0 0; }
.bracket::after { content: ''; position: absolute; left: 50%; top: -60px; height: 54px; border-left: 6px solid rgba(160,230,200,0.35); }
.metrics { position: absolute; top: 2450px; width: 100%; display: flex; justify-content: center; gap: 90px; }
.metric { display: flex; flex-direction: column; align-items: center; }
.pill { position: relative; width: 330px; height: 165px; color: #DFFFF1; }
.pill .track { position: absolute; inset: 0; filter: drop-shadow(0 0 14px rgba(86,238,186,0.85)); }
.pill::before { content: ''; position: absolute; inset: 8px; border-radius: 67px; border: 13px solid rgba(223,255,241,0.16); }
.pv { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 10px; font: 700 76px Inter; text-shadow: 0 0 18px rgba(86,238,186,0.75); }
.pl { margin-top: 26px; font: 600 58px Inter; color: #cfe9de; }
.card { position: absolute; top: 2930px; left: 120px; right: 120px; height: 920px; border-radius: 90px; background: linear-gradient(180deg, rgba(64,82,74,0.55), rgba(30,40,36,0.55)); border: 3px solid rgba(190,240,215,0.12); }
.tags { position: absolute; top: 80px; left: 90px; display: flex; gap: 40px; align-items: center; font: 600 62px Inter; color: #DFFFF1; }
.tags i { width: 4px; height: 56px; background: rgba(223,255,241,0.3); }
.tags span { display: flex; gap: 18px; align-items: center; }
.dots { position: absolute; top: 70px; right: 90px; font: 700 80px Inter; letter-spacing: 6px; color: #cfe9de; }
.ctitle { position: absolute; top: 220px; left: 90px; font: 700 84px Inter; color: #ffffff; }
.cbody { position: absolute; top: 340px; left: 90px; font: 500 70px/1.32 Inter; color: #bcd4ca; }
.cmoon { position: absolute; top: 330px; right: 110px; color: #E9FFF6; filter: drop-shadow(0 0 22px rgba(86,238,186,0.7)); }
.btn { position: absolute; left: 70px; right: 70px; top: 610px; height: 180px; border-radius: 90px; background: linear-gradient(90deg, #4d6a4a, #3b5a55 60%, #3c5d6a); display: flex; align-items: center; justify-content: center; gap: 30px; font: 600 70px Inter; color: #E9FFF6; box-shadow: inset 0 2px 0 rgba(255,255,255,0.12); }
.chip { position: absolute; left: 50%; transform: translateX(-50%); top: 3790px; height: 130px; padding: 0 50px 0 30px; border-radius: 65px; background: #18221f; border: 3px solid rgba(190,240,215,0.14); display: flex; align-items: center; gap: 24px; font: 600 62px Inter; color: #E9FFF6; white-space: nowrap; }
.chip b { display: inline-block; width: 70px; height: 70px; border-radius: 18px; background: linear-gradient(135deg, #63d36b, #2f9d55); }
.chip b + b { margin-left: -34px; background: linear-gradient(135deg, #4aa8ff, #2b62d9); }
.tabs { position: absolute; top: 4080px; left: 50%; transform: translateX(-50%); width: 1500px; height: 300px; border-radius: 150px; background: rgba(40,52,48,0.7); border: 3px solid rgba(190,240,215,0.12); display: flex; align-items: center; justify-content: space-around; }
.tab { display: flex; flex-direction: column; align-items: center; gap: 14px; font: 600 50px Inter; color: #cfe9de; width: 440px; height: 240px; justify-content: center; border-radius: 120px; }
.tab.on { background: rgba(223,255,241,0.1); color: #ffffff; }
.home-ind { position: absolute; bottom: 60px; left: 50%; width: 560px; height: 22px; margin-left: -280px; border-radius: 11px; background: rgba(255,255,255,0.55); }
</style></head><body>
<img class="cave" src="${file('scripts/assets/crystal/cave.png')}">
<img class="gem" src="${file('scripts/assets/crystal/gem.png')}">
<div class="status mint"><span>9:41</span><svg width="400" height="100" viewBox="0 0 200 50" fill="#E9FFF6">
  <rect x="0" y="30" width="11" height="14" rx="3"/><rect x="17" y="22" width="11" height="22" rx="3"/><rect x="34" y="14" width="11" height="30" rx="3"/><rect x="51" y="6" width="11" height="38" rx="3"/>
  <path d="M102 42 l-8 -9 a12 12 0 0 1 16 0z M84 23 a26 26 0 0 1 36 0 l-5 6 a18 18 0 0 0 -26 0z M76 14 a38 38 0 0 1 52 0 l-5 6 a30 30 0 0 0 -42 0z"/>
  <rect x="140" y="10" width="50" height="30" rx="9" fill="none" stroke="#E9FFF6" stroke-width="3" opacity="0.6"/><rect x="145" y="15" width="36" height="20" rx="5"/><rect x="193" y="20" width="4" height="10" rx="2" opacity="0.6"/>
</svg></div>
<div class="brand mint"><img src="${file('public/brand/mango-logo-2048.png')}">crystal</div>
<div class="top-right mint"><span class="streak">${ic.flame(90)}5</span>${ic.user(120)}</div>
<div class="score mint"><div class="label">${c.score}</div><div class="value">81<small>▲</small></div></div>
<div class="bracket"></div>
<div class="metrics">
  ${pill(ic.moon(64), '53', c.sleep, 58)}
  ${pill(ic.glass(64), '90', c.focus, 86)}
  ${pill(ic.cloud(64), '100', c.calm, 100)}
</div>
<div class="card">
  <div class="tags"><span>${ic.moon(60)}${c.tagSleep}</span><i></i><span>${ic.bed(70)}${c.tagPickup}</span></div>
  <div class="dots">···</div>
  <div class="ctitle">${c.title}</div>
  <div class="cbody">${c.body}</div>
  <div class="cmoon">${ic.moonStar(170)}</div>
  <div class="btn">${ic.play(60)}${c.button}</div>
</div>
<div class="chip"><b></b><b></b>${c.allowed} ›</div>
<div class="tabs">
  <div class="tab on">${ic.ring(110)}${c.home}</div>
  <div class="tab">${ic.grid(100)}${c.apps}</div>
  <div class="tab">${ic.play(100)}${c.timer}</div>
</div>
<div class="home-ind"></div>
</body></html>`
}

fs.mkdirSync(OUT, { recursive: true })
for (const lang of Object.keys(COPY)) {
  const html = path.join(TMP, `${lang}.html`)
  fs.writeFileSync(html, page(lang))
  // fotoğraf gibi dokulu ekran: JPG çok daha küçük (Chrome uzantıya göre JPG yazar)
  const out = path.resolve(OUT, `screen-${lang}.jpg`)
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1', '--window-size=2160,4696', '--virtual-time-budget=2000', `--screenshot=${out}`, pathToFileURL(html).href], { stdio: 'ignore' })
  console.log(`screen-${lang}`, fs.statSync(out).size)
}
