// "Fold promo" şablonunun katlanır telefon ekranlarında oynayan videolar (sessiz, 20 sn, 30 kare/sn):
//   node scripts/build-fold-promo-screens.mjs
// - inner.mp4 (1428×1000, iç ekranın oranı 1.43): Mango Studio editörü; imleç başlığı yazar, rengini değiştirir,
//   timeline'da klibi taşır ve uzatır, dışa aktarır. Oynatma kafası sürekli ilerler.
// - cover.mp4 (688×1000, kapak ekranının oranı 0.69): istem yazılır, video üretilir, hazır video oynar ve dışa
//   aktarılır. İki ekran aynı projeyi gösterir (aynı kompozisyon: `comp`). Kayan liste yok (kullanıcı kararı).
//   Renkler koyu ve sıcak (espresso, fildişi, kehribar); marka turuncusu yalnızca küçük vurgularda.
// - glow.png (1024×1024, saydam): fonun önündeki yumuşak beyaz ışık; şablonda katman rengiyle boyanır (`tint`).
// Videolarda her 15 karede bir anahtar kare var: editörde ileri geri sarınca ekran hemen yetişsin.
// Sayfa zamana göre saf çizilir (`setTime(t)`): başsız Chrome'da (CDP) her kare ayrı çekilir, ffmpeg birleştirir.
// Ekranlardaki arayüz temsilidir (gerçek ekran görüntüsü değil).
import { execFileSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/fold-promo'
const FPS = 30
const SECONDS = 20
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'fold-promo-'))
const font = (f) => pathToFileURL(path.resolve('src/assets/fonts', f)).href
const mark = pathToFileURL(path.resolve('public/brand/mango-mark.png')).href

const BASE_CSS = `
@font-face { font-family: Inter; font-weight: 400; src: url(${font('inter-400.woff')}); }
@font-face { font-family: Inter; font-weight: 700; src: url(${font('inter-700.woff')}); }
* { box-sizing: border-box; }
html, body { margin: 0; overflow: hidden; background: #000; }
body { position: relative; font-family: Inter, sans-serif; color: #f5f2ec; -webkit-font-smoothing: antialiased; }
.abs { position: absolute; }
.cursor { position: absolute; width: 30px; height: 30px; z-index: 9; filter: drop-shadow(0 3px 5px rgba(0,0,0,.55)); }
.ring { position: absolute; width: 60px; height: 60px; margin: -30px 0 0 -30px; border-radius: 50%; border: 3px solid #ff7a00; z-index: 8; }
`
const HELPERS = `
const clamp = (v) => Math.min(1, Math.max(0, v))
const ease = (v) => { v = clamp(v); return v * v * (3 - 2 * v) }
const seg = (t, a, b) => ease((t - a) / (b - a))
const lerp = (a, b, k) => a + (b - a) * k
const $ = (id) => document.getElementById(id)
/** Anahtar noktalar arasında yumuşak gezen imleç: [[t, x, y], ...] */
function along(path, t) {
  let i = 0
  while (i < path.length - 2 && t > path[i + 1][0]) i++
  const [t0, x0, y0] = path[i], [t1, x1, y1] = path[i + 1]
  const k = seg(t, t0, t1)
  return [lerp(x0, x1, k), lerp(y0, y1, k)]
}
/** Tıklama halkası: tıklama anından sonra büyüyüp söner. */
function ripple(el, clicks, t, pos) {
  const hit = clicks.find((c) => t >= c && t < c + 0.45)
  if (hit === undefined) { el.style.opacity = 0; return }
  const k = (t - hit) / 0.45
  el.style.opacity = 1 - k
  el.style.transform = 'scale(' + (0.3 + 0.9 * k) + ')'
  el.style.left = pos[0] + 'px'; el.style.top = pos[1] + 'px'
}
const CURSOR = '<svg class="cursor" id="cursor" viewBox="0 0 24 24"><path d="M4 2 L4 19 L8.6 14.8 L11.6 21.6 L14.4 20.4 L11.4 13.8 L17.6 13.6 Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg><div class="ring" id="ring"></div>'
`

