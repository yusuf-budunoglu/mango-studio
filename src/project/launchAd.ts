import i18n from '../i18n'
import { preciseCubicBezier } from '../engine/easing'
import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { LAUNCH_EM } from './launchAdMetrics'

// "Launch ad": yatay (1920×1080, 60 kare/sn, 33 sn) Mango Studio tanıtımı. Temposu ve hareket dili bir SaaS ürün
// tanıtımı referansından (1920×1080, 30 kare/sn, 991 kare) kare kare ölçüldü; kare numaraları referansın kareleri
// (`F(n)` saniyeye çevirir), ölçüler 1920×1080 pikseli. Kopya değil: hikâye, metinler, arayüz, görseller ve renkler
// Mango Studio'nun (aydınlık zemin, mango turuncusu).
// Sahneler (kesmeler 33, 66, 135, 172, 300, 436, 472, 546, 606, 665, 735, 858):
//  1 "Turn ideas" kelime kelime            2 dev "Motion" yakından oturur, küçülür   3 "Any style ▣ Instantly" + imleç
//  4 3D klasör panele bırakılır, dalgalar  5 "Just prompt and go"                    6 telefon tüneli + "Text. Shapes. Devices."
//  7 telefondan akan sıvı çubuğa dönüşür   8 ilerleme çubuğu 0 → 100                 9 "Rendered" + onay + konfeti
// 10 şablon kartları şeridi               11 Studio arayüzü, kart seçilir            12 kart dönüp çoğalır + "Every format"
// 13 liste görünümü                       14 satır → "Export in 4K" düğmesi, tık     15 düğme yıldıza dönüşür
// 16 yıldız seke seke "Prompt. Edit. Export" yazdırır                                17 Mango logosu, mangostudio.design
// Görseller ve kelime genişlikleri: node scripts/build-launch-ad-assets.mjs (public/templates/launch-ad).
// Ses: dört efekt grubu ayrı ses parçası (public/templates/launch-ad/sfx/*.mp3; Desktop/launch-ad-sfx projesinden,
// `npx remotion render LaunchAd out/stems/<grup>.mp3 --config=remotion.audio.config.ts --props=...`). Konuşma ve müzik yok.

type BlockSpec = Omit<Block, 'id'>
type Bezier = [number, number, number, number]
type LayerSpec = Omit<Layer, 'id' | 'blocks' | 'rotation' | 'scale' | 'opacity' | 'start' | 'duration'> &
  Partial<Pick<Layer, 'rotation' | 'scale' | 'opacity'>> & { blocks: BlockSpec[] }
interface Kit {
  t: (key: string, options?: Record<string, unknown>) => string
  b: (preset: string, start: number, duration: number, extra?: Partial<BlockSpec>) => BlockSpec
  layer: (spec: LayerSpec) => Layer
  camera: (blocks: BlockSpec[], position?: CameraTrack['position']) => CameraTrack
  project: (name: string, duration: number, background: string, layers: Layer[], cam: CameraTrack) => Project
}

const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / 1080
const P = (x: number, y: number, z = 0): Vec3 => [(x - 960) * U, (540 - y) * U, z]
const sc = (widthPx: number) => (widthPx * U) / 3
/** referans karesi (30 kare/sn) → saniye; mikro saniyeye yuvarlanır (fitClip kenarları da öyle) */
const F = (n: number) => Math.round((n / 30) * 1e6) / 1e6
const END = F(991)
const DEG = Math.PI / 180
/** z derinliğindeki katmanın, z = 0'daki gibi görünmesi için ölçek ve konum çarpanı (kamera z = 9) */
const depth = (z: number) => (9 - z) / 9

const FONT = 'inter-medium'
const SPACE = LAUNCH_EM[' ']?.[0] ?? 0.25
const em = (word: string) => LAUNCH_EM[word]?.[0] ?? word.length * 0.56

// Renkler: hepsi katman rengi, editörden değişir
const BG = '#F2F0EC'
const INK = '#17130F'
const DIM = '#A8A096'
const ORANGE = '#FF7A00'
const TANG = '#FF5A1F'
const GOLD = '#FFB21E'
const LEAF = '#46A83F'
const RED = '#E2361B'

// Ölçülen eğriler: kelime girişi (8 karede oturur), yakından oturma (hızlı başlar), hızlanarak çıkış
const SETTLE: Bezier = [0.16, 0.84, 0.3, 1]
const EASE_IN: Bezier = [0.6, 0, 0.9, 0.5]
const GLIDE: Bezier = [0.3, 0, 0.2, 1]
/** çubuk görselinde hap kalınlığı (build-launch-ad-assets.mjs BAR_H) */
const BAR_H = 130

// --- 3×3 dönme matrisleri (satır sıralı); three.js'in XYZ Euler açılarına çevrilir
type M3 = number[]
const rotX = (d: number): M3 => { const [c, s] = [Math.cos(d * DEG), Math.sin(d * DEG)]; return [1, 0, 0, 0, c, -s, 0, s, c] }
const rotY = (d: number): M3 => { const [c, s] = [Math.cos(d * DEG), Math.sin(d * DEG)]; return [c, 0, s, 0, 1, 0, -s, 0, c] }
const rotZ = (d: number): M3 => { const [c, s] = [Math.cos(d * DEG), Math.sin(d * DEG)]; return [c, -s, 0, s, c, 0, 0, 0, 1] }
const mul = (a: M3, b: M3): M3 => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]))
const euler = (m: M3): Vec3 => {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])))
  return Math.abs(m[2]) < 0.99999 ? [Math.atan2(-m[5], m[8]) / DEG, y / DEG, Math.atan2(-m[1], m[0]) / DEG] : [Math.atan2(m[7], m[4]) / DEG, y / DEG, 0]
}
/** açı farkı (−180, 180] aralığında: Euler açıları 360° sarınca katman ters yönden dönmesin */
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180
const lerp = (a: number, b: number, p: number) => a + (b - a) * p

