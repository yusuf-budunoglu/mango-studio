// "Hidden gem" şablonunun görselleri, tablet ekranları ve yazı genişlikleri (public/templates/hidden-gem):
//   node scripts/build-hidden-gem-assets.mjs [three|gem|flat|screens|metrics]   (boşsa hepsi; gem yalnızca mücevher)
// Hepsi kodla, bizim tasarımımızla üretilir; referansın görseli, fotoğrafı ya da logosu kullanılmaz.
// - three: three.js ile kare kare çizilen 3D parçalar (saydam WebP)
//     stack-00…41: üst üste dalgalanan kumaş levhalar (1440×1080, kadrajın ortasına tam yükseklikte); referansın 24 kare/sn'lik
//     60–101. karelerine denk, en üst noktası ölçülen ekran y'sini izler
//     gem-00…40: yassı, yüzeyli altın taş Y ekseninde döner (referansın 121.6–137.6. kareleri, 60 kare/sn'lik 40 aralık,
//     her kare alt kareler ortalanarak hareket bulanıklıklı)
// - flat: blob (yumuşak beyaz ışık, boyanır), card-shadow (afiş gölgesi, boyanır), card-shade (kartın üstündeki ışık),
//     vignette (kenar kararması), afişler (köşeleri yuvarlak, oran 0.536:
//     referanstaki masa düzleminden ölçüldü): poster-grad (mavi-sarı degrade), poster-wide (yatay degrade), poster-crystal
//     (Crystal şablonunun kapağı), poster-pill (bizim tasarımımız: mavi hap içinde Mango logosu ve üç kısa satır, EN/TR)
// - screens: tabletin üç ekranı (EN/TR): screen-1-<dil>.mp4 (karolar kayar), screen-2-<dil>.jpg, screen-3-<dil>.jpg; 1440×1080
// - metrics: şablondaki kelimelerin genişlikleri (Inter 500 / 600, em) → src/project/hiddenGemMetrics.ts
// Sayfalar başsız Chrome'da (CDP) çizilir; three.js ve yazı tipleri için depo kökü yerel bir sunucudan verilir.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

const OUT = 'public/templates/hidden-gem'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p))
const ROOT = path.resolve('.')
const PORT = 9374
const only = process.argv[2]
const want = (group) => !only || only === group

// Mango renkleri (src/styles/brand.md)
// Renkler referanstan ölçüldü (kullanıcı kararı 2026-10-14: "renkler örnek videodaki gibi birebir")
const C = { ink: '#0E0E13', blue: '#4758DD', blueDeep: '#3E50D0', blueSoft: '#5B6FE6', yellow: '#E8CF16', sand: '#EAC584', screen: '#E2E8EA', lavender: '#B8C3E6', pink: '#E9B6D3', gold: '#D9B44A' }

// şablondaki kelimeler (src/i18n/locales ile aynı olmalı)
const WORDS = [
  'Every', '100', 'prompts', "there's", 'one', 'hidden', 'gem', "Don't", 'miss', 'it.', 'Introducing',
  'Her', 'istemde', 'bir', 'tane', 'gizli', 'cevher', 'Sakın', 'kaçırma.', 'Karşınızda',
]