// Ekranlardaki proje: iki ekranda da aynı kompozisyon (900×540). `drawComp` oynatma konumuna (0..1) göre çizer.
const COMP_CSS = `
.comp { width: 900px; height: 540px; overflow: hidden; background: radial-gradient(85% 120% at 74% 42%, #6b3410 0%, #2a1407 46%, #0d0703 100%); }
.comp .kicker { left: 64px; top: 150px; font: 700 15px Inter; letter-spacing: .22em; color: #e9964a; }
.comp .head { left: 60px; top: 184px; width: 520px; font: 700 68px/1 Inter; letter-spacing: -.035em; color: #f3efe8; white-space: nowrap; }
.comp .sub { left: 64px; top: 280px; font: 400 22px Inter; color: rgba(243,239,232,.62); }
.comp .cta { left: 64px; top: 344px; padding: 13px 24px; border-radius: 999px; background: #f3efe8; color: #1d1d1f; font: 700 18px Inter; }
.comp .phone { left: 620px; top: 70px; width: 210px; height: 420px; border-radius: 36px; background: #0b0b0d; border: 5px solid #8f8377; box-shadow: 0 34px 70px rgba(0,0,0,.55); overflow: hidden; }
.comp .phone u { position: absolute; left: 16px; right: 16px; height: 14px; border-radius: 7px; background: #2a2a30; }
`
const comp = (id) => `<div class="abs comp" id="${id}">
  <div class="abs kicker">● NEW RELEASE</div>
  <div class="abs head"></div>
  <div class="abs sub">Made in the browser. Edited on a timeline.</div>
  <div class="abs cta">Try it free</div>
  <div class="abs phone"><u style="top:60px"></u><u style="top:90px;right:70px"></u><u style="top:146px;height:128px;border-radius:16px;background:linear-gradient(150deg,#f0a25a,#b85a17)"></u><u style="top:296px"></u><u style="top:326px;right:90px"></u></div>
</div>`
const COMP_JS = `
function drawComp(id, play, text, color) {
  const root = $(id)
  const rise = seg(play, 0.04, 0.16)
  ;[['.kicker', 0], ['.head', 0.03], ['.sub', 0.07], ['.cta', 0.11]].forEach(([sel, delay]) => {
    const el = root.querySelector(sel)
    const k = seg(play, 0.04 + delay, 0.16 + delay)
    el.style.opacity = k
    el.style.transform = 'translateY(' + (1 - k) * 34 + 'px)'
  })
  const head = root.querySelector('.head')
  head.textContent = text
  head.style.color = color
  const spin = seg(play, 0.1, 0.42)
  const phone = root.querySelector('.phone')
  phone.style.transform = 'translateY(' + (1 - rise) * 80 + 'px) rotate(' + lerp(16, 6, spin) + 'deg) scale(' + lerp(0.86, 1, spin) + ')'
  phone.style.opacity = rise
}
`

