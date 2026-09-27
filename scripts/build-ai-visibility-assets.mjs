// "AI search ad" şablonunun görselleri: HTML → başsız Chrome → saydam PNG (public/templates/ai-visibility).
//   node scripts/build-ai-visibility-assets.mjs
// Ölçüler referans videonun piksellerinde (720×1280 dikey kare); PNG'ler 3 kat çözünürlükte çizilir.
// Marka (Sunrank.ai), dashboard ve ikonlar bizim tasarımımız; yalnızca ChatGPT/OpenAI logosu gerçek
// (scripts/assets/openai-blossom.svg).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/ai-visibility'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'aiv-'))
const font = (f) => pathToFileURL(path.resolve('src/assets/fonts', f)).href
const blossom = fs.readFileSync('scripts/assets/openai-blossom.svg', 'utf8').replace(/<svg[^>]*>/, '').replace('</svg>', '')

const ORANGE = '#E65324'
const INK = '#111111'

const page = (w, h, body, css = '') => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
@font-face { font-family: Poppins; font-weight: 400; src: url(${font('poppins-400.woff')}); }
@font-face { font-family: Poppins; font-weight: 700; src: url(${font('poppins-700.woff')}); }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
body { position: relative; font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; }
${css}
</style></head><body>${body}</body></html>`

/** Sayfayı `scale` katında saydam PNG olarak kaydeder. */
function shoot(name, w, h, body, css, scale = 3) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, page(w, h, body, css))
  const out = path.resolve(OUT, `${name}.png`)
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, '--default-background-color=00000000',
    '--virtual-time-budget=1500', `--screenshot=${out}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' })
  console.log(name, `${Math.round(w * scale)}×${Math.round(h * scale)}`, fs.statSync(out).size)
}

fs.mkdirSync(OUT, { recursive: true })

// ── ChatGPT arayüzü ──────────────────────────────────────────────
// Siyah daire içinde OpenAI logosu (referansta çap 90 px)
shoot('chatgpt-logo', 90, 90, `<svg viewBox="0 0 90 90" width="90" height="90"><circle cx="45" cy="45" r="45" fill="#000"/>
  <g transform="translate(19.5 19.5) scale(${51 / 320})" fill="#fff">${blossom}</g></svg>`)

// Giriş satırı: solda "+" dairesi, beyaz hap (ince gri kenar). Metin ve gönder düğmesi ayrı katman.
shoot('input-bar', 584, 66, `
  <div class="plus"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 4v16M4 12h16" stroke="#8d8d8d" stroke-width="2.2" stroke-linecap="round"/></svg></div>
  <div class="pill"></div>`, `
  .plus { position: absolute; left: 2px; top: 8px; width: 50px; height: 50px; border-radius: 50%; background: #f4f4f4; display: grid; place-items: center; }
  .pill { position: absolute; left: 83px; top: 2px; width: 496px; height: 60px; box-sizing: border-box; border-radius: 30px; background: #fff; border: 1.5px solid #e7e7e7; box-shadow: 0 1px 6px rgba(0,0,0,0.04); }`)

const send = (name, bg) =>
  shoot(name, 54, 54, `<svg viewBox="0 0 54 54" width="54" height="54"><circle cx="27" cy="27" r="27" fill="${bg}"/>
    <path d="M27 38V17M18.5 25.5L27 17l8.5 8.5" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`)
send('send-dark', '#000')
send('send-idle', '#737373')

// Gönder'e basınca yayılan halka (çap 200 px; ölçeklenerek büyür)
shoot('ring', 200, 200, `<svg viewBox="0 0 200 200" width="200" height="200"><circle cx="100" cy="100" r="96" fill="none" stroke="#d6d6d6" stroke-width="5"/></svg>`)

// "You" avatarı: nötr, çizimle yapılmış kişi silueti (gerçek kişi değil)
shoot('avatar', 48, 48, `<svg viewBox="0 0 48 48" width="48" height="48">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3f4b"/><stop offset="1" stop-color="#1c1f26"/></linearGradient>
  <clipPath id="c"><circle cx="24" cy="24" r="24"/></clipPath></defs>
  <circle cx="24" cy="24" r="24" fill="url(#g)"/>
  <g clip-path="url(#c)"><circle cx="24" cy="19" r="8.5" fill="#d9b59a"/><path d="M15.5 17.5c0-6.5 4-9.5 8.5-9.5s8.5 3 8.5 9c-2-3-5-4-8.5-4s-6.5 1.5-8.5 4.5z" fill="#2b2320"/>
  <path d="M6 50c1-10 8-15 18-15s17 5 18 15z" fill="#e8e3dc"/></g></svg>`)