// ---------------------------------------------------------------- sayfa betiği (three.js parçaları + düz görseller + ölçüler)
const PAGE_JS = String.raw`
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'
const C = ${JSON.stringify(C)}
const GROUP = ${JSON.stringify(only ?? '')}
const want = (g) => !GROUP || GROUP === g
const out = {}

if (want('three') || GROUP === 'gem') {
  const W = 1100, H = 860
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(W, H)
  renderer.setClearColor(0x000000, 0)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const pmrem = new THREE.PMREMGenerator(renderer)
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  // ---------- kumaş levha yığını (1440×1080 tuval; şablonda kadrajın ortasına, tam yükseklikte konur)
  if (GROUP !== 'gem') {
    renderer.setSize(1440, 1080)
    renderer.toneMapping = THREE.NoToneMapping
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    const scene = new THREE.Scene()
    scene.environment = env
    scene.environmentIntensity = 0.28
    const key = new THREE.DirectionalLight(0xffffff, 2.6)
    key.position.set(-2.5, 7, 3.5)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 })
    key.shadow.bias = -0.0008
    key.shadow.radius = 4
    scene.add(key)
    const rim = new THREE.DirectionalLight(0xfff2e0, 0.7)
    rim.position.set(3, 1, -2)
    scene.add(rim)
    // kamera: z = 0 düzleminde 1 birim ≈ 352 px (yığın referanstaki gibi ~880 px geniş)
    const camera = new THREE.PerspectiveCamera(30, 1440 / 1080, 0.1, 100)
    camera.position.set(0, 1.2, 5.6)
    camera.lookAt(0, 0, 0)
    const perlin = new ImprovedNoise()
    const RINGS = 36, SEG = 144, R = 1.02
    const superR = (a) => { const n = 4.5; return R / Math.pow(Math.pow(Math.abs(Math.cos(a)), n) + Math.pow(Math.abs(Math.sin(a)), n), 1 / n) }
    const base = []
    for (let i = 0; i <= RINGS; i++) for (let j = 0; j < SEG; j++) {
      const a = (j / SEG) * Math.PI * 2, k = i / RINGS
      base.push(Math.cos(a) * superR(a) * k, 0, Math.sin(a) * superR(a) * k)
    }
    const index = []
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
      const a = i * SEG + j, b = i * SEG + ((j + 1) % SEG), c = (i + 1) * SEG + j, d = (i + 1) * SEG + ((j + 1) % SEG)
      index.push(a, c, b, b, c, d)
    }
    // alttan üste; referanstaki gibi en üstte mavi, aralarda sarı ve pembe
    const COLORS = ['#3F4FD2', '#D9AC33', '#CF92BD', '#D9AC33', '#CF92BD', '#D9AC33', '#CF92BD', '#5262D8', '#3F4FD2']
    const N = COLORS.length
    const sheets = COLORS.map((color, s) => {
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.Float32BufferAttribute(base.slice(), 3))
      g.setIndex(index)
      const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.36, metalness: 0, sheen: 0.3, sheenRoughness: 0.45, sheenColor: new THREE.Color('#fff4e6'), clearcoat: 0.55, clearcoatRoughness: 0.22, side: THREE.DoubleSide })
      const mesh = new THREE.Mesh(g, m)
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      return mesh
    })
    const lerpKeys = (keys, f) => {
      if (f <= keys[0][0]) return keys[0][1]
      for (let i = 0; i < keys.length - 1; i++) {
        const [f0, v0] = keys[i], [f1, v1] = keys[i + 1]
        if (f <= f1) { const u = (f - f0) / (f1 - f0); return v0 + (v1 - v0) * (u * u * (3 - 2 * u)) }
      }
      return keys[keys.length - 1][1]
    }
    // referans karesi (24 kare/sn) → en üst noktanın ekran y'si (px, 1080; çizimin tepesi bu değerden ~28 px aşağıda kaldığı için
    // ölçülenden o kadar yukarıda verildi), tepedeki sivrilik, levha aralığı, sola yatma (birim)
    const TOP = [[59, 1150], [60, 1020], [61, 890], [62, 726], [63, 592], [64, 478], [65, 452], [66, 442], [68, 382], [70, 356], [72, 334], [76, 318], [80, 312], [84, 296], [86, 290], [88, 292], [90, 310], [92, 370], [94, 440], [96, 540], [98, 700], [100, 940], [101, 1120]]
    const PEAK = [[60, 0.85], [64, 0.8], [66, 0.65], [68, 0.42], [70, 0.25], [72, 0.12], [76, 0.03], [80, 0]]
    const GAP = [[60, 0.035], [64, 0.05], [66, 0.09], [70, 0.15], [76, 0.19], [90, 0.2], [94, 0.15], [101, 0.12]]
    const LEAN = [[60, 0], [64, -0.12], [66, -0.22], [68, -0.28], [70, -0.24], [72, -0.2], [76, -0.12], [80, -0.05], [84, 0]]
    // batarken yığın sağa kayar (referansta ortası 86'da 950, 94'te 1010 px)
    const DRIFT = [[60, 0], [84, 0], [86, 0.02], [90, 0.12], [94, 0.22], [101, 0.32]]
    const PX = 352
    for (let f = 60; f <= 101; f++) {
      const t = (f - 60) / 24
      const peak = lerpKeys(PEAK, f), gap = lerpKeys(GAP, f), lean = lerpKeys(LEAN, f)
      const top = (540 - lerpKeys(TOP, f)) / PX
      const floor = top - peak - (N - 1) * gap - 0.08
      sheets.forEach((mesh, s) => {
        const pos = mesh.geometry.attributes.position
        const fromTop = N - 1 - s
        for (let v = 0; v < pos.count; v++) {
          const x = base[v * 3], z = base[v * 3 + 2]
          const r = Math.hypot(x, z) / R
          const n = perlin.noise(x * 0.85 + s * 0.31, z * 0.85 - s * 0.17, t * 0.95 + s * 0.13)
          const wave = (0.035 + 0.15 * r * r) * (Math.sin(x * 2.3 + t * 3.3 + s * 0.7) * 0.5 + Math.sin(z * 2.0 - t * 2.6 + s) * 0.35 + n * 0.8) + 0.06 * (x * Math.sin(s * 1.3) + z * Math.cos(s * 0.9))
          // asılı kumaş: üstteki levhalar yayvan, sola yatık bir tepeye örtülü (referanstaki şapka biçimi), kenarlar aşağı sarkar
          const k = Math.max(0, 1 - fromTop * 0.09)
          const drape = peak * k * (Math.exp(-(r * r) / 0.3) - 0.35 * r)
          pos.setX(v, x + lean * (1 - r) * (1 + fromTop * 0.1) * (peak > 0.01 ? 1 : 0) + lean * 0.3)
          pos.setY(v, floor + s * gap + wave + drape - r * r * 0.1)
        }
        pos.needsUpdate = true
        mesh.geometry.computeVertexNormals()
        mesh.rotation.y = ((s * 0.41) % 0.7) - 0.35 + t * 0.38
        mesh.position.x = -0.08 + lerpKeys(DRIFT, f)
      })
      renderer.render(scene, camera)
      out['stack-' + String(f - 60).padStart(2, '0')] = renderer.domElement.toDataURL('image/webp', 0.84)
    }
    renderer.shadowMap.enabled = false
    renderer.toneMapping = THREE.ACESFilmicToneMapping
  }

  // ---------- mücevher: yassı, yüzeyli altın taş (sekizyüzlü, derinliği ince). Referansta tam yandan (ince çubuk) önden
  // görünene iki karede döner, önden dururken yavaşça dönmeyi sürdürür (yüzey çizgileri kayar), aynı yönde dönerek çubuğa iner.
  // Açı, referansta her karede ölçülen genişlikten (genişlik = cos açı); 512 px tuvalde taş 400 px yüksek.
  {
    renderer.setSize(512, 512)
    renderer.toneMapping = THREE.NoToneMapping
    const scene = new THREE.Scene()
    scene.environment = env
    scene.environmentIntensity = 0.45
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(-0.5, 6, 3)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xfff1d0, 0.5)
    fill.position.set(3, -2, 4)
    scene.add(fill)
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50)
    camera.position.set(0, 0, 7)
    camera.lookAt(0, 0, 0)
    const geometry = new THREE.OctahedronGeometry(1, 0)
    geometry.scale(1.13, 1.16, 0.26)
    const gem = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: C.gold, metalness: 0.1, roughness: 0.6, flatShading: true }))
    scene.add(gem)
    const KEYS = [[121.6, 90], [122, 84], [123, 50], [124, 16], [125, 8], [127, 4], [129, -2], [131, -8], [133, -14], [134, -36], [135, -50], [136, -68], [137, -84], [137.6, -90]]
    const angle = (f) => {
      if (f <= KEYS[0][0]) return KEYS[0][1]
      for (let i = 0; i < KEYS.length - 1; i++) {
        const [f0, v0] = KEYS[i], [f1, v1] = KEYS[i + 1]
        if (f <= f1) return v0 + ((v1 - v0) * (f - f0)) / (f1 - f0)
      }
      return KEYS[KEYS.length - 1][1]
    }
    const acc = document.createElement('canvas')
    acc.width = acc.height = 512
    const ctx = acc.getContext('2d')
    const SUB = 16
    for (let k = 0; k <= 40; k++) {
      ctx.clearRect(0, 0, 512, 512)
      for (let s = 0; s < SUB; s++) {
        // 60 kare/sn'lik kare = 0.4 referans karesi. Pozlama referanstaki gibi bir referans karesi (24 kare/sn, tam pozlama):
        // dönerken taş eşkenar dörtgen değil, referanstaki gibi yanları bulanık altıgen görünür
        const f = 121.6 + k * 0.4 + (s / (SUB - 1) - 0.5) * 1.0
        gem.rotation.set(0.05, (angle(f) * Math.PI) / 180, 0)
        renderer.render(scene, camera)
        ctx.globalAlpha = 1 / (s + 1)
        ctx.drawImage(renderer.domElement, 0, 0)
      }
      ctx.globalAlpha = 1
      // Referansta taş hızlı dönerken yatay sürüklenir (24 kare/sn, tam pozlama): ince eşkenar dörtgen yanları dik bir altıgene
      // döner. Dönme hızıyla orantılı yatay sürükleme (derece / referans karesi × 1.2 px, 512 px tuvalde) + hafif yumuşaklık.
      // Açılar genişlikten ölçüldü; bulanık kenar ölçümü daralttığı için dönüş ortası referanstan biraz daha açık tutuldu.
      const f0 = 121.6 + k * 0.4
      const speed = Math.abs(angle(f0 + 0.5) - angle(f0 - 0.5))
      const smear = speed * 1.2
      const soft = document.createElement('canvas')
      soft.width = soft.height = 512
      const sctx = soft.getContext('2d')
      sctx.filter = 'blur(1.4px)'
      const STEPS = smear > 1 ? 11 : 1
      for (let j = 0; j < STEPS; j++) {
        sctx.globalAlpha = 1 / (j + 1)
        sctx.drawImage(acc, STEPS > 1 ? (j / (STEPS - 1) - 0.5) * 2 * smear : 0, 0)
      }
      sctx.globalAlpha = 1
      out['gem-' + String(k).padStart(2, '0')] = soft.toDataURL('image/webp', 0.92)
    }
  }
}

if (want('flat')) {
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }
  const load = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })
  await Promise.all([500, 600].map((w) => document.fonts.load(w + ' 100px Inter')))
  // yumuşak ışık lekesi
  {
    const [c, g] = canvas(512, 512)
    const r = g.createRadialGradient(256, 256, 0, 256, 256, 256)
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.72)'); r.addColorStop(0.7, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = r; g.fillRect(0, 0, 512, 512)
    out.blob = c.toDataURL('image/png')
  }
  // afiş gölgesi: bulanık yuvarlak köşeli dikdörtgen (afişin 1.25 katı tuval; beyaz, sahnede koyuya boyanır)
  {
    const [c, g] = canvas(600, 1120)
    g.filter = 'blur(34px)'
    g.fillStyle = '#fff'; g.beginPath(); g.roundRect(60, 60, 480, 1000, 30); g.fill()
    out['card-shadow'] = c.toDataURL('image/png')
  }
  const PW = 720, PH = 1344, PR = 30
  const clipRound = (g, w, h, r) => { g.beginPath(); g.roundRect(0, 0, w, h, r); g.clip() }
  // kart ışığı: afişin üstüne aynı boyda konur. Işık sağ üstten: sağ üst köşe hafif aydınlık, sol alt koyu; kenarlarda ince
  // parlak çizgi (kartın kalınlığına vuran ışık). Boyanmaz (beyaz ve siyah birlikte).
  {
    const [c, g] = canvas(PW, PH)
    clipRound(g, PW, PH, PR)
    const lin = g.createLinearGradient(PW, 0, 0, PH)
    lin.addColorStop(0, 'rgba(255,255,255,0.20)'); lin.addColorStop(0.35, 'rgba(255,255,255,0.04)'); lin.addColorStop(0.6, 'rgba(0,0,0,0.04)'); lin.addColorStop(1, 'rgba(0,0,0,0.28)')
    g.fillStyle = lin; g.fillRect(0, 0, PW, PH)
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 3
    g.beginPath(); g.roundRect(1.5, 1.5, PW - 3, PH - 3, PR); g.stroke()
    out['card-shade'] = c.toDataURL('image/png')
  }
  // kenar kararması: ortası saydam, köşeler koyu (sahnede kameranın önünde)
  {
    const [c, g] = canvas(1920, 1080)
    const r = g.createRadialGradient(960, 520, 300, 960, 540, 1150)
    r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(0.55, 'rgba(0,0,0,0.25)'); r.addColorStop(1, 'rgba(0,0,0,0.7)')
    g.fillStyle = r; g.fillRect(0, 0, 1920, 1080)
    out.vignette = c.toDataURL('image/png')
  }
  /** mavi zemin, sarı ve açık mavi yumuşak ışıklar (referans afişinin renk düzeni) */
  const gradient = (g, w, h, blobs) => {
    const lin = g.createLinearGradient(0, 0, w * 0.4, h)
    lin.addColorStop(0, C.blueDeep); lin.addColorStop(1, C.blueSoft)
    g.fillStyle = lin; g.fillRect(0, 0, w, h)
    g.filter = 'blur(' + Math.round(w * 0.11) + 'px)'
    for (const [x, y, rx, ry, color] of blobs) { g.fillStyle = color; g.beginPath(); g.ellipse(x * w, y * h, rx * w, ry * h, 0, 0, Math.PI * 2); g.fill() }
    g.filter = 'none'
  }
  {
    const [c, g] = canvas(PW, PH)
    clipRound(g, PW, PH, PR)
    gradient(g, PW, PH, [[0.85, 0.12, 0.42, 0.2, C.sand], [0.95, 0.02, 0.25, 0.12, '#F5DE96'], [0.3, 0.32, 0.3, 0.16, '#3346C6'], [0.8, 0.62, 0.3, 0.18, '#7E8FF0']])
    out['poster-grad'] = c.toDataURL('image/webp', 0.9)
  }
  {
    const [c, g] = canvas(PH, PW)
    clipRound(g, PH, PW, PR)
    gradient(g, PH, PW, [[0.75, 0.75, 0.3, 0.4, C.sand], [0.2, 0.3, 0.25, 0.4, '#7E8FF0']])
    out['poster-wide'] = c.toDataURL('image/webp', 0.9)
  }
  // Crystal şablonunun kapağı (9:16), afiş oranına ortadan kırpılır
  {
    const im = await load('/public/templates/posters/crystal.jpg')
    const [c, g] = canvas(PW, PH)
    clipRound(g, PW, PH, PR)
    const k = Math.max(PW / im.width, PH / im.height)
    g.drawImage(im, (PW - im.width * k) / 2, (PH - im.height * k) / 2, im.width * k, im.height * k)
    out['poster-crystal'] = c.toDataURL('image/webp', 0.9)
  }
  // sağ afiş (bizim tasarımımız): açık lavanta zemin, mavi hap, hapın üstünde kademeli üç satır, altta Mango logosu
  {
    const logo = await load('/public/brand/mango-logo-2048.png')
    const mark = await load('/public/brand/mango-mark.png')
    for (const [lang, lines] of Object.entries(${JSON.stringify({ en: [['Prompt', 'smarter'], ['edit', 'faster'], ['ship', 'better']], tr: [['daha', 'akıllı'], ['daha', 'hızlı'], ['daha', 'iyi']] })})) {
      const [c, g] = canvas(PW, PH)
      clipRound(g, PW, PH, PR)
      const bg = g.createLinearGradient(0, 0, 0, PH)
      bg.addColorStop(0, '#F5F7FD'); bg.addColorStop(1, '#C3CDEF')
      g.fillStyle = bg; g.fillRect(0, 0, PW, PH)
      g.filter = 'blur(80px)'; g.fillStyle = 'rgba(184,195,230,0.9)'; g.beginPath(); g.ellipse(620, 1100, 260, 300, 0, 0, Math.PI * 2); g.fill(); g.filter = 'none'
      g.fillStyle = C.blue; g.beginPath(); g.roundRect(150, 170, 420, 920, 210); g.fill()
      const k = 330 / 976
      g.drawImage(logo, 360 - 1024 * k, 840 - 907 * k, 2048 * k, 2048 * k)
      g.fillStyle = '#fff'; g.textBaseline = 'alphabetic'
      lines.forEach(([small, big], i) => {
        const y = 330 + i * 118
        const x = 150 + i * 42
        g.font = '500 34px Inter'; g.globalAlpha = 0.9; g.fillText(small, x, y - 58); g.globalAlpha = 1
        g.font = '600 118px Inter'; g.letterSpacing = '-5px'; g.fillText(big, x + g.measureText(small).width * 0 + 8, y + 26); g.letterSpacing = '0px'
      })
      g.drawImage(mark, 270, 1170, 52, 52)
      g.fillStyle = C.ink; g.font = '600 34px Inter'; g.fillText('mangostudio', 334, 1208)
      out['poster-pill-' + lang] = c.toDataURL('image/webp', 0.9)
    }
  }
}

if (want('metrics')) {
  await Promise.all([500, 600].map((w) => document.fonts.load(w + ' 100px Inter')))
  const ctx = document.createElement('canvas').getContext('2d')
  const em = (text) => [500, 600].map((w) => { ctx.font = w + ' 1000px Inter'; return Math.round(ctx.measureText(text).width * 10) / 1e4 })
  const m = {}
  for (const w of ${JSON.stringify([...new Set(WORDS), ' '])}) m[w] = em(w)
  out.__metrics = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(JSON.stringify(m))))
}

window.__out = out
`