/** İç ekran: editör. */
function innerPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${COMP_CSS}
html, body { width: 1428px; height: 1000px; }
body { background: #060606; }
.top { left: 0; top: 0; width: 1428px; height: 58px; background: #0e0e10; border-bottom: 1px solid #222226; }
.brand { left: 20px; top: 13px; display: flex; align-items: center; gap: 10px; font: 700 19px Inter; letter-spacing: .02em; }
.brand img { width: 30px; height: 30px; }
.brand b { color: #ff7a00; }
.proj { left: 250px; top: 19px; font: 400 17px Inter; color: #8e8a83; }
.export { right: 20px; top: 11px; width: 190px; height: 36px; border-radius: 9px; background: #f3efe8; color: #1d1d1f; font: 700 16px Inter; display: grid; place-items: center; overflow: hidden; }
.export i { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(224,122,31,.55); }
.rail { left: 0; top: 58px; width: 68px; height: 642px; background: #0e0e10; border-right: 1px solid #222226; }
.rail s { display: block; width: 28px; height: 28px; margin: 22px 20px; border-radius: 7px; background: #242428; }
.rail s:first-child { background: #ff7a00; }
.stage { left: 68px; top: 58px; width: 1070px; height: 642px; background: #000; }
#canvas { left: 85px; top: 51px; border-radius: 14px; box-shadow: 0 0 0 1px #222226; }
.sel { border: 2px solid #2b7fff; border-radius: 6px; }
.panel { left: 1138px; top: 58px; width: 290px; height: 642px; background: #0e0e10; border-left: 1px solid #222226; padding: 22px 20px; }
.panel h4 { margin: 0 0 9px; font: 400 13px Inter; letter-spacing: .12em; color: #8e8a83; }
.field { height: 44px; border-radius: 9px; border: 1px solid #222226; background: #000; padding: 0 13px; font: 400 17px/42px Inter; margin-bottom: 26px; white-space: nowrap; overflow: hidden; }
.field.on { border-color: #e07a1f; }
.caret { display: inline-block; width: 2px; height: 20px; background: #e07a1f; vertical-align: -3px; margin-left: 1px; }
.swatches { display: flex; gap: 12px; margin-bottom: 26px; }
.swatches span { width: 38px; height: 38px; border-radius: 50%; }
.chip { display: inline-block; padding: 9px 14px; border-radius: 8px; background: #17171a; border: 1px solid #222226; font: 400 15px Inter; margin-bottom: 26px; }
.bar { height: 6px; border-radius: 3px; background: #222226; margin-bottom: 26px; }
.bar i { display: block; height: 100%; width: 62%; border-radius: 3px; background: #e07a1f; }
.tl { left: 0; top: 700px; width: 1428px; height: 300px; background: #0a0a0b; border-top: 1px solid #222226; }
.names { left: 0; top: 42px; width: 190px; }
.names div { height: 62px; padding-left: 22px; font: 400 16px/62px Inter; color: #bdb8af; border-bottom: 1px solid #161618; }
.ruler { left: 190px; top: 0; width: 1238px; height: 42px; border-bottom: 1px solid #222226; }
.ruler span { position: absolute; top: 12px; font: 400 13px Inter; color: #6a665f; }
.row { left: 190px; width: 1238px; height: 62px; border-bottom: 1px solid #161618; }
.clip { position: absolute; top: 10px; height: 42px; border-radius: 8px; padding: 0 12px; font: 700 14px/42px Inter; color: #1d1d1f; white-space: nowrap; overflow: hidden; }
.playhead { top: 0; width: 2px; height: 300px; background: #ff7a00; z-index: 5; }
.playhead::before { content: ''; position: absolute; left: -7px; top: 0; border: 8px solid transparent; border-top: 12px solid #ff7a00; }
.wave { position: absolute; left: 12px; right: 12px; top: 8px; bottom: 8px; background: repeating-linear-gradient(90deg, rgba(243,239,232,.4) 0 3px, transparent 3px 7px); mask-image: radial-gradient(60% 120% at 50% 50%, #000 40%, transparent 100%); }
.toast { left: 372px; top: 290px; padding: 14px 22px; border-radius: 12px; background: #17171a; border: 1px solid #3a3a40; color: #f3efe8; font: 700 18px Inter; z-index: 7; }
</style></head><body>
<div class="abs top">
  <div class="abs brand"><img src="${mark}"><span>MANGO <b>STUDIO</b></span></div>
  <div class="abs proj">Launch video · 1920 × 1080</div>
  <div class="abs export"><i id="exbar"></i><span id="exlabel" style="position:relative">Export</span></div>
</div>
<div class="abs rail"><s></s><s></s><s></s><s></s><s></s><s></s></div>
<div class="abs stage">
  ${comp('canvas')}
  <div class="abs sel" id="sel"></div>
  <div class="abs toast" id="toast">✓ Exported · launch-video.mp4</div>
</div>
<div class="abs panel">
  <h4>HEADLINE</h4><div class="field" id="field"></div>
  <h4>COLOR</h4><div class="swatches"><span id="sw0" style="background:#f3efe8"></span><span id="sw1" style="background:#f0a25a"></span><span id="sw2" style="background:#c9b596"></span><span id="sw3" style="background:#6f8f6a"></span></div>
  <h4>ANIMATION</h4><div class="chip">Rise in · 0.6 s</div>
  <h4>EASING</h4><div class="bar"><i></i></div>
  <h4>CAMERA</h4><div class="chip">Push in · 2.5×</div>
</div>
<div class="abs tl">
  <div class="abs ruler" id="ruler"></div>
  <div class="abs names"><div>Headline</div><div>Phone</div><div>Logo</div><div>Music</div></div>
  <div class="abs row" style="top:42px"><div class="clip" id="clipA" style="background:#e9964a">Rise in · Headline</div></div>
  <div class="abs row" style="top:104px"><div class="clip" id="clipB" style="background:#c9b596">Phone · spin and settle</div></div>
  <div class="abs row" style="top:166px"><div class="clip" id="clipC" style="background:#8fa98a;left:760px;width:300px">Logo reveal</div></div>
  <div class="abs row" style="top:228px"><div class="clip" style="background:#242428;left:20px;width:1180px"><div class="wave"></div></div></div>
  <div class="abs playhead" id="playhead"></div>
</div>
<script>${HELPERS}${COMP_JS}
document.body.insertAdjacentHTML('beforeend', CURSOR)
for (let i = 0; i <= 12; i++) $('ruler').insertAdjacentHTML('beforeend', '<span style="left:' + (20 + i * 98) + 'px">' + i + 's</span>')
const TEXT = 'Ship it Friday.'
const PATH = [[0, 900, 420], [2.6, 1290, 122], [5.9, 1290, 122], [6.9, 1235, 213], [7.6, 1235, 213], [8.5, 300, 784], [8.7, 300, 784], [10.6, 470, 784], [11.5, 660, 846], [11.8, 660, 846], [13.4, 800, 846], [14.6, 1320, 30], [15.2, 1320, 30], [17.6, 760, 430], [20, 900, 420]]
const CLICKS = [2.9, 7.1, 8.7, 11.8, 14.8]
const RING = '0 0 0 2px #0e0e10, 0 0 0 4px #f3efe8'
window.setTime = (t) => {
  // başlık: 3.0–5.6 arası harf harf yazılır
  const typed = t < 3 ? 0 : Math.min(TEXT.length, Math.floor((t - 3) * 5.8))
  const text = t < 3 ? 'Your headline' : TEXT.slice(0, typed)
  const editing = t >= 2.9 && t < 6.3
  $('field').className = 'field' + (editing ? ' on' : '')
  $('field').innerHTML = (t < 3 ? '<span style="color:#6a665f">Your headline</span>' : text) + (editing && Math.floor(t * 2) % 2 === 0 ? '<span class="caret"></span>' : '')
  // renk: 7.1'de başlık fildişinden kehribara
  const amber = seg(t, 7.1, 7.5) > 0.5
  $('sw0').style.boxShadow = amber ? 'none' : RING
  $('sw1').style.boxShadow = amber ? RING : 'none'
  // oynatma kafası 10 sn'de bir turlar; telefon açılırken ve katlanırken ekranın ortasından (menteşeden) uzakta
  const play = ((t + 5.8) % 10) / 10
  $('playhead').style.left = 190 + 20 + play * 1180 + 'px'
  // önizleme oynatma kafasına bağlı: giriş animasyonu turun başında, sonra kompozisyon yerinde durur
  drawComp('canvas', t < 4.2 ? 1 : play * 2.2, text, amber ? '#f0a25a' : '#f3efe8')
  // seçim kutusu: düzenlenen başlığın çevresinde
  const s = $('sel').style
  s.opacity = editing ? 1 : 0
  s.left = 85 + 52 + 'px'; s.top = 51 + 176 + 'px'; s.width = Math.max(120, 36 + text.length * 35) + 'px'; s.height = '84px'
  // klipler: A taşınır (8.7–10.6), B uzar (11.8–13.4)
  const a = $('clipA').style
  a.left = 60 + 170 * seg(t, 8.7, 10.6) + 'px'; a.width = '250px'
  a.boxShadow = t > 8.7 && t < 10.7 ? '0 0 0 2px #f3efe8' : 'none'
  const b = $('clipB').style
  b.left = '190px'; b.width = 280 + 140 * seg(t, 11.8, 13.4) + 'px'
  b.boxShadow = t > 11.8 && t < 13.5 ? '0 0 0 2px #f3efe8' : 'none'
  // dışa aktarma: 14.8'de tıklanır, 16.6'da biter
  const prog = clamp((t - 14.8) / 1.8)
  $('exbar').style.width = (t >= 14.8 && t < 16.6 ? prog * 100 : 0) + '%'
  $('exlabel').textContent = t < 14.8 || t >= 18.6 ? 'Export' : t < 16.6 ? 'Exporting ' + Math.round(prog * 100) + '%' : 'Exported ✓'
  const toast = seg(t, 16.6, 16.9) * (1 - seg(t, 18.2, 18.6))
  $('toast').style.opacity = toast
  $('toast').style.transform = 'translateY(' + (1 - toast) * 16 + 'px)'
  const pos = along(PATH, t)
  $('cursor').style.left = pos[0] + 'px'; $('cursor').style.top = pos[1] + 'px'
  ripple($('ring'), CLICKS, t, pos)
}
window.setTime(0)
</script></body></html>`
}

/** Kapak ekranı: istemden hazır videoya, sonra dışa aktarma. Dokunmatik ekran: imleç yok, dokunuş halkası var. */
function coverPage() {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}${COMP_CSS}
html, body { width: 688px; height: 1000px; }
body { background: radial-gradient(130% 50% at 50% 0%, #2b1608 0%, #0b0705 46%, #000 78%); }
.ring { border-color: rgba(243,239,232,.8); }
/* sağ üstte ön kamera deliği var: durum simgeleri onun solunda biter */
.status { left: 40px; right: 128px; top: 24px; display: flex; justify-content: space-between; font: 700 22px Inter; }
.brand { left: 40px; top: 84px; display: flex; align-items: center; gap: 12px; font: 700 24px Inter; letter-spacing: .02em; }
.brand img { width: 40px; height: 40px; }
.brand b { color: #ff7a00; }
.title { left: 40px; top: 162px; font: 700 54px/1.02 Inter; letter-spacing: -.035em; }
.title em { font-style: normal; color: #f0a25a; }
.prompt { left: 40px; top: 300px; width: 608px; height: 148px; border-radius: 22px; background: #0e0e10; border: 1.5px solid #26262a; padding: 22px 24px; font: 400 25px/1.35 Inter; }
.prompt.on { border-color: #e07a1f; }
.caret { display: inline-block; width: 2.5px; height: 28px; background: #e07a1f; vertical-align: -5px; margin-left: 2px; }
.gen { left: 40px; top: 470px; width: 608px; height: 66px; border-radius: 18px; background: #f3efe8; color: #1d1d1f; font: 700 25px Inter; display: grid; place-items: center; }
.steps { left: 40px; top: 566px; width: 608px; }
.step { display: flex; align-items: center; gap: 16px; height: 58px; font: 400 24px Inter; color: #bdb8af; }
.step s { width: 28px; height: 28px; border-radius: 50%; border: 3px solid #3a3530; display: grid; place-items: center; text-decoration: none; font: 700 17px Inter; color: #1d1d1f; }
.step.done s { background: #f0a25a; border-color: #f0a25a; }
.step.busy s { border-color: #f0a25a; border-right-color: transparent; }
.result { left: 40px; top: 300px; width: 608px; }
.frame { left: 0; top: 0; width: 608px; height: 365px; border-radius: 22px; overflow: hidden; box-shadow: 0 0 0 1px #26262a, 0 30px 60px rgba(0,0,0,.6); }
.frame .comp { left: 0; top: 0; transform-origin: 0 0; transform: scale(${608 / 900}); }
.scrub { left: 0; top: 394px; width: 608px; height: 6px; border-radius: 3px; background: #26262a; }
.scrub i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: #f3efe8; }
.scrub b { position: absolute; top: -6px; width: 18px; height: 18px; margin-left: -9px; border-radius: 50%; background: #f3efe8; }
.time { left: 0; top: 416px; width: 608px; display: flex; justify-content: space-between; font: 400 20px Inter; color: #8e8a83; font-variant-numeric: tabular-nums; }
.btn { top: 474px; width: 295px; height: 66px; border-radius: 18px; font: 700 24px Inter; display: grid; place-items: center; overflow: hidden; }
.btn.edit { left: 0; border: 1.5px solid #3a3a40; color: #f3efe8; }
.btn.out { left: 313px; background: #f3efe8; color: #1d1d1f; }
.btn.out i { position: absolute; left: 0; top: 0; bottom: 0; background: rgba(224,122,31,.55); }
.saved { left: 0; top: 572px; width: 608px; height: 84px; border-radius: 18px; background: #0e0e10; border: 1.5px solid #26262a; display: flex; align-items: center; gap: 18px; padding: 0 22px; font: 400 20px Inter; color: #bdb8af; }
.saved s { flex: none; width: 40px; height: 40px; border-radius: 50%; background: #f0a25a; color: #1d1d1f; display: grid; place-items: center; text-decoration: none; font: 700 22px Inter; }
.saved b { display: block; color: #f3efe8; font: 700 23px Inter; margin-bottom: 2px; }
</style></head><body>
<div class="abs status"><span>9:41</span><span>●●● 5G</span></div>
<div class="abs brand"><img src="${mark}"><span>MANGO <b>STUDIO</b></span></div>
<div class="abs title" id="titleA">What will<br>you <em>make?</em></div>
<div class="abs title" id="titleB">Your video<br>is <em>ready.</em></div>
<div class="abs prompt" id="prompt"></div>
<div class="abs gen" id="gen">Generate video</div>
<div class="abs steps" id="steps"></div>
<div class="abs result" id="result">
  <div class="abs frame">${comp('preview')}</div>
  <div class="abs scrub"><i id="scrubFill"></i><b id="scrubKnob"></b></div>
  <div class="abs time"><span id="now">0:00</span><span>0:15</span></div>
  <div class="abs btn edit">Edit</div>
  <div class="abs btn out" id="out"><i id="outBar"></i><span id="outLabel" style="position:relative">Export</span></div>
  <div class="abs saved" id="saved"><s>✓</s><div><b>launch-video.mp4</b>Saved to your Studio · 1080p · 60 fps</div></div>
</div>
<script>${HELPERS}${COMP_JS}
document.body.insertAdjacentHTML('beforeend', '<div class="ring" id="ring"></div>')
const TEXT = 'A 15-second launch video for my app'
const STEPS = ['Reading your brief', 'Building the scenes', 'Timing the motion', 'Ready to edit']
// dokunuşlar: istem kutusu, oluştur düğmesi, dışa aktar düğmesi
const TAPS = [[1.0, 330, 350], [5.5, 344, 503], [14.8, 500, 807]]
window.setTime = (t) => {
  const typed = t < 1.1 ? 0 : Math.min(TEXT.length, Math.floor((t - 1.1) * 10.5))
  const typing = t >= 1.0 && t < 5.5
  const done = seg(t, 9.4, 9.9)
  $('titleA').style.opacity = 1 - done
  $('titleB').style.opacity = done
  $('prompt').className = 'abs prompt' + (typing ? ' on' : '')
  $('prompt').innerHTML = (typed ? TEXT.slice(0, typed) : '<span style="color:#6a665f">Describe your video…</span>') + (typing && Math.floor(t * 2) % 2 === 0 ? '<span class="caret"></span>' : '')
  $('prompt').style.opacity = 1 - done
  const press = seg(t, 5.5, 5.62) * (1 - seg(t, 5.62, 5.8))
  $('gen').style.transform = 'scale(' + (1 - 0.05 * press) + ')'
  $('gen').style.opacity = 1 - done
  $('gen').textContent = t < 5.6 ? 'Generate video' : 'Generating…'
  // adımlar 5.8'den itibaren birer saniye arayla
  const working = t >= 5.7 && t < 9.9
  $('steps').style.opacity = working ? 1 - seg(t, 9.3, 9.6) : 0
  $('steps').innerHTML = STEPS.map((label, i) => {
    const at = 5.8 + i * 0.9
    const state = t < at ? '' : t < at + 0.9 && i < 3 ? 'busy' : 'done'
    return '<div class="step ' + state + '" style="opacity:' + seg(t, at - 0.15, at + 0.1) + '"><s style="' + (state === 'busy' ? 'transform:rotate(' + t * 420 + 'deg)' : '') + '">' + (state === 'done' ? '✓' : '') + '</s>' + label + '</div>'
  }).join('')
  // hazır video: 9.9'dan itibaren oynar (5 sn'de bir başa döner), altında zaman çubuğu
  $('result').style.opacity = done
  $('result').style.transform = 'translateY(' + (1 - done) * 30 + 'px)'
  const loop = t < 9.9 ? 0 : ((t - 9.9) % 5) / 5
  drawComp('preview', loop * 2.2, 'Ship it Friday.', '#f3efe8')
  $('scrubFill').style.width = loop * 100 + '%'
  $('scrubKnob').style.left = loop * 100 + '%'
  $('now').textContent = '0:' + String(Math.floor(loop * 15)).padStart(2, '0')
  // dışa aktarma: 14.8'de dokunulur, 16.6'da biter (iç ekrandaki editörle aynı anlar)
  const prog = clamp((t - 14.8) / 1.8)
  const tap = seg(t, 14.8, 14.92) * (1 - seg(t, 14.92, 15.1))
  $('outBar').style.width = (t >= 14.8 && t < 16.6 ? prog * 100 : 0) + '%'
  $('outLabel').textContent = t < 14.8 ? 'Export' : t < 16.6 ? Math.round(prog * 100) + '%' : 'Exported ✓'
  $('out').style.transform = 'scale(' + (1 - 0.05 * tap) + ')'
  const saved = seg(t, 16.6, 17)
  $('saved').style.opacity = saved
  $('saved').style.transform = 'translateY(' + (1 - saved) * 18 + 'px)'
  const hit = TAPS.find((c) => t >= c[0] && t < c[0] + 0.45)
  ripple($('ring'), TAPS.map((c) => c[0]), t, hit ? [hit[1], hit[2]] : [0, 0])
}
window.setTime(0)
</script></body></html>`
}

// --- başsız Chrome'u CDP ile sür: her kare için setTime + ekran görüntüsü ---
const PORT = 9341
const chrome = spawn(CHROME, ['--headless=new', '--hide-scrollbars', '--force-device-scale-factor=1', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, 'about:blank'])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  target = await fetch(`http://127.0.0.1:${PORT}/json`).then((res) => res.json(), () => []).then((list) => list.find((t) => t.type === 'page'))
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => (ws.onopen = resolve))
let seq = 0
const pending = new Map()
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  pending.get(message.id)?.(message)
  pending.delete(message.id)
}
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq
  pending.set(id, resolve)
  ws.send(JSON.stringify({ id, method, params }))
})

fs.mkdirSync(OUT, { recursive: true })
try {
  await send('Page.enable')
  for (const [name, html, width, height] of [['inner', innerPage(), 1428, 1000], ['cover', coverPage(), 688, 1000]]) {
    const file = path.join(TMP, `${name}.html`)
    const frames = path.join(TMP, name)
    fs.writeFileSync(file, html)
    fs.mkdirSync(frames)
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    await send('Page.navigate', { url: pathToFileURL(file).href })
    await sleep(1500)
    for (let i = 0; i < FPS * SECONDS; i++) {
      const res = await send('Runtime.evaluate', { expression: `window.setTime(${i / FPS}); document.fonts.status`, returnByValue: true })
      if (res.result?.exceptionDetails) throw new Error(`${name} kare ${i}: ${JSON.stringify(res.result.exceptionDetails).slice(0, 400)}`)
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 94, clip: { x: 0, y: 0, width, height, scale: 1 } })
      fs.writeFileSync(path.join(frames, `${String(i).padStart(4, '0')}.jpg`), Buffer.from(shot.result.data, 'base64'))
    }
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(frames, '%04d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '24', '-preset', 'slow', '-g', '15', '-keyint_min', '15', '-movflags', '+faststart', '-an', `${OUT}/${name}.mp4`])
    // kart ve belge için bir kare
    fs.copyFileSync(path.join(frames, name === 'inner' ? '0330.jpg' : '0420.jpg'), `${OUT}/${name}.jpg`)
    console.log(`${OUT}/${name}.mp4`, (fs.statSync(`${OUT}/${name}.mp4`).size / 1024).toFixed(0), 'KB')
  }
  // fon ışığı: saydam zeminde beyaz radyal geçiş
  const glow = path.join(TMP, 'glow.html')
  fs.writeFileSync(glow, '<!doctype html><html><body style="margin:0;background:transparent"><div style="width:1024px;height:1024px;background:radial-gradient(closest-side, rgba(255,255,255,0.95), rgba(255,255,255,0.5) 38%, rgba(255,255,255,0) 100%)"></div></body></html>')
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 1024, deviceScaleFactor: 1, mobile: false })
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } })
  await send('Page.navigate', { url: pathToFileURL(glow).href })
  await sleep(800)
  const png = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024, scale: 1 } })
  fs.writeFileSync(`${OUT}/glow.png`, Buffer.from(png.result.data, 'base64'))
} finally {
  ws.close()
  chrome.kill()
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 })
}