// Listeye eklenen alan adı rozeti: beyaz hap, turuncu kenar, yumuşak turuncu ışıma
shoot('domain-pill', 360, 120, `<div class="pill">mycompany.com</div>`, `
  .pill { position: absolute; left: 25px; top: 25px; width: 310px; height: 70px; box-sizing: border-box; border-radius: 35px; background: #fff;
    border: 2px solid #eea27f; box-shadow: 0 0 14px rgba(230,83,36,0.28), 0 4px 10px rgba(230,83,36,0.12);
    font: 700 27px/66px Inter; letter-spacing: -0.02em; color: ${INK}; padding-left: 40px; }`)

// ── Marka: Sunrank.ai (hayali) ───────────────────────────────────
// İşaret: büyüme rampası + rampanın yüksek ucunun arkasından doğan turuncu güneş.
// Parçalar aynı tuvalde (120×96) çizilir: üst üste aynı yere konunca birebir hizalı olur.
const RAMP = 'M6 90 V56 Q6 52 10 51 L108 29 Q114 28 114 34 V90 Q114 94 110 94 H10 Q6 94 6 90Z'
const markPiece = (name, fill, sun) =>
  shoot(name, 120, 96, `<svg viewBox="0 0 120 96" width="120" height="96">
    <defs><clipPath id="above"><path d="M0 0 H120 V18 L0 43Z"/></clipPath></defs>
    ${sun ? `<g clip-path="url(#above)"><circle cx="78" cy="30" r="24" fill="${ORANGE}"/></g>` : `<path d="${RAMP}" fill="${fill}"/>`}
  </svg>`, '', 6)
markPiece('mark-ramp-dark', '#1a1718')
markPiece('mark-ramp-light', '#ffffff')
markPiece('mark-sun', '', true)

// Uygulama ikonu: beyaz yuvarlak kare + gölge + koyu daire (işaret ayrı katmanlarda çizilir)
shoot('app-icon', 420, 420, `<div class="sq"><div class="c"></div></div>`, `
  .sq { position: absolute; left: 40px; top: 40px; width: 340px; height: 340px; border-radius: 100px; background: #fff; box-shadow: 0 18px 40px rgba(30,35,60,0.10), 0 2px 6px rgba(30,35,60,0.05); display: grid; place-items: center; }
  .c { width: 218px; height: 218px; border-radius: 50%; background: #201d1f; }`)

// ── Özellik kartları (yelpaze) ───────────────────────────────────
const ICONS = {
  content: `<rect x="14" y="16" width="36" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="3.2"/><path d="M20 38l7-8 6 6 4-4 7 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><circle cx="40" cy="25" r="3.2" fill="currentColor"/>`,
  backlinks: `<path d="M28 36l8-8M24 30l-5 5a7 7 0 0 0 10 10l5-5M40 34l5-5a7 7 0 0 0-10-10l-5 5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/>`,
  tracking: `<path d="M14 44a18 18 0 0 1 36 0" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/><path d="M32 44l9-12" stroke="currentColor" stroke-width="3.6" stroke-linecap="round"/><circle cx="32" cy="44" r="3.6" fill="currentColor"/><path d="M20 50h24" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>`,
}
const LABELS = {
  en: { content: 'Content', backlinks: 'Backlinks', tracking: 'Tracking' },
  tr: { content: 'İçerik', backlinks: 'Backlink', tracking: 'Takip' },
}
for (const [lang, labels] of Object.entries(LABELS)) {
  for (const [id, label] of Object.entries(labels)) {
    shoot(`card-${id}-${lang}`, 160, 330, `<div class="card"><div class="disc"><div class="ico"><svg viewBox="0 0 64 64" width="52" height="52">${ICONS[id]}</svg></div></div><div class="label">${label}</div></div>`, `
      .card { position: absolute; left: 14px; top: 10px; width: 132px; height: 310px; border-radius: 66px; background: linear-gradient(180deg, #f7937a, #f27f64); box-shadow: 0 10px 24px rgba(242,127,100,0.25); }
      .disc { position: absolute; left: 8px; top: 8px; width: 116px; height: 116px; border-radius: 50%; background: #fff; display: grid; place-items: center; box-shadow: inset 0 0 0 1px rgba(0,0,0,0.04); }
      .ico { width: 74px; height: 74px; border-radius: 20px; background: linear-gradient(145deg, #fde3da, #f7b8a4); color: #e8694a; display: grid; place-items: center; box-shadow: inset 0 1px 0 rgba(255,255,255,0.8), 0 3px 8px rgba(232,105,74,0.18); }
      .label { position: absolute; left: 0; right: 0; top: 140px; text-align: center; font: 500 22px Inter; color: #fff; letter-spacing: -0.01em; }`)
  }
}