// ---------------------------------------------------------------- tablet ekranları (HTML, zamana göre saf çizilir)
const SCREEN_COPY = {
  en: { s1: ['From', 'prompt', 'to <i>final video</i>'], s2: ['Prompt smarter', 'edit faster', 'ship <b>better.</b>'], s3: '“From prompt <i>to motion</i>”', site: 'mangostudio.design' },
  tr: { s1: ['İstemden', 'bitmiş', '<i>videoya</i>'], s2: ['Akıllı yaz', 'hızlı düzenle', '<b>iyi yayınla.</b>'], s3: '“İstemden <i>harekete</i>”', site: 'mangostudio.design' },
}
// karolarda yalnızca kapakların görsel kısımları görünsün (başka şablonların yazı parçaları değil): görsel + odak noktası (%)
// Gerçek marka logosu taşıyan kapaklar (fold-rock, icon-closeup-image) burada kullanılmaz.
const POSTERS = [['crystal', 50, 46], ['meadow-phone', 50, 40], ['icon-closeup', 45, 58], ['wallet-promo', 50, 42], ['crystal', 50, 62]]
const screenHtml = (lang) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; font-weight: 500; src: url(/src/assets/fonts/inter-500.woff); }
@font-face { font-family: Inter; font-weight: 600; src: url(/src/assets/fonts/inter-600.woff); }
@font-face { font-family: Serif; src: url(/src/assets/fonts/instrument-serif-400.woff); }
html, body { margin: 0; width: 1440px; height: 1080px; overflow: hidden; }
body { font-family: Inter, sans-serif; -webkit-font-smoothing: antialiased; color: ${C.ink}; }
.s { position: absolute; inset: 0; display: none; }
.s1 { background: ${C.screen}; }
.title { position: absolute; left: 110px; top: 470px; font: 500 86px/1.02 Inter; letter-spacing: -0.03em; }
.title i, .s3 i { font: italic 400 98px/1 Serif; letter-spacing: -0.01em; }
.mark { position: absolute; left: 112px; bottom: 120px; display: flex; align-items: center; gap: 14px; font: 600 30px Inter; letter-spacing: -0.02em; }
.mark img { width: 52px; height: 52px; }
.grid { position: absolute; inset: 0; overflow: hidden; }
.row { position: absolute; left: 0; height: 150px; width: 2400px; will-change: transform; }
.t { position: absolute; border-radius: 26px; background-size: cover; background-position: center; }
.s2 { background: linear-gradient(120deg, #EEF1FB 0%, #D3DAF3 55%, ${C.lavender} 100%); }
.s2 .title { top: 330px; font-size: 92px; line-height: 1.04; }
.s2 b { font-weight: 600; color: ${C.blue}; }
.pill { position: absolute; right: 150px; top: 120px; width: 380px; height: 840px; border-radius: 190px; background: ${C.blue}; display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
.pill img { width: 300px; margin-bottom: 160px; }
.s3 { background: radial-gradient(60% 70% at 88% 92%, ${C.yellow} 0%, rgba(232,207,22,0) 70%), radial-gradient(50% 60% at 15% 20%, ${C.blueSoft} 0%, rgba(91,111,230,0) 70%), linear-gradient(135deg, ${C.blueDeep} 0%, ${C.blue} 70%); color: #fff; }
.s3 .q { position: absolute; left: 0; right: 0; top: 470px; text-align: center; font: 500 92px Inter; letter-spacing: -0.03em; }
.s3 .site { position: absolute; left: 0; right: 0; top: 640px; text-align: center; font: 600 30px Inter; opacity: 0.9; }
</style></head><body>
<div class="s s1"><div class="title">${SCREEN_COPY[lang].s1.join('<br>')}</div><div class="mark"><img src="/public/brand/mango-mark.png">mangostudio</div><div class="grid" id="grid"></div></div>
<div class="s s2"><div class="title">${SCREEN_COPY[lang].s2.join('<br>')}</div><div class="mark"><img src="/public/brand/mango-mark.png">mangostudio</div><div class="pill"><img src="/public/brand/mango-logo-2048.png"></div></div>
<div class="s s3"><div class="q">${SCREEN_COPY[lang].s3}</div><div class="site">${SCREEN_COPY[lang].site}</div></div>
<script>
// karolar: renkli biçimler ve şablon kapaklarından kırpılmış görseller; zamanla sola kayar, görseller kendi içinde kayar
const P = ${JSON.stringify(POSTERS)}
// Pencerelerin gösterdiği tek fotoğraf (referanstaki gibi): Meadow şablonunun kendi katmanlarından (gökyüzü, bulutlar,
// çayır, çiçekler) kurulan manzara, karo bölgesini kaplar (ekran px). Üst satırlarda gökyüzü, alttakilerde çayır görünür.
const PHOTO = { src: '', x: 400, y: 100, w: 1100, h: 960 }
const loadImg = (n) => new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = fail; im.src = '/public/templates/meadow/' + n + '.png' })
window.ready = (async () => {
  const c = document.createElement('canvas'); c.width = PHOTO.w; c.height = PHOTO.h
  const g = c.getContext('2d')
  const sky = g.createLinearGradient(0, 0, 0, 640)
  sky.addColorStop(0, '#1b6fd6'); sky.addColorStop(0.5, '#62a6ec'); sky.addColorStop(1, '#bfe2f7')
  g.fillStyle = sky; g.fillRect(0, 0, PHOTO.w, PHOTO.h)
  // [görsel, x, y, genişlik]
  const parts = [['cloud-1', -120, 30, 900], ['cloud-3', 500, 130, 760], ['cloud-2', 60, 320, 640], ['cloud-4', 680, 400, 540],
    ['meadow-far', -150, 560, 1400], ['grass-band', -200, 690, 1500], ['dandelion', 520, 640, 70], ['daisy', 170, 660, 80], ['daisy-2', 840, 700, 70], ['daisy-near', 380, 760, 110]]
  for (const [n, x, y, w] of parts) { const im = await loadImg(n); g.drawImage(im, x, y, w, (w * im.height) / im.width) }
  PHOTO.src = c.toDataURL('image/jpeg', 0.92)
  for (const { d, t } of rows.flatMap((r) => r.tiles)) if (t.img !== undefined) d.style.backgroundImage = 'url(' + PHOTO.src + ')'
  return true
})()
// Karolar dört satırda; satırlar dönüşümlü yönde kayar (1. ve 3. sağa, 2. ve 4. sola). Referansın tablet ekranından
// kare kare ölçüldü: sahne başında hızlı (2. satır ~17 ekran px / referans karesi), yavaşlayarak durur; toplam kayma
// satır başına 140–186 ekran px. Kenardaki karolar kayarken ekrana girer. Fotoğraf pencerelerinin içi hafifçe ters yönde kayar.
const ROWS = [
  { y: 150, h: 130, dist: 140, tiles: [{ x: 520, w: 180, c: '${C.blue}' }, { x: 745, w: 130, c: '${C.blue}', r: 65 }, { x: 905, w: 250, img: 0 }, { x: 1205, w: 300, c: '${C.blue}', r: 65 }, { x: 1560, w: 220, c: '${C.yellow}', r: 65 }] },
  { y: 380, h: 130, dist: -186, tiles: [{ x: 690, w: 250, c: '${C.yellow}', r: 65 }, { x: 990, w: 470, img: 1, r: 65 }, { x: 1500, w: 200, c: '${C.blue}' }, { x: 1740, w: 260, img: 2, r: 65 }] },
  { y: 610, h: 130, dist: 157, tiles: [{ x: 690, w: 130, c: '${C.blue}' }, { x: 870, w: 260, img: 3, r: 65 }, { x: 1190, w: 330, c: '${C.yellow}' }] },
  { y: 840, h: 140, dist: -186, tiles: [{ x: 640, w: 560, img: 4, r: 70 }, { x: 1250, w: 160, img: 0 }, { x: 1460, w: 240, c: '${C.yellow}', r: 70 }, { x: 1740, w: 200, c: '${C.blue}' }] },
]
const grid = document.getElementById('grid')
const rows = ROWS.map((row) => {
  const el = document.createElement('div')
  el.className = 'row'
  el.style.top = row.y + 'px'
  el.style.height = row.h + 'px'
  const tiles = row.tiles.map((t) => {
    const d = document.createElement('div')
    d.className = 't'
    Object.assign(d.style, { left: t.x + 'px', top: '0px', width: t.w + 'px', height: row.h + 'px', borderRadius: (t.r ?? 24) + 'px', background: t.c ?? '' })
    if (t.img !== undefined) { d.style.backgroundSize = PHOTO.w + 'px ' + PHOTO.h + 'px'; d.style.backgroundRepeat = 'no-repeat' }
    el.appendChild(d)
    return { d, t }
  })
  grid.appendChild(el)
  return { el, row, tiles }
})
/** sahne başında hızlı, yavaşlayarak duran kayma (referanstaki hız eğrisi: ~doğrusal azalan hız) */
// Pencereler tek bir sabit fotoğrafa açılır (referanstaki gibi): fotoğraf ekranda yerinde durur, karo kaydıkça içinden
// fotoğrafın başka yeri görünür. Arka plan konumu karonun ekrandaki yerinin tersi.
const glide = (p) => 1 - Math.pow(1 - p, 1.8)
window.draw = (state, p) => {
  for (const s of document.querySelectorAll('.s')) s.style.display = 'none'
  document.querySelector('.s' + state).style.display = 'block'
  if (state === 1) {
    const k = glide(p)
    for (const { el, row, tiles } of rows) {
      el.style.transform = 'translateX(' + (row.dist * k).toFixed(2) + 'px)'
      for (const { d, t } of tiles) if (t.img !== undefined) d.style.backgroundPosition = (PHOTO.x - (t.x + row.dist * k)).toFixed(2) + 'px ' + (PHOTO.y - row.y) + 'px'
    }
  }
}
</script></body></html>`

// ---------------------------------------------------------------- yerel sunucu + başsız Chrome
const TYPES = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff': 'font/woff' }
const pageHtml = `<!doctype html><html><head><meta charset="utf-8">
<style>@font-face { font-family: Inter; font-weight: 500; src: url(/src/assets/fonts/inter-500.woff); } @font-face { font-family: Inter; font-weight: 600; src: url(/src/assets/fonts/inter-600.woff); }</style>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script></head>
<body><script type="module" src="/__page.js"></script></body></html>`
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  if (url === '/') return void res.writeHead(200, { 'content-type': 'text/html' }).end(pageHtml)
  if (url === '/__page.js') return void res.writeHead(200, { 'content-type': 'text/javascript' }).end(PAGE_JS)
  const m = /^\/__screen-(en|tr)$/.exec(url)
  if (m) return void res.writeHead(200, { 'content-type': 'text/html' }).end(screenHtml(m[1]))
  const file = path.join(ROOT, url)
  if (!file.startsWith(ROOT)) return void res.writeHead(403).end()
  fs.readFile(file, (err, data) => (err ? res.writeHead(404).end() : res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' }).end(data)))
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hidden-gem-'))
const chrome = spawn(CHROME, ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1440,1080', `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(TMP, 'profile')}`, 'about:blank'])
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
let target
for (let i = 0; i < 60 && !target; i++) {
  await sleep(250)
  try {
    target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page')
  } catch {
    // Chrome henüz dinlemiyor
  }
}
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => (ws.onopen = resolve))
let seq = 0
const pending = new Map()
const errors = []
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg)
    pending.delete(msg.id)
  }
  if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails?.exception?.description ?? 'sayfa hatası')
}
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value

try {
  await send('Runtime.enable')
  await send('Page.enable')
  // pencere boyu tarayıcı çubukları yüzünden 1080'den kısa kalıyordu: ekranın altı beyaz çıkıyordu
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1080, deviceScaleFactor: 1, mobile: false })
  fs.mkdirSync(OUT, { recursive: true })
  if (want('three') || only === 'gem' || want('flat') || want('metrics')) {
    await send('Page.navigate', { url: `${base}/` })
    let names = null
    for (let i = 0; i < 600 && !names && !errors.length; i++) {
      await sleep(500)
      names = await evaluate('window.__out ? Object.keys(window.__out) : null')
    }
    if (!names) throw new Error(`görseller çizilemedi: ${errors.join(' | ') || 'zaman aşımı'}`)
    for (const name of names) {
      const url = await evaluate(`window.__out[${JSON.stringify(name)}]`)
      const data = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
      if (name === '__metrics') {
        const metrics = JSON.parse(data.toString('utf8'))
        const lines = Object.entries(metrics).map(([w, v]) => `  ${JSON.stringify(w)}: [${v.join(', ')}],`).join('\n')
        fs.writeFileSync('src/project/hiddenGemMetrics.ts', `// node scripts/build-hidden-gem-assets.mjs metrics ile üretilir; elle düzenleme.\n// Kelime ilerleme genişlikleri (em): [Inter 500, Inter 600]\nexport const GEM_EM: Record<string, [number, number]> = {\n${lines}\n}\n`)
        console.log('metrics', Object.keys(metrics).length)
        continue
      }
      const ext = url.slice(11, url.indexOf(';')).replace('jpeg', 'jpg')
      fs.writeFileSync(`${OUT}/${name}.${ext}`, data)
    }
    console.log('görseller', names.length)
  }
  if (want('screens')) {
    const FRAMES = 60 // 1 sn, 60 kare/sn: referansın 226–249. kareleri (24 kare/sn), karolar satır satır kayar
    for (const lang of ['en', 'tr']) {
      await send('Page.navigate', { url: `${base}/__screen-${lang}` })
      await sleep(1500)
      await evaluate('document.fonts.ready.then(() => window.ready)')
      const dir = path.join(TMP, `screen-${lang}`)
      fs.mkdirSync(dir)
      for (let f = 0; f < FRAMES; f++) {
        await evaluate(`window.draw(1, ${f / (FRAMES - 1)})`)
        const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1440, height: 1080, scale: 1 } })
        fs.writeFileSync(path.join(dir, `f${String(f).padStart(3, '0')}.png`), Buffer.from(shot.result.data, 'base64'))
      }
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', '60', '-i', path.join(dir, 'f%03d.png'), '-c:v', 'libx264', '-crf', '18', '-g', '10', '-pix_fmt', 'yuv420p', `${OUT}/screen-1-${lang}.mp4`])
      for (const state of [2, 3]) {
        await evaluate(`window.draw(${state}, 0)`)
        const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 1440, height: 1080, scale: 1 } })
        fs.writeFileSync(`${OUT}/screen-${state}-${lang}.jpg`, Buffer.from(shot.result.data, 'base64'))
      }
      console.log('ekranlar', lang)
    }
  }
} finally {
  ws.close()
  chrome.kill()
  server.close()
  await sleep(500)
  fs.rmSync(TMP, { recursive: true, force: true })
}