export function buildLaunchAd({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/launch-ad/${name}.png`
  const lang: 'en' | 'tr' = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.launch-ad.${key}`)

  type MoveP = { dx?: number; dy?: number; dz?: number; rotate?: number; rotX?: number; rotY?: number; scaleBy?: number }
  const move = (from: number, to: number, p: MoveP, easing: string | Bezier = 'ease-in-out') => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, dz: p.dz ?? 0, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, rotY: p.rotY ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', F(from), F(to - from), { params, easing }) : b('move', F(from), F(to - from), { params, easing: 'custom', bezier: easing })
  }
  /** sahne biriminde hareket (3D nesneler) */
  const move3 = (from: number, to: number, params: Record<string, number>, easing: string | Bezier = 'linear') =>
    typeof easing === 'string' ? b('move', F(from), F(to - from), { params: { dx: 0, ...params }, easing }) : b('move', F(from), F(to - from), { params: { dx: 0, ...params }, easing: 'custom', bezier: easing })
  const cut = (from: number, to: number) => [b('fade-in', F(from), 0), b('fade-out', F(to), 0)]
  const fadeIn = (from: number, frames: number) => b('fade-in', F(from), F(frames), { easing: 'ease-out' })
  const fadeOut = (from: number, frames: number) => b('fade-out', F(from), F(frames), { easing: 'ease-in' })
  const pop = (from: number, frames = 8) => b('pop', F(from), F(frames))
  const text = (name: string, value: string, x: number, y: number, size: number, color: string, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    // troika metni satır kutusunun ortasına hizalar: mürekkep ortası için 0.15 em aşağı
    layer({ name, kind: 'text', text: value, fontFamily: FONT, fontWeight: 400, fontSize: size * U, textWidth: 40, align: 'left', color, position: P(x, y + 0.15 * size, 0.02), blocks, ...extra })
  const image = (name: string, file: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: P(x, y, z), scale: sc(widthPx), blocks, ...extra })
  /** beyaz çizilmiş görsel, katman rengiyle boyanır */
  const tinted = (name: string, file: string, color: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    image(name, file, x, y, z, widthPx, blocks, { tint: true, color, ...extra })
  /** Kelimeleri ortalı dizer: her kelimenin sol kenarı ve genişliği (px) */
  const lineUp = (words: string[], size: number, cx = 960, gaps: number[] = []) => {
    const widths = words.map((w) => em(w) * size)
    const gap = (i: number) => gaps[i] ?? SPACE * size
    const total = widths.reduce((a, w) => a + w, 0) + widths.slice(1).reduce((a, _w, i) => a + gap(i), 0)
    let x = cx - total / 2
    return widths.map((w, i) => { const left = x; x += w + gap(i); return { left, width: w, right: left + w } })
  }
  /** kelime: `at` karesinde `dy` px aşağıdan yükselerek belirir (referans: 8 karede oturur) */
  const riseIn = (at: number, dy = 35) => [fadeIn(at, 3), move(at, at + 8, { dy: -dy }, SETTLE)]
  /** katmanı (x, y) konumundayken (cx, cy) noktasına göre `factor` katına getirir (kamerayı oynatmadan büyütme/küçültme) */
  const about = (from: number, to: number, x: number, y: number, factor: number, easing: Bezier | string, cx = 960, cy = 540) =>
    move(from, to, { dx: (x - cx) * (factor - 1), dy: (y - cy) * (factor - 1), scaleBy: factor }, easing)
  // imleç görseli (saas-ad/cursor: 120 css, ucu (14, 10)): genişliği w iken merkez uçtan (0.383w, 0.417w) uzakta.
  // z = 1'de durur (yatık panel ve klasörün önünde); boyutu ve konumu derinliğe göre düzeltilir.
  const CZ = 1
  const cursor = (tipX: number, tipY: number, w: number, blocks: BlockSpec[], z = CZ) => {
    const [cx, cy] = [tipX + 0.383 * w, tipY + 0.417 * w]
    return layer({ name: t('layerNames.cursor'), kind: 'image', color: '#ffffff', image: `${base}templates/saas-ad/cursor.png`, position: P(960 + (cx - 960) * depth(z), 540 + (cy - 540) * depth(z), z), scale: sc(w) * depth(z), blocks })
  }
  /** imleç hareketi (px, z = 0 düzlemindeki görünen kayma) */
  const cmove = (from: number, to: number, dx: number, dy: number, easing: string | Bezier, z = CZ) => move(from, to, { dx: dx * depth(z), dy: dy * depth(z) }, easing)
  const press = (at: number) => [move(at, at + 2, { scaleBy: 0.78 }, 'ease-out'), move(at + 4, at + 8, { scaleBy: 1 / 0.78 }, 'ease-out')]

  // --- kamera: mutlak hedef (px, ölçek); kesmelerde ortaya ve 1 kata döner
  const cam = { x: 960, y: 540, s: 1 }
  const camBlocks: BlockSpec[] = []
  const camTo = (from: number, to: number, target: { x?: number; y?: number; s?: number }, easing: string | Bezier = 'linear') => {
    const dx = (target.x ?? cam.x) - cam.x
    const dy = (target.y ?? cam.y) - cam.y
    const zoom = (target.s ?? cam.s) / cam.s
    Object.assign(cam, target)
    const params = { dx: dx * U, dy: -dy * U, zoom }
    camBlocks.push(typeof easing === 'string' ? b('camera-move', F(from), F(to - from), { params, easing }) : b('camera-move', F(from), F(to - from), { params, easing: 'custom', bezier: easing }))
  }
  const reset = (at: number, s = 1) => camTo(at, at, { x: 960, y: 540, s })

  const layers: Layer[] = []
  const add = (...ls: Layer[]) => layers.unshift(...ls) // sonra eklenen önde

  // ===== 1) 0–33: "Turn ideas" — kelimeler yükselerek gelir, satır yavaşça küçülür, sonra hızlanıp kaybolur
  const S1 = 108
  const w1 = k('line1').split(' ')
  lineUp(w1, S1).forEach((p, i) => {
    // referansta ikinci kelime 9. karede yerinde ve görünür: bir kare erken başlar
    const at = i === 0 ? -3 : 8
    add(text(`${k('title')} 1.${i + 1}`, w1[i], p.left, 540 + 35, S1, i === 0 ? ORANGE : INK, [...cut(Math.max(at, 0), 33), ...riseIn(at), fadeOut(25, 8)]))
  })
  camTo(0, 0, { s: 1.14 })
  camTo(0, 22, { s: 1 }, 'ease-out')
  camTo(22, 33, { s: 0.5 }, EASE_IN)

  // ===== 2) 33–66: dev kelime yakından gelip oturur (8 karede 1.3 → 1), sonra durmadan küçülür (62'de ~0.67) ve söner
  const S2 = 210
  const big = k('big')
  add(text(`${k('title')} 2`, big, 960 - (em(big) * S2) / 2, 540, S2, ORANGE, [...cut(33, 66), fadeOut(57, 9)]))
  reset(33, 1.3)
  camTo(33, 41, { s: 1 }, SETTLE)
  camTo(41, 57, { s: 0.8 })
  camTo(57, 66, { s: 0.55 }, EASE_IN)

  // ===== 3) 66–135: "Any" → "Any style" → "Any style ▣ Instantly"; imleç klasörü tutar
  const S3 = 96
  const FOLDER = 300 // klasör gövdesinin görünen genişliği (görsel 520 px'te gövde 340 px)
  const w3 = [k('any'), k('style'), k('instantly')]
  const pair = lineUp(w3.slice(0, 2), S3)
  const full = lineUp(w3, S3, 960, [SPACE * S3, FOLDER + 130])
  const soloLeft = 960 - (em(w3[0]) * S3) / 2
  const tileX = (full[1].right + full[2].left) / 2
  const out3 = fadeOut(127, 8)
  add(text(`${k('title')} 3.1`, w3[0], soloLeft, 540, S3, ORANGE, [...cut(66, 136), move(74, 80, { dx: pair[0].left - soloLeft }, GLIDE), move(94, 101, { dx: full[0].left - pair[0].left }, SETTLE), out3]))
  add(text(`${k('title')} 3.2`, w3[1], pair[1].left, 540 + 35, S3, INK, [...cut(80, 136), ...riseIn(80), move(94, 101, { dx: full[1].left - pair[1].left }, SETTLE), out3]))
  add(text(`${k('title')} 3.3`, w3[2], full[2].left + 70, 540, S3, TANG, [...cut(96, 136), fadeIn(96, 5), move(96, 104, { dx: -70 }, SETTLE), out3]))

  // ===== 4) 135–173: klasör büyür, arkasında panel ince bir şeritten açılır, klasör küçülerek panelin içine girer,
  // bıraktığı yerden yumuşak levhalar dalga dalga büyür. (Panel listede klasörden önce: arkada kalmalı.)
  const PANEL = { y0: 335, y1: 640, w: (1440 * 1900) / 1580, tilt: -48 }
  const panelOut = [move(167, 174, { dy: -90, scaleBy: 0.88 }, EASE_IN), fadeOut(167, 6)]
  add(image(k('panel'), 'panel', 960, PANEL.y0, -0.05, PANEL.w, [
    ...cut(141, 174), fadeIn(141, 3), move(141, 152, { dy: PANEL.y1 - PANEL.y0, rotX: 88 + PANEL.tilt }, [0.2, 0.7, 0.3, 1]), move(152, 167, { dy: -10 }, 'linear'), ...panelOut,
  ], { rotation: [-88, 0, 0] }))
  // Dalgalar: küçüğü önde, arkasında daha büyükleri belirir (levha 560×400, görsel 900 px). Hepsi panelin bırakma
  // alanının (kesik çizgili bölge) İÇİNDE kalır: en büyüğü alanın yüksekliğinden küçüktür ve alanın ortasındadır, altındaki
  // zaman çizelgesi şeritlerine taşmaz. Alanın ortası panelin ortasından 91 px yukarıda (panel düzleminde): yatık
  // panelde bu, ekranda ~61 px yukarı ve derinlikte ~0.41 birim geride demek. Levhalar panelle aynı açıda, hemen önünde.
  const ZONE = { up: 91 * Math.cos(-PANEL.tilt * DEG), back: 91 * U * Math.sin(-PANEL.tilt * DEG) }
  const DROP_Y = PANEL.y1 - ZONE.up - 8
  ;[0, 1, 2].forEach((i) => {
    const at = 154 + i * 4
    const w = ((300 + i * 180) * 900) / 560 // levhalar 300 / 480 / 660 px geniş (alan ~1350 × 530 px)
    add(image(`${k('pulse')} ${i + 1}`, 'ripple', 960, DROP_Y, -0.05 - ZONE.back + 0.16 - i * 0.045, w * 0.5, [
      // yumuşak: uzun, yavaşlayan büyüme ve uzun belirme
      ...cut(at, 174), fadeIn(at, 8), move(at, at + 18, { scaleBy: 2 }, [0.2, 0.7, 0.2, 1]), ...panelOut,
    ], { rotation: [PANEL.tilt, 0, 0] }))
  })
  // 3D klasör: gölge, arka kapak, kâğıtlar ve ön cep ayrı katmanlar; aynı açıda, farklı derinlikte (dönünce paralaks).
  // Grup hareketleri her parçaya aynı uygulanır; ölçek değişince parçalar arasındaki derinlik farkı da ölçeklenir.
  const FZ = 3.2 // yatık panelin kameraya yaklaşan alt kenarından (z ≈ 2.5) daha önde
  const fRot: Vec3 = [7, -20, -5]
  const fM = mul(mul(rotX(fRot[0]), rotY(fRot[1])), rotZ(fRot[2]))
  const fW = ((520 * FOLDER) / 340) * depth(FZ)
  const parts: [string, number][] = [['folder-shadow', -0.06], ['folder-back', 0], ['folder-papers', 0.16], ['folder-front', 0.32]]
  // grup hareketleri: [başlangıç, bitiş, dx, dy (px, görünen), ölçek, eğri]
  const fx = (px: number) => px * depth(FZ)
  const steps: [number, number, number, number, number, Bezier | string][] = [
    [121, 124, 0, 0, 0.94, 'ease-out'],
    [126, 140, 960 - tileX, -70, 1.75 / 0.94, GLIDE],
    [140, 149, 0, -10, 0.93, 'linear'],
    [149, 154, 0, DROP_Y - 460, 0.2, [0.5, 0, 0.8, 0.6]],
  ]
  parts.forEach(([file, d], i) => {
    const off = [fM[2] * d, fM[5] * d, fM[8] * d]
    let s = 1
    const blocks: BlockSpec[] = [...cut(96, 155), pop(96, 9), fadeOut(151, 4)]
    for (const [from, to, dx, dy, by, ease] of steps) {
      blocks.push(move(from, to, { dx: fx(dx), dy: fx(dy), scaleBy: by }, ease))
      // parçanın gruba göre kayması da ölçekle büyür/küçülür
      blocks.push(move3(from, to, { dx: off[0] * s * (by - 1), dy: off[1] * s * (by - 1), dz: off[2] * s * (by - 1) }, ease))
      s *= by
    }
    const p = P(960 + fx(tileX - 960), 540, FZ)
    add(layer({ name: `${k('folder')} ${i + 1}`, kind: 'image', color: '#ffffff', image: img(file), position: [p[0] + off[0], p[1] + off[1], p[2] + off[2]], rotation: fRot, scale: sc(fW), blocks }))
  })
  const tipX = tileX + 96
  const tipY = 540 + 84
  const FC = 3.5
  add(cursor(tipX + 380, tipY + 340, 130, [
    ...cut(108, 162), fadeIn(108, 4), cmove(108, 120, -380, -340, SETTLE, FC), ...press(121),
    cmove(126, 140, 960 - tileX + 80, -30, GLIDE, FC), cmove(140, 149, -10, -14, 'linear', FC), cmove(149, 153, -60, 40, GLIDE, FC), cmove(153, 161, 240, -640, EASE_IN, FC), fadeOut(156, 5),
  ], FC))
  reset(66, 1.9)
  camTo(66, 78, { s: 1 }, SETTLE)
  camTo(78, 135, { s: 0.96 })
  reset(135)

  // ===== 5) 172–219: "Just prompt and go"; telefonlar girerken satır ortaya doğru küçülür (kamera sabit: tünel etkilenmesin)
  const S5 = 100
  const w5 = k('line5').split(' ')
  const at5 = [174, 180, 192, 197]
  const col5 = [ORANGE, TANG, INK, DIM]
  lineUp(w5, S5).forEach((p, i) => {
    const at = at5[i] ?? 197
    add(text(`${k('title')} 5.${i + 1}`, w5[i], p.left, 540 + 35, S5, col5[i] ?? INK, [...cut(at, 222), ...riseIn(at), about(200, 216, p.left, 540, 0.58, GLIDE), fadeOut(215, 6)]))
  })

  // ===== 6) 192–321: dört telefon, ekranları eksene bakan bir tünel kurar; tünel yavaşça döner ve yaklaşır.
  // Telefon gövdesi 1.7 × 3.5 birim (ölçek 1); uzun kenarı derinlik boyunca, üst ucu uzakta. Açılar matristen
  // hesaplanır (Rz(roll) · Rx(-90 + tilt)); Euler açılarını doğrudan karıştırmak telefonu takla attırıyordu.
  const PH = 3.0
  const Z0 = 2.2
  const TILT = 9
  const ROLL0 = -8
  const wallRot = (roll: number) => euler(mul(rotZ(roll), rotX(-90 + TILT)))
  const walls: { roll: number; d: number; screen: string; enter: number }[] = [
    { roll: 0, d: 2.9, screen: 'screen-gallery', enter: 192 }, // alt
    { roll: 270, d: 5.3, screen: 'screen-text', enter: 197 }, // sol
    { roll: 90, d: 5.3, screen: 'screen-vertical', enter: 204 }, // sağ
    { roll: 180, d: 2.9, screen: 'screen-prompt', enter: 209 }, // üst
  ]
  const wallPos = (roll: number, d: number): [number, number] => [d * Math.sin(roll * DEG), -d * Math.cos(roll * DEG)]
  const turn = (a: Vec3, c: Vec3) => ({ rotX: wrap(c[0] - a[0]), rotY: wrap(c[1] - a[1]), rotate: wrap(c[2] - a[2]) })
  // Sıvının çıktığı uç = alttaki telefonun üst kenarı (px). Düzgün bir eğri (yavaş başlar, hızlanır); telefon ve
  // yelpaze her karede buradan örneklenir. Seyrek noktalar arasında düz gitmek hız sıçraması (takılma) yapıyordu.
  const LIQUID_Y = 600
  const spoutAt = (f: number) => { const d = Math.max(0, f - 304); return 1010 - 26.3 * d - 3.22 * d * d }
  const unit = (v: number) => Math.max(0, Math.min(1, v))
  const phoneLayers: Layer[] = []
  walls.forEach((w, i) => {
    const r0 = w.roll + ROLL0 - 26 // girişte tünel 26° geriden döner
    const r1 = w.roll + ROLL0
    const r2 = r1 + 11
    const [e0, e1, e2] = [wallRot(r0), wallRot(r1), wallRot(r2)]
    const [p0, p1, p2] = [wallPos(r0, w.d * 2.1), wallPos(r1, w.d), wallPos(r2, w.d)]
    const blocks: BlockSpec[] = [
      ...cut(w.enter, i === 0 ? 322 : 300),
      move3(w.enter, w.enter + 24, { dx: p1[0] - p0[0], dy: p1[1] - p0[1], dz: -5, ...turn(e0, e1) }, SETTLE),
      move3(w.enter + 20, 290, { dx: p2[0] - p1[0], dy: p2[1] - p1[1], dz: 0.9, ...turn(e1, e2) }, 'linear'),
    ]
    if (i === 0) {
      // Alttaki telefon kalır: yatık halden, üst kenarı sağa bakan yatay duruşa döner (Rz(roll) · Rx(eğim)) ve sola
      // kayarak çıkar. Üst kenarı her karede `spoutAt`'te, merkezi sıvının hizasında. Yana dönmez: dönünce sağ ucu
      // sıvının düzleminin arkasına geçiyor, sıvı telefonun önünde görünüyordu. Yol her karede örneklenir (takılmasın).
      const LAND_Z = 1.5
      const near = 9 / (9 - LAND_Z)
      const halfLen = ((3.5 * PH) / 2 / U) * near // yatay telefonun yarı boyu (px, görünen)
      const from = [p2[0], p2[1], Z0 + 0.9]
      const land = (f: number) => [((spoutAt(f) - halfLen - 960) * U) / near, (-(LIQUID_Y - 540) * U) / near, LAND_Z]
      const ease = preciseCubicBezier(0.4, 0, 0.3, 1)
      const posAt = (f: number) => { const w = ease(unit((f - 292) / 14)); const l = land(f); return from.map((v, n) => lerp(v, l[n], w)) }
      const rotAt = (f: number) => euler(mul(rotZ(lerp(r2, -90, ease(unit((f - 292) / 16)))), rotX(lerp(-90 + TILT, -20, ease(unit((f - 292) / 16))))))
      for (let f = 292; f < 322; f += 2) {
        const [a, c] = [posAt(f), posAt(f + 2)]
        blocks.push(move3(f, f + 2, { dx: c[0] - a[0], dy: c[1] - a[1], dz: c[2] - a[2], ...turn(rotAt(f), rotAt(f + 2)) }))
      }
    } else {
      // diğer üçü dışarı açılır
      blocks.push(move3(289, 299, { dx: p2[0] * 1.3, dy: p2[1] * 1.3, dz: 3.5 }, EASE_IN))
    }
    phoneLayers.push(layer({ name: `${t('layerNames.phone')} ${i + 1}`, kind: 'phone', color: ORANGE, image: img(w.screen), deviceFinish: 'silver', position: [p0[0], p0[1], Z0 + 5], rotation: e0, scale: PH, blocks }))
  })
  add(...phoneLayers.slice(1))
  const S6 = 52
  const w6 = [k('kind1'), k('kind2'), k('kind3')]
  const at6 = [220, 236, 246]
  lineUp(w6, S6, 960, [SPACE * S6 * 1.6, SPACE * S6 * 1.6]).forEach((p, i) => {
    add(text(`${k('title')} 6.${i + 1}`, w6[i], p.left, 540 + 20, S6, [ORANGE, TANG, INK][i], [...cut(at6[i], 263), ...riseIn(at6[i], 20), fadeOut(258, 5)]))
  })
  // "One motion studio" büyük gelip oturur (1.5 → 1), sonda tünelle birlikte büyüyerek söner
  const S6b = 70
  const w6b = k('line6').split(' ')
  lineUp(w6b, S6b).forEach((p, i) => {
    const big0 = 960 + (p.left - 960) * 1.5
    add(text(`${k('title')} 6b.${i + 1}`, w6b[i], big0, 540, S6b, i === w6b.length - 1 ? ORANGE : INK, [
      ...cut(262, 298), about(262, 274, big0, 540, 1 / 1.5, SETTLE), about(289, 298, p.left, 540, 1.5, EASE_IN), fadeOut(290, 7),
    ], { scale: 1.5 }))
  })

  // ===== 7) 305–338: sıvı. Telefonun üst kenarının ARKASINDAN, o kenarla aynı boyda bir yelpaze çıkar (önce telefonun
  // arkasında saklıdır, sağa doğru açılır); ucundan çubuk sağa uzar. Sistem başta 2.7 kat (çubuk ~350 px kalın, referans
  // gibi); yelpaze telefonla birlikte sola çekilirken sistem 1 kata iner (çubuk 130 px). Yelpaze ve çubuk aynı renk ve
  // kalınlıkta: dikiş görünmez. Hepsi z ≈ 0'da, telefon z ≥ 0.6'da: sıvı hep telefonun arkasında.
  const BAR_Y = LIQUID_Y
  const END0 = 2200 // çubuğun sağ ucu sayaç başlarken kadraj dışında
  // 100'e varınca çubuğun ucu kadrajın ortasında durur ve orada kalır: hap daireye inerken yalnızca SOL uç yaklaşır.
  // Önceden 100'den sonra sağ uç da ortaya çekiliyordu; "bar geri gidiyor" gibi görünüyordu.
  const END1 = 1025
  const END2 = END1
  const LIQ = 2.7
  const barAt = (end: number) => end - 1160 // çubuk görselinde hapın sağ ucu merkezden 1160 px sağda
  const COUNT: Bezier = [0, 0.85, 0.2, 1]
  const barBig = END0 + (barAt(END0) - END0) * LIQ // 2.7 katta, ucu END0'da iken çubuğun merkezi
  const SHRINK: Bezier = [0.4, 0.25, 0.4, 1]
  // yelpaze (görsel 560 css: yelpaze soldan 60 px içeride başlar, 440 px uzun): sol kenarı telefonun üst kenarının
  // 150 px gerisinde (telefonun arkasında); 305–313 arası telefonun arkasından sağa doğru çıkar
  const FAN_W = 560 * LIQ
  const FAN_LEN = 440 * LIQ
  // Yelpaze 305'te tamamen telefonun arkasındadır (sağ ucu telefonun üst kenarında) ve YERİNDE durur: telefon sola
  // çekildikçe üstünden açılır, yani sıvı tam telefonun kenarında, büyüyerek ortaya çıkar. Önceki sürümde yelpaze önce
  // sağa kayıp sonra telefonla sola dönüyordu; yön değiştirdiği an takılma gibi görünüyordu. 316'dan sonra sıfır hızdan
  // hızlanarak sola çıkar.
  const FAN_X0 = spoutAt(305) - FAN_LEN
  const fanLeft = (f: number) => FAN_X0 - 8.3 * Math.max(0, f - 316) ** 2
  const fanCenter = (f: number) => fanLeft(f) + (280 - 60) * LIQ
  // Çubuğun ucu 305'te telefonun kenarında başlar ve durmadan hızlanarak 320'de END0'a varır (tek eğri)
  const tipAt = (f: number) => spoutAt(305) + (END0 - spoutAt(305)) * unit((f - 305) / 15) ** 1.6
  const TIP0 = tipAt(305)
  const tipFrames = [305, 307, 309, 311, 313, 315, 317, 319, 320]
  const barPath = [
    ...tipFrames.slice(1).map((f, n) => move(tipFrames[n], f, { dx: tipAt(f) - tipAt(tipFrames[n]) }, 'linear')),
    about(320, 338, barBig, BAR_Y, 1 / LIQ, SHRINK, END0, BAR_Y),
    move(335, 379, { dx: END1 - END0 }, COUNT),
  ]
  // Sıvı katmanları derinde durur (z ≈ -3): eğik duran telefonun üst ucu z = 0'ın gerisine uzanıyor, sıvı z ≈ 0'dayken
  // telefonun önünde görünüyordu. `behind`, kurulmuş bir katmanı görüntüsü değişmeden derine taşır: konum, ölçek ve px
  // hareketleri kadrajın ortasına göre depth(z) katına çıkar.
  const LZ = -3
  const behind = (l: Layer, dz = 0): Layer => {
    const z = LZ + dz
    const d = depth(z)
    return {
      ...l,
      position: [l.position[0] * d, l.position[1] * d, z],
      scale: l.scale * d,
      blocks: l.blocks.map((blk) => (blk.preset === 'move' && blk.params ? { ...blk, params: { ...blk.params, dx: (blk.params.dx ?? 0) * d, dy: (blk.params.dy ?? 0) * d } } : blk)),
    }
  }
  const liquidBar = (name: string, file: string, z: number, from: number, to: number, extra: Partial<LayerSpec>, tint?: string, fade = 9) => {
    const blocks = [...cut(from, to), ...(fade ? [fadeIn(from, fade)] : []), ...barPath]
    const x = barBig - (END0 - TIP0)
    return tint ? tinted(name, file, tint, x, BAR_Y, z, 2400 * LIQ, blocks, extra) : image(name, file, x, BAR_Y, z, 2400 * LIQ, blocks, extra)
  }
  // ===== 8) 335–392: sayaç 0 → 100 (referans: 340'ta 73, 348'de 86, 360'ta 95, 378'de 100). Beyaz zemin (boş kısım)
  // çubuğun önünde açıkça görünür (345'te ~200 px) ve dolarken kapanır (364'te biter), referanstaki gibi.
  add(behind(liquidBar(`${k('bar')} ·`, 'bar-glow', 0, 328, 388, { opacity: 0.5 }, ORANGE), -0.04))
  // Zemin çubuğun önünde görünür (345'te ~200 px) ve dolarken kapanır; sonunda çubuğun ucunun 6 px GERİSİNDE durur
  // (ucun altında kalır): 100/100'de ne boşluk ne de çıkıntı görünür.
  add(behind(image(k('track'), 'bar-track', barAt(2460), BAR_Y, 0, 2400, [
    ...cut(336, 385), move(336, 345, { dx: 1413 - 2460 }, 'ease-out'), move(345, 364, { dx: END1 - 6 - 1413 }, [0.2, 0.2, 0.4, 1]), fadeOut(380, 4),
  ]), -0.02))
  add(behind(liquidBar(k('bar'), 'bar', 0, 305, 394, {}, ORANGE, 0)))
  add(behind(liquidBar(`${k('bar')} ✦`, 'bar-shine', 0, 328, 394, { opacity: 0.65 }), 0.02))
  const fanBlocks: BlockSpec[] = [...cut(305, 331), fadeIn(305, 4), about(320, 338, fanCenter(320), BAR_Y, 1 / LIQ, SHRINK, END0, BAR_Y)]
  for (let f = 316; f < 331; f += 2) fanBlocks.push(move(f, f + 2, { dx: fanLeft(f + 2) - fanLeft(f) }, 'linear'))
  add(behind(tinted(k('liquid'), 'funnel', ORANGE, fanCenter(305), BAR_Y, 0, FAN_W, fanBlocks), 0.04))
  // hap → daire: zemin renginde silme plakası soldan gelir, ucunda yuvarlak nokta taşır
  const WIPE = 2700
  const wipe = move(381, 391, { dx: END2 - BAR_H / 2 + 60 }, GLIDE)
  add(layer({ name: t('layerNames.eraser'), kind: 'shape', shape: 'rect', shapeWidth: WIPE * U, shapeHeight: 360 * U, color: BG, position: P(-60 - WIPE / 2, BAR_Y + 30, 0.02), blocks: [...cut(380, 394), wipe] }))
  const DOT_X = END2 - BAR_H / 2
  add(tinted(k('dot'), 'dot', ORANGE, -60, BAR_Y, 0.03, 200, [...cut(380, 398), wipe, move(392, 396, { scaleBy: 1.5 }, 'ease-out'), fadeOut(394, 4)]))
  const SN = 124
  const pairW = (em('100') + em('/100')) * SN
  const numRight = END0 - BAR_H / 2 - pairW / 2 + em('100') * SN
  const NUM_Y = BAR_Y - 200
  const numPath = [move(335, 379, { dx: END1 - END0 }, COUNT), fadeOut(387, 5)]
  add(text(t('layerNames.counter'), '100', numRight, NUM_Y, SN, ORANGE, [...cut(335, 393), fadeIn(335, 4), b('count-up', F(336), F(42), { easing: 'custom', bezier: COUNT, params: { from: 0, to: 100 } }), ...numPath], { align: 'right' }))
  add(text(`${t('layerNames.counter')} /`, '/100', numRight + 8, NUM_Y, SN, DIM, [...cut(335, 393), fadeIn(335, 4), ...numPath]))
  // alttaki telefon: sıvının ve çubuğun önünde (derinlikte de listede de)
  add(phoneLayers[0])
  reset(300)

  // ===== 9) 392–436: nokta onay halkasına büyür, işaret gelir, "Rendered"; konfeti derinlikli: yakın parçalar iri ve
  // bulanık, uzaktakiler küçük ve net; hızla saçılıp yavaşça süzülür. Halka sönmez: boş karta, o da ilk karta dönüşür.
  const RING_W = (400 * 400) / 212 // halka 400 px (görsel 400 px'te halka 212 px)
  add(tinted(k('ring'), 'ring', ORANGE, DOT_X, BAR_Y, 0.04, RING_W, [...cut(393, 436), pop(393, 9), fadeOut(432, 4)]))
  add(tinted(k('check'), 'tick', ORANGE, DOT_X, BAR_Y, 0.05, RING_W, [...cut(396, 435), pop(396, 8), fadeOut(431, 4)]))
  const done = k('done')
  const SD = 116
  add(text(k('done'), done, DOT_X - (em(done) * SD) / 2, BAR_Y - 300 + 25, SD, ORANGE, [...cut(392, 434), ...riseIn(392, 25), fadeOut(427, 6)], { position: P(DOT_X - (em(done) * SD) / 2, BAR_Y - 300 + 25 + 0.15 * SD, 0.09) }))
  // tohumlu sözde rastgele (her derlemede aynı)
  let seed = 11
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const confetti = [ORANGE, GOLD, TANG, '#FFD27A', LEAF, RED, '#FF9F45']
  for (let i = 0; i < 46; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const near = i % 3 === 0
    // hedef: kadrajın yanları ve üstü (ortadaki halka ve yazı açık kalır)
    const tx = 960 + side * (230 + rnd() * 760)
    const ty = 60 + rnd() * (near ? 900 : 620)
    const z = near ? 2.2 + rnd() * 2.6 : -1.5 + rnd() * 2.5
    const w = (near ? 150 + rnd() * 210 : 44 + rnd() * 90) * depth(z)
    const at = 393 + Math.floor(rnd() * 8)
    const [fx0, fy0] = [side * (260 + rnd() * 420), -(340 + rnd() * 380)]
    const p = P(960 + (tx + fx0 - 960) * depth(z), 540 + (ty + fy0 - 540) * depth(z), z)
    add(layer({
      name: `${k('confetti')} ${i + 1}`, kind: 'image', color: confetti[i % confetti.length], tint: true, image: img(near ? 'confetti-blur' : 'confetti'),
      position: p, rotation: [rnd() * 70 - 35, rnd() * 70 - 35, rnd() * 360], scale: sc(w), opacity: near ? 0.85 : 1,
      blocks: [
        ...cut(at, 434), fadeIn(at, 3),
        move(at, at + 11, { dx: -fx0 * depth(z), dy: -fy0 * depth(z), rotate: (rnd() - 0.5) * 240, rotX: (rnd() - 0.5) * 300, rotY: (rnd() - 0.5) * 300 }, [0.08, 0.7, 0.2, 1]),
        move(at + 9, 434, { dx: (rnd() - 0.5) * 70 * depth(z), dy: (50 + rnd() * 90) * depth(z), rotate: (rnd() - 0.5) * 70, rotX: (rnd() - 0.5) * 120, rotY: (rnd() - 0.5) * 120 }, 'linear'),
        fadeOut(425 + Math.floor(rnd() * 3), 7),
      ],
    }))
  }

  // ===== 10) 432–472: şablon kartları. Halka boş karta, boş kart ilk karta dönüşür; diğerleri sağdan solarak gelir,
  // şerit sola akar (440–454 hızlı, sonra yavaş), kenarlardaki kartlar zemine doğru solar.
  const CARD_IDS = ['fintech', 'mango-ai-ad', 'fold-promo', 'crystal', 'words-motion', 'wallet-promo']
  const PITCH = 690
  const CARD_W = (560 * 720) / 500 // kart 560 px (görsel 720 px'te kart 500 px)
  const ROW_Y = 560
  const rowFlow = [move(438, 447, { dy: ROW_Y - BAR_Y }, GLIDE), move(440, 454, { dx: -810 }, [0.45, 0, 0.4, 1]), move(454, 472, { dx: -90 }, 'linear')]
  const blankW = (300 * 500) / 300
  add(image(k('blank'), 'blank-card', DOT_X, BAR_Y, 0.06, blankW * 0.8, [...cut(432, 441), fadeIn(432, 3), move(432, 439, { scaleBy: 1.85 / 0.8 }, GLIDE), fadeOut(436, 4), ...rowFlow]))
  const cardAt = [435, 438, 444, 449, 453, 457]
  CARD_IDS.forEach((id, i) => {
    const at = cardAt[i]
    const enter = i === 0 ? [fadeIn(at, 5), move(at, at + 6, { scaleBy: 1 / 0.6 }, GLIDE)] : [fadeIn(at, 6), move(at, at + 8, { dx: -90 }, SETTLE)]
    add(image(`${k('templateCard')} ${i + 1}`, `card-${id}`, DOT_X + i * PITCH + (i === 0 ? 0 : 90), BAR_Y + (20 * CARD_W) / 720, 0.07 + i * 0.002, CARD_W * (i === 0 ? 0.6 : 1), [...cut(at, 472), ...enter, ...rowFlow]))
  })
  ;[-1, 1].forEach((side) => {
    add(tinted(`${k('edge')} ${side < 0 ? 1 : 2}`, 'edge-fade', BG, 960 + side * 760, ROW_Y, 0.12, 400, [...cut(444, 472), fadeIn(444, 8)], { rotation: [0, 0, side < 0 ? 0 : 180] }))
  })
  const SL = 46
  add(text(k('templatesLabel'), k('templatesLabel'), 96, 110 + 14, SL, INK, [...cut(440, 472), ...riseIn(440, 14), fadeOut(467, 5)], { fontWeight: 700, position: P(96, 110 + 14 + 0.15 * SL, 0.14) }))

  // ===== 11) 472–546: Studio arayüzü yatıp doğrulur, imleç bir karta gider, kamera yaklaşır. Kart seçilince arayüz
  // bulanıklaşıp söner (bulanık görsel üste solar), kart tek kalır, hafifçe eğilir ve hızla dönüp kenarına gelir.
  reset(472, 1.55)
  camTo(472, 472, { x: 1040, y: 330 })
  const UI_W = 1880 // görsel; arayüz çerçevesi 140 px içeride (1600 × 1000), görselin ortasında
  // 1. kartın (fintech) merkezi: çerçevede (490, 270)
  const PICK = { x: 960 - 800 + 490, y: 540 - 500 + 270 }
  const uiTilt = [move(475, 492, { rotY: 20, rotX: 7, rotate: -3 }, GLIDE), move(500, 516, { rotY: -20, rotX: -7, rotate: 3 }, GLIDE)]
  add(image(k('studio'), `studio-${lang}`, 960, 540, 0, UI_W, [...cut(472, 532), ...uiTilt, fadeOut(526, 5)]))
  add(image(`${k('studio')} ·`, `studio-blur-${lang}`, 960, 540, 0.01, UI_W, [...cut(524, 535), fadeIn(524, 4), fadeOut(529, 6)]))
  // seçilen kart: görsel 720 px'te kart 500 px; kart merkezi görsel merkezinden 20 px yukarıda. Arayüz söndükten sonra döner
  // (aynı düzlemde dönerken arkasına geçen yarısı kesiliyordu).
  const PW = (400 * 720) / 500
  add(image(`${k('templateCard')} ·`, 'card-fintech', PICK.x, PICK.y + (20 * PW) / 720, 0.02, PW, [
    ...cut(521, 546), fadeIn(521, 3), move(523, 531, { scaleBy: 1.22 }, SETTLE), move(533, 543, { rotY: -9, rotX: 5, rotate: -4, scaleBy: 1.05 }, 'ease-in-out'), move(542, 546, { rotY: -81, scaleBy: 0.9 }, [0.6, 0, 1, 0.7]),
  ]))
  add(cursor(PICK.x + 560, PICK.y + 360, 70, [
    ...cut(494, 541), fadeIn(494, 4), cmove(494, 512, -510, -320, GLIDE), cmove(512, 520, -10, -4, 'linear'), ...press(519), fadeOut(536, 5),
  ]))
  camTo(472, 488, { x: 960, y: 540, s: 0.94 }, GLIDE)
  camTo(488, 502, { s: 0.92 })
  camTo(502, 522, { x: PICK.x, y: PICK.y, s: 2.25 }, GLIDE)
  camTo(522, 546, { s: 2.05 })

  // ===== 12) 546–606: kenarına gelen karttan kartlar dönerek açılıp dağılır, süzülür, "Every format"; sonda içe çekilir
  reset(546)
  const fly: { id: string; x: number; y: number; rot: Vec3; w: number }[] = [
    { id: 'fintech', x: 250, y: 150, rot: [18, 24, -8], w: 780 },
    { id: 'crystal', x: 1700, y: 140, rot: [20, -32, 30], w: 660 },
    { id: 'mango-ai-ad', x: 300, y: 910, rot: [-22, 26, 24], w: 820 },
    { id: 'wallet-promo', x: 1660, y: 890, rot: [-16, -28, 14], w: 700 },
    { id: 'fold-promo', x: 1610, y: 510, rot: [4, -40, -22], w: 500 },
    { id: 'words-motion', x: 120, y: 540, rot: [2, 44, 12], w: 480 },
  ]
  fly.forEach((c, i) => {
    const dx = c.x - 960
    const dy = c.y - 540
    const spin = i % 2 === 0 ? 90 : -90 // kenarından başlar
    add(image(`${k('templateCard')} ✦${i + 1}`, `card-${c.id}`, 960, 540, 0.3 + i * 0.05, c.w * 0.75, [
      ...cut(546, 607),
      move(546, 559, { dx, dy, rotY: c.rot[1] - spin, rotX: c.rot[0], rotate: c.rot[2], scaleBy: 1 / 0.75 }, [0.1, 0.7, 0.25, 1]),
      move(557, 596, { dx: dx * 0.06, dy: dy * 0.06, rotate: 5, rotY: -6 }, 'linear'),
      move(594, 606, { dx: -dx * 0.8, dy: -dy * 0.8, scaleBy: 0.12, rotY: 70 }, EASE_IN), fadeOut(599, 7),
    ], { rotation: [0, spin, 0] }))
  })
  const S12 = 96
  const w12 = k('line12').split(' ')
  lineUp(w12, S12).forEach((p, i) => {
    const at = 556 + i * 7
    add(text(`${k('title')} 12.${i + 1}`, w12[i], p.left, 540 + 35, S12, i === 0 ? INK : ORANGE, [...cut(at, 606), ...riseIn(at), fadeOut(597, 7)]))
  })
  camTo(546, 562, { s: 1 })
  camTo(562, 596, { s: 0.96 })

  // ===== 13) 606–666: liste görünümü perspektifte belirir, imleç ilk satıra gelir; 656'dan sonra kamera satıra doğru
  // hızla dalar (hareket bulanıklığıyla) ve kesilir
  reset(606)
  const ROW1 = { x: 870, y: 290 }
  add(image(k('list'), `list-${lang}`, 960, 590, 0, UI_W, [
    ...cut(606, 666), fadeIn(606, 8), move(606, 622, { rotY: 14, rotX: -6, rotate: 4, scaleBy: 1 / 1.2 }, SETTLE), move(622, 660, { rotY: 5, rotX: -2, rotate: 2 }, 'linear'), fadeOut(663, 3),
  ], { rotation: [16, -32, -10], scale: sc(UI_W) * 1.2 * 1.12, position: P(960, 590, -1.35) }))
  add(cursor(1300, 1000, 90, [...cut(620, 663), fadeIn(620, 4), cmove(620, 646, ROW1.x - 1300, ROW1.y - 1000, GLIDE), ...press(652), fadeOut(658, 4)]))
  camTo(606, 656, { s: 1.06 })
  camTo(656, 666, { x: ROW1.x - 60, y: ROW1.y + 30, s: 2.8 }, EASE_IN)

  // ===== 14) 666–735: satır tek başına, küçük ve sağda başlar (referans: 0.54 kat, sol kenarı 320'de); büyürken yavaşça
  // sola kayar, 682–691 arası hızla kayıp sağ ucundaki düğmeyi ortaya getirir. İmleç tıklar, düğme turuncu olur.
  reset(666)
  const ROW_IMG = 3000 // satır 2600 px, görselin ortasında
  const BTN_W = 760 // görsel; gövde 680 × 180
  const BTN_OFF = 1300 - 440 // düğmenin merkezi satırın merkezinden bu kadar sağda
  // satırın yolu: [kare, sol kenar (px), ölçek, eğri]; sonunda düğme kadrajın ortasında
  const rowKeys: [number, number, number, Bezier | string][] = [
    [666, 320, 0.54, 'linear'], [675, 215, 1, [0.2, 0.6, 0.3, 1]], [682, 60, 1, 'linear'], [691, -1100, 1, [0.5, 0, 0.3, 1]], [703, -1200, 1, 'ease-out'],
  ]
  /** satırın merkezinden `off` px sağdaki öğe için hareketler (ölçek satırla birlikte) */
  const rowPath = (off: number) => rowKeys.slice(1).map((c, n) => {
    const a = rowKeys[n]
    return move(a[0], c[0], { dx: c[1] + (1300 + off) * c[2] - (a[1] + (1300 + off) * a[2]), scaleBy: c[2] / a[2] }, c[3])
  })
  const [r0L, r0S] = [rowKeys[0][1], rowKeys[0][2]]
  const rowX0 = r0L + 1300 * r0S
  const btnX0 = r0L + (1300 + BTN_OFF) * r0S
  add(image(k('row'), `row-${lang}`, rowX0, 540, 0, ROW_IMG * r0S, [...cut(666, 726), ...rowPath(0), move(716, 728, { dx: -500 }, EASE_IN), fadeOut(714, 9)]))
  const grow = move(718, 728, { scaleBy: 1.22 }, SETTLE)
  const btnOut = [move(733, 741, { scaleBy: 1.8 }, EASE_IN), fadeOut(734, 6)]
  // düğme satır büyüyene kadar (674) çizilmez: küçükken kadraja giriyordu, referansta 681'de sağdan girer
  add(tinted(t('layerNames.shadow'), 'button-shadow', ORANGE, btnX0, 540, 0.015, BTN_W * r0S, [...cut(714, 742), fadeIn(714, 6), ...rowPath(BTN_OFF), grow, ...btnOut], { opacity: 0.6 }))
  add(tinted(t('layerNames.button'), 'button', INK, btnX0, 540, 0.02, BTN_W * r0S, [...cut(674, 721), ...rowPath(BTN_OFF), grow]))
  add(tinted(`${t('layerNames.button')} ✦`, 'button', ORANGE, btnX0, 540, 0.03, BTN_W * r0S, [...cut(714, 742), fadeIn(714, 5), ...rowPath(BTN_OFF), grow, ...btnOut]))
  const SB = 58
  add(text(k('export'), k('export'), btnX0, 540, SB, '#FFFFFF', [...cut(674, 742), ...rowPath(BTN_OFF), grow, fadeOut(733, 5)], { align: 'center', scale: r0S, position: P(btnX0, 540 + 0.03 * SB * r0S, 0.04) }))
  add(cursor(640, 1040, 150, [...cut(692, 732), fadeIn(692, 4), cmove(692, 705, 960 + 110 - 640, 575 - 1040, SETTLE), ...press(712), cmove(720, 731, 200, -560, EASE_IN), fadeOut(724, 6)]))
  camTo(666, 716, { s: 1.03 })

  // ===== 15–16) 733–858: düğme dev bir yıldıza dönüşür (kadrajı kaplayıp küçülür: 742'de 800 px, 750'de 330),
  // döne döne sağ alttan çıkar; sol üstten geri girip satırın başına çarpar ve seker: çarptığı yerde ilk kelime belirir.
  // Kavis çizip ikinci kelimenin sonuna konar, üçüncü kelime çıkarken üstünden atlayıp sonuna yerleşir.
  reset(735)
  const S16 = 84
  const w16 = [k('step1'), k('step2'), k('step3')]
  const line16 = lineUp(w16, S16)
  const SHIFT = 150 // ilk iki kelime biraz sağda durur; üçüncü gelince satır ortalanır
  const BIG1 = 1.3 // ilk kelime büyük belirir, 803'e kadar oturur
  const w1cx = 960 + ((line16[0].left + line16[0].right) / 2 + SHIFT - 960) * BIG1
  const HIT: [number, number] = [w1cx, 540 - 0.5 * S16 * BIG1 - 26] // çarpma noktası: kelimenin üst kenarı
  const STAR = 62
  const starY = 540 - 2
  const land2 = line16[1].right + SHIFT + 48
  const land3 = line16[2].right + 48
  // 1. yıldız (düğmeden doğar): [kare, x, y, boyut (px), açı (toplam), eğri]. Sağ alttan kadrajdan çıkar ve biter.
  const path: [number, number, number, number, number, Bezier | string][] = [
    [736, 960, 540, 5200, 0, 'linear'],
    [739, 960, 540, 1500, -20, [0.2, 0.5, 0.4, 1]], [742, 960, 540, 800, 0, 'linear'], [744, 960, 540, 520, 20, 'linear'], [750, 960, 540, 330, -90, 'ease-out'],
    [756, 975, 535, 290, -140, 'linear'], [762, 1060, 500, 250, -180, 'linear'], [768, 1340, 500, 230, -215, 'ease-in'],
    [771, 1640, 690, 215, -250, 'linear'], [775, 2200, 1280, 200, -300, 'linear'],
  ]
  const starBlocks: BlockSpec[] = [...cut(733, 775), b('fade-in', F(733), F(8), { easing: 'ease-in' })]
  for (let n = 1; n < path.length; n++) {
    const [a, c] = [path[n - 1], path[n]]
    starBlocks.push(move(a[0], c[0], { dx: c[1] - a[1], dy: c[2] - a[2], scaleBy: c[3] / a[3], rotate: c[4] - a[4] }, c[5]))
  }
  // 2. yıldız (ayrı katman): sol üstten girer ve kelimelerin üstünde zıplar. Yatay hareket sabit hızda, düşey hareket
  // ayrı bloklarda (yükselirken yavaşlar, inerken hızlanır): gerçek bir zıplama yayı çizer.
  const RISE: Bezier = [0.1, 0.55, 0.4, 1]
  const FALL: Bezier = [0.6, 0, 0.9, 0.45]
  const IN_X = HIT[0] - 380
  const hopBlocks: BlockSpec[] = [
    ...cut(775, 858), fadeOut(854, 4),
    // düşüş: sol üstten çarpma noktasına
    move(775, 783, { dx: HIT[0] - IN_X }, 'linear'), move(775, 783, { dy: HIT[1] + 50 }, [0.35, 0, 0.85, 0.6]),
    // 1. zıplama: çarpar, yükselir (791'de tepe), ikinci kelimenin sonuna iner
    move(783, 801, { dx: land2 - HIT[0] }, 'linear'), move(783, 791, { dy: -230 }, RISE), move(791, 801, { dy: starY - (HIT[1] - 230) }, FALL),
    // konunca küçük bir geri sekme
    move(801, 804, { dy: -26 }, RISE), move(804, 807, { dy: 26 }, FALL),
    // 2. zıplama: üçüncü kelimenin üstünden atlayıp sonuna konar
    move(816, 823, { dx: land3 - land2 }, 'linear'), move(816, 819.5, { dy: -84 }, RISE), move(819.5, 823, { dy: 84 }, FALL),
    move(823, 826, { dy: -18 }, RISE), move(826, 829, { dy: 18 }, FALL),
    // boyut ve dönüş
    move(775, 801, { scaleBy: STAR / 84 }, 'linear'), move(775, 852, { rotate: -720 }, 'linear'),
    move(852, 858, { dx: 800 - land3, dy: 520 - starY, scaleBy: 0.4, rotate: -90 }, EASE_IN),
  ]
  add(tinted(`${t('layerNames.glow')} ✦`, 'glow', ORANGE, 960, 540, 0.04, 1500, [...cut(738, 772), fadeIn(738, 5), move(738, 760, { scaleBy: 0.35 }, 'ease-out'), fadeOut(754, 16)], { opacity: 0.45 }))
  // iz: V'nin ucu çarpma noktasında (görsel 600×460, uç (330, 400))
  const recenter = move(816, 823, { dx: -SHIFT }, GLIDE)
  const lineOut = [move(843, 858, { dx: -380 }, EASE_IN), fadeOut(850, 7)]
  // 1. kelime çarpmayla belirir, büyük başlar (1.3) ve otururken küçülür
  const x1big = 960 + (line16[0].left + SHIFT - 960) * BIG1
  add(text(`${k('title')} 16.1`, w16[0], x1big, 540, S16, TANG, [...cut(784, 858), fadeIn(784, 2), about(785, 803, x1big, 540, 1 / BIG1, [0.2, 0.6, 0.3, 1]), recenter, ...lineOut], { scale: BIG1 }))
  add(text(`${k('title')} 16.2`, w16[1], line16[1].left + SHIFT, 540 + 22, S16, ORANGE, [...cut(799, 858), ...riseIn(799, 22), recenter, ...lineOut]))
  add(text(`${k('title')} 16.3`, w16[2], line16[2].left, 540 + 22, S16, INK, [...cut(819, 858), ...riseIn(819, 22), ...lineOut]))
  add(tinted(t('layerNames.spark'), 'spark', ORANGE, 960, 540, 0.05, path[0][3], starBlocks))
  // Işık izi: yıldızın soluk kopyaları aynı yolu yarım kare aralıklarla (0.5–2.5 kare) geriden izler. Sabit bir iz görseli yıldızdan önce
  // belirip zıplama bitmeden sönüyordu; kopyalar yıldızı hiç geçemez ve o durunca arkasında toplanır.
  const late = (blocks: BlockSpec[], d: number): BlockSpec[] => blocks.map((blk) => ({ ...blk, start: Math.round((blk.start + F(d)) * 1e6) / 1e6 }))
  ;[5, 4, 3, 2, 1].forEach((n) => {
    const d = n * 0.5
    add(tinted(`${k('trail')} ${n}`, 'spark', ORANGE, IN_X, -50, 0.05 - n * 0.003, 84 * (1 - n * 0.05), late(hopBlocks, d), { opacity: 0.4 - n * 0.06 }))
  })
  add(tinted(`${t('layerNames.spark')} 2`, 'spark', ORANGE, IN_X, -50, 0.05, 84, hopBlocks))

  // ===== 17) 858–991: aydınlık zeminde Mango logosu pop ile gelir, "Mango Studio" harf harf, altta mangostudio.design
  // (kullanıcı kararı: kapanış zemini beyaz; marka kuralındaki "logo koyu zeminde" burada uygulanmaz)
  reset(858, 1.05)
  camTo(858, 991, { s: 1 }, 'ease-out')
  const SW = 112
  const WORD = 'Mango Studio'
  const wordW = (em('Mango') + SPACE + em('Studio')) * SW
  const LOGO_INK = 98 // logonun mürekkep genişliği (px)
  const GAP = 30
  const left17 = 960 - (LOGO_INK + GAP + wordW) / 2
  // mango-logo-2048.png: mürekkep 660×976, merkezi (1024, 907) → görsel merkezi mürekkepten 117/2048 yukarıda
  const logoW = LOGO_INK * (2048 / 660)
  add(tinted(`${t('layerNames.glow')} ·`, 'glow', GOLD, left17 + LOGO_INK / 2, 525, 0, 620, [...cut(858, 991), fadeIn(858, 14)], { opacity: 0.3 }))
  add(layer({ name: t('layerNames.logo'), kind: 'image', color: '#ffffff', image: `${base}brand/mango-logo-2048.png`, position: P(left17 + LOGO_INK / 2, 520 + ((1024 - 907) / 2048) * logoW, 0.02), scale: sc(logoW), blocks: [...cut(858, 991), pop(858, 10)] }))
  add(text(t('layerNames.wordmark'), WORD, left17 + LOGO_INK + GAP, 520, SW, INK, [...cut(862, 991), b('typewriter', F(862), F(13))]))
  const SU = 36
  const dom = [{ text: 'mangostudio', color: INK }, { text: '.design', color: ORANGE }]
  const domW = (em(dom[0].text) + em(dom[1].text)) * SU
  const split = 886 + (20 * dom[0].text.length) / (dom[0].text.length + dom[1].text.length)
  add(text(k('domain'), dom[0].text, 960 - domW / 2, 940, SU, dom[0].color, [...cut(886, 991), b('typewriter', F(886), F(split - 886))]))
  add(text(`${k('domain')} ·`, dom[1].text, 960 - domW / 2 + em(dom[0].text) * SU, 940, SU, dom[1].color, [...cut(split, 991), b('typewriter', F(split), F(906 - split))]))

  // Ses efektleri: her grup videonun tamamı boyunca süren ayrı bir parça; seviyesi zaman çizelgesinden ayrı ayarlanır.
  // Olaylar videodaki karelerle eşli olduğu için parçalar 0'dan başlar; kaydırılırsa eşleme bozulur.
  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: `${base}templates/launch-ad/sfx/${group}.mp3`,
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  return {
    ...project(k('name'), END, BG, layers, camera(camBlocks)),
    audio: sfx,
    fps: 60,
    lighting: 'studio',
    accentLight: '#FFD9B0',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