// ── Sayaç çerçevesi: turuncu çizgili hap; sağ ucu solarak açık kalır ──
shoot('counter-pill', 300, 110, `<svg viewBox="0 0 300 110" width="300" height="110">
  <defs><linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="${ORANGE}"/><stop offset="0.72" stop-color="${ORANGE}" stop-opacity="0.9"/><stop offset="1" stop-color="${ORANGE}" stop-opacity="0"/></linearGradient></defs>
  <path d="M290 13 H57 A42 42 0 0 0 57 97 H290" fill="none" stroke="url(#f)" stroke-width="3"/></svg>`)

// ── Kapanış ──────────────────────────────────────────────────────
// Pembe fon: köşelerde sıcak pembe, ortası neredeyse beyaz (referanstan ölçüldü)
shoot('end-bg', 720, 1280, `<div class="bg"></div>`, `
  .bg { position: absolute; inset: 0; background:
    radial-gradient(70% 45% at 0% 0%, #f5d2c8 0%, rgba(245,210,200,0) 100%),
    radial-gradient(45% 25% at 100% 100%, #f9e6e3 0%, rgba(249,230,227,0) 100%),
    radial-gradient(45% 25% at 0% 100%, #f9e4e0 0%, rgba(249,228,224,0) 100%),
    radial-gradient(50% 30% at 100% 0%, #f8e2dc 0%, rgba(248,226,220,0) 100%),
    #fcf5f5; }`, 1.5)

// Turuncu düğme (yazı ayrı metin katmanı)
shoot('button', 300, 80, `<div class="b"></div>`, `.b { position: absolute; left: 7px; top: 6px; width: 286px; height: 64px; border-radius: 32px; background: #e94e16; box-shadow: 0 6px 16px rgba(233,78,22,0.25); }`)

// Fare imleci (ok) ve tıklama halkası
shoot('cursor', 40, 52, `<svg viewBox="0 0 40 52" width="40" height="52"><path d="M4 3 L4 40 L13 31 L19.5 46 L26 43 L19.5 28.5 L32 28.5 Z" fill="#111" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/></svg>`)
shoot('click-ring', 80, 80, `<svg viewBox="0 0 80 80" width="80" height="80"><circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="3"/></svg>`)

