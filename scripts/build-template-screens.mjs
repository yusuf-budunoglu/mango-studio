// Şablonlardaki telefon ekranı görselleri: kodla çizilen SVG → PNG (public/templates/screens).
//   node scripts/build-template-screens.mjs
// Tamamen kendi tasarımımız; dış görsel kullanılmaz.
import fs from 'node:fs'
import sharp from 'sharp'

const W = 1080
const H = 2348 // telefon ekran oranı (~0.46)
const FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"

/** Fintech uygulaması: bakiye girişi, tuş takımı, gönder/iste düğmeleri. */
function fintech({ bg = '#72e83f', ink = '#0b0f0a', soft = 'rgba(11,15,10,0.08)', amount = '$48' } = {}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '‹']
  const keyW = 300
  const keyH = 150
  const kx = (i) => 90 + (i % 3) * keyW + keyW / 2
  const ky = (i) => 1180 + Math.floor(i / 3) * keyH + keyH / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <!-- durum çubuğu -->
  <text x="130" y="120" font-family="${FONT}" font-size="46" font-weight="600" fill="${ink}">9:41</text>
  <g fill="${ink}">
    <rect x="770" y="92" width="10" height="22" rx="3"/><rect x="788" y="84" width="10" height="30" rx="3"/><rect x="806" y="76" width="10" height="38" rx="3"/><rect x="824" y="68" width="10" height="46" rx="3"/>
    <path d="M868 104 a30 30 0 0 1 44 0 l-8 8 a18 18 0 0 0 -28 0z M852 88 a52 52 0 0 1 76 0 l-8 8 a40 40 0 0 0 -60 0z"/>
    <rect x="948" y="78" width="72" height="36" rx="10" fill="none" stroke="${ink}" stroke-width="4"/><rect x="954" y="84" width="52" height="24" rx="6"/>
  </g>
  <!-- üst bar: tara, ara, profil -->
  <circle cx="150" cy="260" r="62" fill="${soft}"/>
  <g fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round">
    <path d="M122 246 v-14 h14 M178 246 v-14 h-14 M122 274 v14 h14 M178 274 v14 h-14"/>
  </g>
  <circle cx="790" cy="260" r="62" fill="${soft}"/>
  <circle cx="782" cy="252" r="20" fill="none" stroke="${ink}" stroke-width="7"/>
  <path d="M797 267 l18 18" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
  <defs><linearGradient id="av" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd166"/><stop offset="1" stop-color="#ef476f"/></linearGradient></defs>
  <circle cx="930" cy="260" r="62" fill="url(#av)"/>
  <circle cx="930" cy="246" r="20" fill="rgba(255,255,255,0.85)"/>
  <path d="M894 300 a36 30 0 0 1 72 0z" fill="rgba(255,255,255,0.85)"/>
  <!-- tutar -->
  <text x="${W / 2}" y="760" text-anchor="middle" font-family="${FONT}" font-size="300" font-weight="800" letter-spacing="-8" fill="${ink}">${amount}</text>
  <rect x="${W / 2 - 150}" y="830" width="300" height="76" rx="38" fill="${soft}"/>
  <text x="${W / 2}" y="882" text-anchor="middle" font-family="${FONT}" font-size="40" font-weight="600" fill="${ink}">USD ▾</text>
  <!-- tuş takımı -->
  ${keys.map((k, i) => `<text x="${kx(i)}" y="${ky(i) + 24}" text-anchor="middle" font-family="${FONT}" font-size="72" font-weight="600" fill="${ink}">${k}</text>`).join('\n  ')}
  <!-- düğmeler -->
  <rect x="90" y="1810" width="435" height="130" rx="65" fill="${soft}"/>
  <text x="307" y="1892" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="700" fill="${ink}">Request</text>
  <rect x="555" y="1810" width="435" height="130" rx="65" fill="${soft}"/>
  <text x="772" y="1892" text-anchor="middle" font-family="${FONT}" font-size="50" font-weight="700" fill="${ink}">Split</text>
  <rect x="90" y="1970" width="900" height="140" rx="70" fill="${ink}"/>
  <text x="${W / 2}" y="2058" text-anchor="middle" font-family="${FONT}" font-size="54" font-weight="700" fill="${bg}">Send</text>
  <!-- sekme çubuğu -->
  <g fill="none" stroke="${ink}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M190 2230 l40 -34 l40 34 v40 h-80z"/>
    <path d="M810 2200 h80 v56 h-50 l-22 18 v-18 h-8z"/>
  </g>
  <rect x="470" y="2185" width="140" height="100" rx="50" fill="${soft}"/>
  <path d="M540 2210 v50 M515 2235 h50" stroke="${ink}" stroke-width="8" stroke-linecap="round"/>
</svg>`
}

fs.mkdirSync('public/templates/screens', { recursive: true })
await sharp(Buffer.from(fintech())).png({ compressionLevel: 9 }).toFile('public/templates/screens/fintech.png')
console.log('ok', fs.statSync('public/templates/screens/fintech.png').size)
