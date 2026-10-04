// "Words to motion" şablonunun görselleri: yazı kutusu, artı ikonu ve kutuyu silen zemin plakası.
//   node scripts/build-words-motion-assets.mjs
// HTML → başsız Chrome → saydam PNG (public/templates/words-motion). Ölçüler 1920×1080 kadrajın pikselinde,
// kamera kutuya 9.4 kata kadar yaklaştığı için PNG'ler 4 kat çözünürlükte çizilir.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUT = 'public/templates/words-motion'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-'))

function shoot(name, w, h, body, scale = 4) {
  const html = path.join(TMP, `${name}.html`)
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; background: transparent; }
</style></head><body>${body}</body></html>`)
  const out = path.resolve(OUT, `${name}.png`)
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', `--force-device-scale-factor=${scale}`,
    `--window-size=${w},${h}`, '--default-background-color=00000000', '--virtual-time-budget=500', `--screenshot=${out}`, pathToFileURL(html).href,
  ], { stdio: 'ignore' })
  console.log(name, `${w * scale}×${h * scale}`)
}

fs.mkdirSync(OUT, { recursive: true })

// Yazı kutusu 1240×221 (referansta dolgu #101010, üst kenar ~#989898'den alta doğru sönen 2 px çerçeve).
shoot('pill', 1240, 221, `<div style="box-sizing:border-box;width:1240px;height:221px;border-radius:111px;border:2px solid transparent;
  background: linear-gradient(#101010,#101010) padding-box, linear-gradient(180deg,#9a9a9a 0%,#4a4a4a 45%,#1c1c1c 100%) border-box;"></div>`)

// Yakın plandaki kutu: yazıya göre daha yüksek (269 px) ama köşe yarıçapı aynı; uzaklaşırken `pill`e dönüşür
shoot('pill-tall', 1508, 269, `<div style="box-sizing:border-box;width:1508px;height:269px;border-radius:111px;border:2px solid transparent;
  background: linear-gradient(#101010,#101010) padding-box, linear-gradient(180deg,#9a9a9a 0%,#4a4a4a 45%,#1c1c1c 100%) border-box;"></div>`)

// Artı ikonu 65×65, çizgi 6 px, gri
shoot('plus', 65, 65, `<svg width="65" height="65" viewBox="0 0 65 65"><path d="M32.5 3v59M3 32.5h59" stroke="#9f9f9f" stroke-width="6" stroke-linecap="round"/></svg>`)

// Silme plakası: zemin renginde (#0A0A0A), sağ kenarı 120 px yumuşak geçişli. Soldan sağa kayarak kutuyu siler.
shoot('eraser', 1800, 400, `<div style="width:1800px;height:400px;background:linear-gradient(90deg,#0a0a0a 0,#0a0a0a 1680px,rgba(10,10,10,0) 1800px)"></div>`, 1)