// ── Dashboard (hayali ürün ekranı) ───────────────────────────────
const bars = [38, 44, 41, 52, 57, 63, 60, 71, 78, 84, 90, 97]
const line = (vals, h, w) => vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / 100) * h}`).join(' ')
const growth = [12, 16, 15, 22, 27, 31, 36, 42, 49, 55, 63, 74]
const cost = [8, 9, 11, 12, 12, 14, 15, 17, 18, 20, 22, 25]
shoot('dashboard', 1200, 1130, `
<div class="app">
  <aside>
    <div class="brand"><svg viewBox="0 0 120 96" width="30" height="24"><path d="${RAMP}" fill="#1a1718"/><g clip-path="url(#a2)"><circle cx="78" cy="30" r="24" fill="${ORANGE}"/></g><defs><clipPath id="a2"><path d="M0 0 H120 V18 L0 43Z"/></clipPath></defs></svg><b>Sunrank<span>.ai</span></b></div>
    <nav>${['Overview', 'AI visibility', 'Keywords', 'Content', 'Backlinks', 'Reports', 'Settings'].map((n, i) => `<div class="${i === 0 ? 'on' : ''}"><i></i>${n}</div>`).join('')}</nav>
    <div class="plan"><b>Pro plan</b><span>12 of 20 articles</span><div class="bar"><div></div></div></div>
  </aside>
  <main>
    <header><div><h1>Welcome back, Alex</h1><p>Here's how your brand shows up in AI answers this week.</p></div><button>+ New article</button></header>
    <section class="kpis">
      ${[['AI mentions', '1,284', '+38%'], ['Avg. position', '2.4', '+1.1'], ['Organic clicks', '48.2k', '+22%'], ['Articles live', '64', '+9']].map(([k, v, d]) => `<div class="kpi"><span>${k}</span><b>${v}</b><em>${d}</em></div>`).join('')}
    </section>
    <section class="row">
      <div class="card chart"><div class="ch"><b>Search visibility</b><span class="tag">Last 12 months</span></div>
        <svg viewBox="0 0 560 220" width="560" height="220"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fbf8f" stop-opacity="0.28"/><stop offset="1" stop-color="#2fbf8f" stop-opacity="0"/></linearGradient></defs>
          ${[0, 1, 2, 3].map((i) => `<line x1="0" x2="560" y1="${20 + i * 60}" y2="${20 + i * 60}" stroke="#eef0f4"/>`).join('')}
          <polygon points="0,220 ${line(growth, 200, 560)} 560,220" fill="url(#gg)"/>
          <polyline points="${line(growth, 200, 560)}" fill="none" stroke="#2fbf8f" stroke-width="3"/>
          <polyline points="${line(cost, 200, 560)}" fill="none" stroke="#f08a6c" stroke-width="3"/>
          <circle cx="509" cy="${200 - 0.63 * 200}" r="6" fill="#fff" stroke="#2fbf8f" stroke-width="3"/>
        </svg>
        <div class="tip">ChatGPT now cites you<br><b>#2 for "email software"</b></div>
      </div>
      <div class="card list"><b>Where AI mentions you</b>
        ${[['ChatGPT', 82], ['AskNova', 64], ['Querio', 51], ['Seekly', 37], ['Lumen AI', 29]].map(([n, v]) => `<div class="li"><span>${n}</span><div class="track"><div style="width:${v}%"></div></div><em>${v}</em></div>`).join('')}
      </div>
    </section>
    <section class="row">
      <div class="card small"><b>Weekly traffic</b><svg viewBox="0 0 260 90" width="260" height="90">${bars.map((v, i) => `<rect x="${i * 21 + 4}" y="${90 - v * 0.85}" width="13" height="${v * 0.85}" rx="4" fill="${i === bars.length - 1 ? ORANGE : '#f6c3b2'}"/>`).join('')}</svg></div>
      <div class="card small"><b>Top articles</b>${['Best email tools in 2026', 'How to pick a CRM', 'Newsletter growth guide'].map((a, i) => `<div class="art"><i>${i + 1}</i>${a}<em>+${[41, 27, 18][i]}%</em></div>`).join('')}</div>
      <div class="card small"><b>Health score</b><div class="score"><svg viewBox="0 0 100 100" width="92" height="92"><circle cx="50" cy="50" r="40" fill="none" stroke="#f1f2f5" stroke-width="10"/><circle cx="50" cy="50" r="40" fill="none" stroke="#2fbf8f" stroke-width="10" stroke-dasharray="${0.81 * 251} 251" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><b>81</b></div></div>
    </section>
    <section class="card answers"><div class="ch"><b>Latest AI answers that mention you</b><span class="tag">Live</span></div>
      ${[['ChatGPT', 'Best email marketing software (2026)', '#2'], ['AskNova', 'Top newsletter tools for startups', '#1'], ['Querio', 'Affordable email automation', '#3'], ['ChatGPT', 'Alternatives to big email platforms', '#2'], ['Seekly', 'Email tools with the best deliverability', '#4']].map(([e, q, r]) => `<div class="ans"><span class="eng">${e}</span><span class="q">${q}</span><em>${r}</em></div>`).join('')}
    </section>
  </main>
</div>`, `
  .app { position: absolute; inset: 0; display: flex; background: #f7f8fb; border-radius: 18px; overflow: hidden; border: 1px solid #e6e8ee; font-size: 14px; color: #1b1d22; }
  aside { width: 210px; background: #fff; border-right: 1px solid #eceef3; padding: 22px 16px; display: flex; flex-direction: column; gap: 22px; }
  .brand { display: flex; align-items: center; gap: 8px; font: 700 20px Poppins; letter-spacing: -0.02em; } .brand span { font-weight: 700; }
  nav { display: grid; gap: 4px; } nav div { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 9px; color: #5b606b; }
  nav i { width: 14px; height: 14px; border-radius: 4px; border: 2px solid #c4c8d0; } nav .on { background: #fff1ec; color: ${ORANGE}; font-weight: 700; } nav .on i { border-color: ${ORANGE}; }
  .plan { margin-top: auto; padding: 14px; border-radius: 12px; background: #f7f8fb; display: grid; gap: 6px; font-size: 12px; color: #6b707a; } .plan b { color: #1b1d22; font-size: 13px; }
  .bar { height: 6px; border-radius: 3px; background: #e8eaf0; } .bar div { width: 60%; height: 100%; border-radius: 3px; background: ${ORANGE}; }
  main { flex: 1; padding: 26px 28px; display: grid; gap: 18px; align-content: start; }
  header { display: flex; justify-content: space-between; align-items: center; } h1 { margin: 0; font-size: 26px; letter-spacing: -0.02em; } header p { margin: 4px 0 0; color: #6b707a; }
  header button { border: 0; border-radius: 10px; background: #111; color: #fff; font: 700 14px Inter; padding: 11px 16px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
  .kpi { background: #fff; border: 1px solid #eceef3; border-radius: 14px; padding: 14px 16px; display: grid; gap: 4px; } .kpi span { color: #6b707a; font-size: 13px; } .kpi b { font-size: 26px; letter-spacing: -0.02em; } .kpi em { font-style: normal; color: #1e9e73; font-weight: 700; font-size: 12px; }
  .row { display: flex; gap: 14px; }
  .card { background: #fff; border: 1px solid #eceef3; border-radius: 14px; padding: 16px 18px; position: relative; }
  .chart { flex: 1.55; } .ch { display: flex; justify-content: space-between; margin-bottom: 10px; } .tag { font-size: 12px; color: #6b707a; background: #f4f5f8; padding: 3px 9px; border-radius: 99px; }
  .tip { position: absolute; right: 30px; top: 58px; background: #2563eb; color: #fff; font-size: 12px; line-height: 1.35; padding: 8px 11px; border-radius: 10px; box-shadow: 0 6px 16px rgba(37,99,235,0.3); }
  .list { flex: 1; display: grid; gap: 12px; align-content: start; } .li { display: grid; grid-template-columns: 80px 1fr 26px; gap: 10px; align-items: center; color: #3b3f47; }
  .track { height: 8px; border-radius: 4px; background: #f1f2f5; } .track div { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #f6a086, ${ORANGE}); } .li em { font-style: normal; font-weight: 700; text-align: right; }
  .small { flex: 1; display: grid; gap: 10px; align-content: start; }
  .art { display: flex; gap: 8px; align-items: center; color: #3b3f47; font-size: 13px; } .art i { font-style: normal; width: 20px; height: 20px; border-radius: 6px; background: #fff1ec; color: ${ORANGE}; display: grid; place-items: center; font-weight: 700; font-size: 11px; } .art em { margin-left: auto; font-style: normal; color: #1e9e73; font-weight: 700; }
  .answers { display: grid; gap: 4px; } .ans { display: grid; grid-template-columns: 110px 1fr 40px; gap: 12px; align-items: center; padding: 10px 0; border-top: 1px solid #f1f2f5; color: #3b3f47; }
  .eng { font-weight: 700; color: #1b1d22; } .ans em { font-style: normal; font-weight: 700; color: ${ORANGE}; text-align: right; }
  .score { position: relative; width: 92px; height: 92px; } .score b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 26px; }`, 2)

fs.rmSync(TMP, { recursive: true, force: true })
