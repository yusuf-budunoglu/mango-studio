import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { LAUNCH_EM } from './launchAdMetrics'

// "Launch ad": yatay (1920×1080, 60 kare/sn, 33 sn) Mango Studio tanıtımı. Temposu ve hareket dili bir SaaS ürün
// tanıtımı referansından (1920×1080, 30 kare/sn, 991 kare) kare kare ölçüldü; kare numaraları referansın kareleri
// (`F(n)` saniyeye çevirir), ölçüler 1920×1080 pikseli. Kopya değil: hikâye, metinler, arayüz, görseller ve renkler
// Mango Studio'nun (aydınlık zemin, mango turuncusu; kapanış logo kuralı gereği koyu).
// Sahneler (kesmeler 33, 66, 135, 172, 300, 436, 470, 545, 606, 665, 735, 858):
//  1 "Turn ideas" kelime kelime            2 dev "Motion" yakından oturur, küçülür   3 "Any style ▣ Instantly" + imleç
//  4 karo panele bırakılır, dalgalar       5 "Just prompt and go"                    6 telefon tüneli + "Text. Shapes. Devices."
//  7 turuncu sıvı çubuğa dönüşür           8 ilerleme çubuğu 0 → 100                 9 "Rendered" + onay + konfeti
// 10 şablon kartları şeridi               11 Studio arayüzü, karta yakınlaşma        12 uçuşan kartlar + "Every format"
// 13 liste görünümü                       14 satır → "Export in 4K" düğmesi, tık     15 düğme yıldıza dönüşür
// 16 "Prompt. Edit. Export"               17 Mango logosu, "Mango Studio", mangostudio.design
// Görseller ve kelime genişlikleri: node scripts/build-launch-ad-assets.mjs (public/templates/launch-ad).

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

const FONT = 'inter-medium'
const SPACE = LAUNCH_EM[' ']?.[0] ?? 0.25
const em = (word: string) => LAUNCH_EM[word]?.[0] ?? word.length * 0.56

// Renkler: hepsi katman rengi, editörden değişir
const BG = '#F6F5F2'
const INK = '#17130F'
const DIM = '#A8A096'
const LIGHT = '#F5F2EC'
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

/** Dünya z ekseninde `roll` kadar döndürülmüş, ekranı tünelin eksenine bakan telefonun Euler açıları (XYZ, derece). */
function wallEuler(roll: number, tilt: number): Vec3 {
  // M = Rz(roll) · Rx(-90 + tilt); three.js XYZ sırasına ayrıştırılır
  const a = (-90 + tilt) * DEG
  const r = roll * DEG
  const [ca, sa, cr, sr] = [Math.cos(a), Math.sin(a), Math.cos(r), Math.sin(r)]
  const m11 = cr
  const m12 = -sr * ca
  const m13 = sr * sa
  const m23 = -cr * sa
  const m33 = ca
  return [Math.atan2(-m23, m33) / DEG, Math.asin(Math.max(-1, Math.min(1, m13))) / DEG, Math.atan2(-m12, m11) / DEG]
}

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
  /** sahne biriminde hareket (3D telefonlar) */
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
  /** sol hizalı kelimeyi satırın ortasına (cx, cy) göre `factor` katına getirir (kamerayı oynatmadan büyütme/küçültme) */
  const about = (from: number, to: number, left: number, y: number, factor: number, easing: Bezier, cx = 960, cy = 540) =>
    move(from, to, { dx: (left - cx) * (factor - 1), dy: (y - cy) * (factor - 1), scaleBy: factor }, easing)
  // imleç görseli (saas-ad/cursor: 120 css, ucu (14, 10)): genişliği w iken merkez uçtan (0.383w, 0.417w) uzakta
  const cursor = (tipX: number, tipY: number, w: number, blocks: BlockSpec[]) =>
    layer({ name: t('layerNames.cursor'), kind: 'image', color: '#ffffff', image: `${base}templates/saas-ad/cursor.png`, position: P(tipX + 0.383 * w, tipY + 0.417 * w, 0.7), scale: sc(w) * (8.3 / 9), blocks })
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

  // ===== 3) 66–135: "Any" → "Any style" → "Any style ▣ Instantly"; imleç karoyu tutar
  const S3 = 96
  const TILE = 300 // karonun görünen kenarı (görsel 400 px'te karo 340 px, merkezi görsel merkezinden 30 px yukarıda)
  const tileW = (400 * TILE) / 340
  const tileDy = (30 * TILE) / 340
  const w3 = [k('any'), k('style'), k('instantly')]
  const pair = lineUp(w3.slice(0, 2), S3)
  const full = lineUp(w3, S3, 960, [SPACE * S3, TILE + 130])
  const soloLeft = 960 - (em(w3[0]) * S3) / 2
  const tileX = (full[1].right + full[2].left) / 2
  const out3 = fadeOut(127, 9)
  add(text(`${k('title')} 3.1`, w3[0], soloLeft, 540, S3, ORANGE, [...cut(66, 136), move(74, 80, { dx: pair[0].left - soloLeft }, GLIDE), move(94, 101, { dx: full[0].left - pair[0].left }, SETTLE), out3]))
  add(text(`${k('title')} 3.2`, w3[1], pair[1].left, 540 + 35, S3, INK, [...cut(80, 136), ...riseIn(80), move(94, 101, { dx: full[1].left - pair[1].left }, SETTLE), out3]))
  add(text(`${k('title')} 3.3`, w3[2], full[2].left + 70, 540, S3, TANG, [...cut(96, 136), fadeIn(96, 5), move(96, 104, { dx: -70 }, SETTLE), out3]))
  // ===== 4) panel karodan önce eklenir: listede arkada kalmalı (saydam pikseller derinliğe yazıyor)
  // Panel önce kenarından görünür (ince şerit), sonra öne doğru açılır; karo içine düşer, yumuşak dalgalar yayılır.
  const PANEL_Y = 640
  add(image(k('panel'), 'panel', 960, PANEL_Y - 60, -0.03, 1560, [
    ...cut(141, 174), fadeIn(141, 4), move(141, 154, { dy: 60, rotX: 42 }, SETTLE), move(154, 166, { dy: -8 }, 'linear'), move(166, 174, { dy: -70, scaleBy: 0.9 }, EASE_IN), fadeOut(166, 7),
  ], { rotation: [-86, 0, 0] }))
  ;[0, 1, 2].forEach((i) => {
    const at = 155 + i * 4
    add(tinted(`${k('pulse')} ${i + 1}`, 'pulse-soft', i === 1 ? GOLD : '#FFB36B', 960, PANEL_Y - 10, 0.5 + i * 0.01, 560, [
      ...cut(at, 173), fadeIn(at, 3), move(at, at + 14, { scaleBy: 2.3 - i * 0.2 }, 'ease-out'), fadeOut(at + 5, 10),
    ], { rotation: [-44, 0, 0], opacity: 0.3 }))
  })
  add(tinted(t('layerNames.glow'), 'glow', ORANGE, tileX, 580, -0.01, 760, [...cut(96, 160), fadeIn(96, 10), move(126, 140, { dx: 960 - tileX, dy: -50, scaleBy: 1.4 }, GLIDE), fadeOut(148, 10)], { opacity: 0.4 }))
  // karo: pop ile gelir, imleç tutunca ortaya taşınıp büyür, panele bırakılınca küçülerek kaybolur
  add(image(k('tile'), 'tile', tileX, 540 + tileDy, 0.6, tileW * (8.4 / 9), [
    ...cut(96, 161), pop(96, 9), move(121, 124, { scaleBy: 0.94 }, 'ease-out'),
    move(126, 140, { dx: 960 - tileX, dy: -50, scaleBy: 1.5 / 0.94 }, GLIDE), move(146, 158, { dy: PANEL_Y - 490, scaleBy: 0.3 }, GLIDE), fadeOut(154, 6),
  ]))
  const tipX = tileX + 80
  const tipY = 540 + 70
  add(cursor(tipX + 380, tipY + 340, 130, [
    ...cut(108, 168), fadeIn(108, 4), move(108, 120, { dx: -380, dy: -340 }, SETTLE), ...press(121),
    move(126, 140, { dx: 960 - tileX + 60, dy: -20 }, GLIDE), move(146, 156, { dx: -60, dy: PANEL_Y - 560 }, GLIDE), move(156, 167, { dx: 320, dy: -620 }, EASE_IN), fadeOut(160, 7),
  ]))
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

  // ===== 6) 192–320: dört telefon, ekranları eksene bakan bir tünel kurar; tünel yavaşça döner ve yaklaşır.
  // Telefon gövdesi 1.7 × 3.5 birim (ölçek 1); uzun kenarı derinlik boyunca, üst ucu uzakta.
  const PH = 3.0
  const Z0 = 2.2
  const TILT = 9
  const ROLL0 = -8
  const walls: { roll: number; d: number; screen: string; enter: number }[] = [
    { roll: 0, d: 2.9, screen: 'screen-gallery', enter: 192 }, // alt
    { roll: 270, d: 5.3, screen: 'screen-text', enter: 197 }, // sol
    { roll: 90, d: 5.3, screen: 'screen-vertical', enter: 204 }, // sağ
    { roll: 180, d: 2.9, screen: 'screen-prompt', enter: 209 }, // üst
  ]
  const wallPos = (roll: number, d: number): [number, number] => [d * Math.sin(roll * DEG), -d * Math.cos(roll * DEG)]
  const delta = (a: Vec3, c: Vec3) => ({ rotX: c[0] - a[0], rotY: c[1] - a[1], rotate: c[2] - a[2] })
  walls.forEach((w, i) => {
    const r0 = w.roll + ROLL0 - 26 // girişte tünel 26° geriden döner
    const r1 = w.roll + ROLL0
    const r2 = r1 + 11
    const [e0, e1, e2] = [wallEuler(r0, TILT), wallEuler(r1, TILT), wallEuler(r2, TILT)]
    const [p0, p1, p2] = [wallPos(r0, w.d * 2.1), wallPos(r1, w.d), wallPos(r2, w.d)]
    const blocks: BlockSpec[] = [
      ...cut(w.enter, i === 0 ? 320 : 302),
      move3(w.enter, w.enter + 24, { dx: p1[0] - p0[0], dy: p1[1] - p0[1], dz: -5, ...delta(e0, e1) }, SETTLE),
      move3(w.enter + 20, 290, { dx: p2[0] - p1[0], dy: p2[1] - p1[1], dz: 0.9, ...delta(e1, e2) }, 'linear'),
    ]
    if (i === 0) {
      // alttaki telefon kalır: sola kayıp doğrulur, arkasından sıvı çıkar, sonra kadrajdan çıkar
      blocks.push(move3(288, 306, { dx: -5.6, dy: 2.6, dz: -1.6, rotX: 66, rotY: 50, rotate: 8 }, GLIDE), move3(306, 319, { dx: -7.5, dz: 2 }, EASE_IN))
    } else {
      blocks.push(move3(286, 301, { dx: p2[0] * 1.5, dy: p2[1] * 1.5, dz: 5.5 }, EASE_IN))
    }
    add(layer({ name: `${t('layerNames.phone')} ${i + 1}`, kind: 'phone', color: ORANGE, image: img(w.screen), deviceFinish: 'silver', position: [p0[0], p0[1], Z0 + 5], rotation: e0, scale: PH, blocks }))
  })
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
      ...cut(262, 298), about(262, 274, big0, 540, 1 / 1.5, SETTLE), about(288, 298, p.left, 540, 1.5, EASE_IN), fadeOut(290, 7),
    ], { scale: 1.5 }))
  })

  // ===== 7) 300–336: turuncu sıvı soldan (telefonun arkasından) akar, çubuk kalınlığına iner; huni sola çekilince
  // altındaki çubuk kalır (aynı renk, aynı kalınlık: dikiş görünmez)
  const BAR_Y = 600
  const END0 = 2200 // çubuğun sağ ucu başta kadraj dışında
  const END1 = 1025 // sonda: uçtaki nokta kadrajın ortasında
  const COUNT: Bezier = [0, 0.85, 0.2, 1]
  const slide = move(335, 379, { dx: END1 - END0 }, COUNT)
  const barAt = (end: number) => end - 1160 // çubuk görselinde hapın sağ ucu merkezden 1160 px sağda
  // ===== 8) 316–392: çubuğun ucu görünür, sayı 0 → 100 (referans: 339'da 70, 348'de 86, 360'ta 95, 378'de 100)
  add(tinted(`${k('bar')} ·`, 'bar-glow', ORANGE, barAt(END0), BAR_Y, -0.01, 2400, [...cut(322, 388), fadeIn(322, 10), slide, fadeOut(380, 6)], { opacity: 0.5 }))
  add(image(k('track'), 'bar-track', barAt(1900), BAR_Y, 0, 2400, [...cut(328, 386), fadeIn(328, 8), fadeOut(378, 6)]))
  add(tinted(k('bar'), 'bar', ORANGE, barAt(END0), BAR_Y, 0.01, 2400, [...cut(316, 394), slide]))
  add(image(`${k('bar')} ✦`, 'bar-shine', barAt(END0), BAR_Y, 0.012, 2400, [...cut(322, 394), fadeIn(322, 10), slide], { opacity: 0.65 }))
  add(tinted(k('liquid'), 'funnel', ORANGE, -1500, BAR_Y, 0.014, 2600, [...cut(301, 337), move(301, 320, { dx: 2200 }, [0.2, 0.3, 0.2, 1]), move(320, 336, { dx: -2500 }, GLIDE)]))
  // silme plakası (zemin renginde): soldan gelip çubuğu uçtaki noktaya kadar örter; ucunda yuvarlak nokta taşır
  const WIPE = 2700
  const wipe = move(381, 391, { dx: END1 - BAR_H / 2 + 60 }, GLIDE)
  add(layer({ name: t('layerNames.eraser'), kind: 'shape', shape: 'rect', shapeWidth: WIPE * U, shapeHeight: 360 * U, color: BG, position: P(-60 - WIPE / 2, BAR_Y + 30, 0.02), blocks: [...cut(380, 394), wipe] }))
  add(tinted(k('dot'), 'dot', ORANGE, -60, BAR_Y, 0.03, 200, [...cut(380, 396), wipe, move(391, 395, { scaleBy: 1.15 }, 'ease-out')]))
  const SN = 124
  const pairW = (em('100') + em('/100')) * SN
  const numRight = END0 - BAR_H / 2 - pairW / 2 + em('100') * SN
  const NUM_Y = BAR_Y - 200
  add(text(t('layerNames.counter'), '100', numRight, NUM_Y, SN, ORANGE, [...cut(334, 394), fadeIn(334, 4), b('count-up', F(336), F(42), { easing: 'custom', bezier: COUNT, params: { from: 0, to: 100 } }), slide, fadeOut(386, 6)], { align: 'right' }))
  add(text(`${t('layerNames.counter')} /`, '/100', numRight + 8, NUM_Y, SN, DIM, [...cut(334, 394), fadeIn(334, 4), slide, fadeOut(386, 6)]))
  reset(300)

  // ===== 9) 392–436: nokta onay halkasına dönüşür, "Rendered", konfeti
  const DOT_X = END1 - BAR_H / 2
  const out9 = [move(424, 432, { scaleBy: 1.2 }, EASE_IN), fadeOut(424, 7)]
  add(tinted(k('ring'), 'ring', ORANGE, DOT_X, BAR_Y, 0.04, 440, [...cut(392, 436), pop(392, 9), ...out9]))
  add(tinted(k('check'), 'tick', ORANGE, DOT_X, BAR_Y, 0.05, 440, [...cut(396, 436), pop(396, 9), ...out9]))
  const done = k('done')
  const SD = 116
  add(text(k('done'), done, DOT_X - (em(done) * SD) / 2, BAR_Y - 300 + 25, SD, ORANGE, [...cut(392, 436), ...riseIn(392, 25), fadeOut(426, 7)]))
  // konfeti: tohumlu sözde rastgele (her derlemede aynı); parçalar üst köşelerden fışkırıp yavaşlayarak düşer
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const confetti = [ORANGE, GOLD, TANG, '#FFD27A', LEAF, RED]
  for (let i = 0; i < 34; i++) {
    const side = i % 2 === 0 ? -1 : 1
    const x0 = 960 + side * (420 + rnd() * 640)
    const y0 = -80 - rnd() * 180
    const size = 30 + rnd() * 100
    const at = 393 + Math.floor(rnd() * 9)
    add(layer({
      name: `${k('confetti')} ${i + 1}`, kind: 'shape', shape: i % 3 === 0 ? 'rounded' : 'rect', shapeWidth: size * U, shapeHeight: size * (0.45 + rnd() * 0.5) * U,
      color: confetti[i % confetti.length], position: P(x0, y0, 0.08 + i * 0.002), rotation: [rnd() * 60, rnd() * 60, rnd() * 180],
      blocks: [
        ...cut(at, 436),
        move(at, 434, { dx: -side * (60 + rnd() * 380), dy: 320 + rnd() * 700, rotate: (rnd() - 0.5) * 540, rotX: (rnd() - 0.5) * 720, rotY: (rnd() - 0.5) * 720 }, [0.1, 0.6, 0.4, 1]),
        fadeOut(424 + Math.floor(rnd() * 5), 7),
      ],
    }))
  }

  // ===== 10) 431–470: şablon kartları: ilki halkanın yerinde belirir, şerit sola akar
  const CARD_IDS = ['fintech', 'mango-ai-ad', 'fold-promo', 'crystal', 'words-motion', 'wallet-promo']
  const PITCH = 660
  CARD_IDS.forEach((id, i) => {
    const at = i === 0 ? 432 : 437 + i * 5
    add(image(`${k('templateCard')} ${i + 1}`, `card-${id}`, 960 + i * PITCH, BAR_Y, 0.01 + i * 0.002, 720, [
      ...cut(at, 470), b('scale-in', F(at), F(8)), move(442, 470, { dx: -3.3 * PITCH, dy: 560 - BAR_Y }, [0.35, 0.2, 0.3, 1]),
    ]))
  })

  // ===== 11) 470–545: Studio arayüzü yatıp doğrulur, imleç bir karta gider, kamera karta yaklaşır, kart tek kalır
  reset(470, 1.55)
  camTo(470, 470, { x: 1040, y: 330 })
  const UI_W = 1720 // görsel; arayüz çerçevesi 60 px içeride (1600 × 1000)
  // 1. kartın (fintech) merkezi: çerçevede (490, 270) → görselde (550, 330); görsel (960, 540)'ta
  const PICK = { x: 960 - UI_W / 2 + 550, y: 540 - 560 + 330 }
  add(image(k('studio'), `studio-${lang}`, 960, 540, 0, UI_W, [
    ...cut(470, 536), move(474, 492, { rotY: 20, rotX: 7, rotate: -3 }, GLIDE), move(500, 516, { rotY: -20, rotX: -7, rotate: 3 }, GLIDE), fadeOut(525, 10),
  ]))
  // seçilen kart: kart görselinde kart 500 px, görsel 600 px; kart merkezi görsel merkezinden 10 px yukarıda
  const CW = (400 * 600) / 500
  add(image(`${k('templateCard')} ·`, 'card-fintech', PICK.x, PICK.y + (10 * CW) / 600, 0.02, CW, [
    ...cut(520, 545), fadeIn(520, 4), move(521, 531, { scaleBy: 1.12 }, SETTLE), move(531, 545, { rotY: 22, rotate: -5, scaleBy: 1.06 }, 'ease-in'),
  ]))
  add(cursor(PICK.x + 560, PICK.y + 360, 70, [
    ...cut(494, 540), fadeIn(494, 4), move(494, 512, { dx: -510, dy: -320 }, GLIDE), move(512, 520, { dx: -10, dy: -4 }, 'linear'), ...press(519), fadeOut(533, 6),
  ]))
  camTo(470, 488, { x: 960, y: 540, s: 0.94 }, GLIDE)
  camTo(488, 502, { s: 0.92 })
  camTo(502, 522, { x: PICK.x, y: PICK.y, s: 2.25 }, GLIDE)
  camTo(522, 545, { s: 2.05 })

  // ===== 12) 545–606: kartlar ortadan dağılır, süzülür, "Every format"; sonda içe çekilip kaybolur
  reset(545)
  const fly: { id: string; x: number; y: number; rot: Vec3; w: number }[] = [
    { id: 'fintech', x: 250, y: 150, rot: [18, 24, -8], w: 660 },
    { id: 'crystal', x: 1700, y: 140, rot: [20, -32, 30], w: 560 },
    { id: 'mango-ai-ad', x: 300, y: 910, rot: [-22, 26, 24], w: 700 },
    { id: 'wallet-promo', x: 1660, y: 890, rot: [-16, -28, 14], w: 600 },
    { id: 'fold-promo', x: 1610, y: 510, rot: [4, -40, -22], w: 420 },
    { id: 'words-motion', x: 120, y: 540, rot: [2, 44, 12], w: 400 },
  ]
  fly.forEach((c, i) => {
    const dx = c.x - 960
    const dy = c.y - 540
    add(image(`${k('templateCard')} ✦${i + 1}`, `card-${c.id}`, 960, 540, 0.01 + i * 0.01, c.w, [
      ...cut(545, 607), b('scale-in', F(545), F(8)),
      move(545, 560, { dx, dy, rotY: c.rot[1], rotX: c.rot[0], rotate: c.rot[2] }, SETTLE),
      move(558, 596, { dx: dx * 0.06, dy: dy * 0.06, rotate: 5, rotY: -6 }, 'linear'),
      move(594, 606, { dx: -dx * 0.8, dy: -dy * 0.8, scaleBy: 0.12, rotY: 70 }, EASE_IN), fadeOut(599, 7),
    ]))
  })
  const S12 = 96
  const w12 = k('line12').split(' ')
  lineUp(w12, S12).forEach((p, i) => {
    const at = 556 + i * 7
    add(text(`${k('title')} 12.${i + 1}`, w12[i], p.left, 540 + 35, S12, i === 0 ? INK : ORANGE, [...cut(at, 606), ...riseIn(at), fadeOut(597, 7)]))
  })
  camTo(545, 562, { s: 1 })
  camTo(562, 596, { s: 0.96 })

  // ===== 13) 606–665: liste görünümü perspektifte belirir, imleç ilk satıra gelir
  reset(606)
  const ROW1 = { x: 870, y: 290 }
  add(image(k('list'), `list-${lang}`, 960, 590, 0, UI_W, [
    ...cut(606, 667), fadeIn(606, 8), move(606, 622, { rotY: 14, rotX: -6, rotate: 4, scaleBy: 1 / 1.2 }, SETTLE), move(622, 660, { rotY: 5, rotX: -2, rotate: 2 }, 'linear'), fadeOut(660, 6),
  ], { rotation: [16, -32, -10], scale: sc(UI_W) * 1.2 * 1.12, position: P(960, 590, -1.35) }))
  add(cursor(1300, 1000, 90, [...cut(620, 667), fadeIn(620, 4), move(620, 646, { dx: ROW1.x - 1300, dy: ROW1.y - 1000 }, GLIDE), ...press(652), fadeOut(660, 5)]))
  camTo(606, 656, { s: 1.06 })
  camTo(656, 665, { x: ROW1.x - 100, y: ROW1.y + 40, s: 2.2 }, EASE_IN)

  // ===== 14) 665–735: iri satır yakın planda sola akar, sağ ucundaki düğme ortaya gelir; imleç tıklar, düğme turuncu olur
  reset(665)
  const ROW_IMG = 2800 // satır 2600 px, görselde 100 px içeride
  const SLIDE = 1500
  const rowSlide = move(666, 696, { dx: -SLIDE }, [0.25, 0.5, 0.2, 1])
  const BTN_W = 760 // görsel; gövde 680 × 180
  // sonunda düğme ortada, satırın sağ kenarı düğme merkezinden 440 px sağda
  const rowX0 = 960 + 440 - 1300 + SLIDE
  const btnX0 = 960 + SLIDE
  add(image(k('row'), `row-${lang}`, rowX0, 540, 0, ROW_IMG, [...cut(665, 726), fadeIn(665, 5), rowSlide, move(716, 728, { dx: -500 }, EASE_IN), fadeOut(714, 9)]))
  const grow = move(718, 728, { scaleBy: 1.22 }, SETTLE)
  const btnOut = [move(733, 741, { scaleBy: 1.8 }, EASE_IN), fadeOut(734, 6)]
  add(tinted(t('layerNames.shadow'), 'button-shadow', ORANGE, btnX0, 540, 0.015, BTN_W, [...cut(714, 742), fadeIn(714, 6), rowSlide, grow, ...btnOut], { opacity: 0.6 }))
  add(tinted(t('layerNames.button'), 'button', INK, btnX0, 540, 0.02, BTN_W, [...cut(665, 721), fadeIn(665, 5), rowSlide, grow]))
  add(tinted(`${t('layerNames.button')} ✦`, 'button', ORANGE, btnX0, 540, 0.03, BTN_W, [...cut(714, 742), fadeIn(714, 5), rowSlide, grow, ...btnOut]))
  const SB = 58
  add(text(k('export'), k('export'), btnX0, 540, SB, '#FFFFFF', [...cut(665, 742), fadeIn(665, 5), rowSlide, grow, fadeOut(733, 5)], { align: 'center', position: P(btnX0, 540 + 0.03 * SB, 0.04) }))
  add(cursor(640, 1040, 150, [...cut(690, 732), fadeIn(690, 4), move(690, 704, { dx: 960 + 110 - 640, dy: 575 - 1040 }, SETTLE), ...press(712), move(720, 731, { dx: 200, dy: -560 }, EASE_IN), fadeOut(724, 6)]))
  camTo(665, 716, { s: 1.03 })

  // ===== 15) 734–799: düğme yıldıza dönüşür. Dev yıldız kadrajı kaplayıp küçülür (referans: 742'de 880 px, 750'de 400,
  // 764'te 240), yukarı çıkıp kavis çizerek satırın sonuna konar; arkasında iz bırakır.
  reset(735)
  const S16 = 84
  const w16 = [k('step1'), k('step2'), k('step3')]
  const line16 = lineUp(w16, S16, 940)
  const STAR = 58
  const starAt = (i: number) => line16[i].right + 50
  const STAR_Y = 540 - 2
  const SIZES = [5200, 880, 400, 240, 120, 100, STAR]
  const spot: [number, number][] = [[960, 540], [960, 540], [960, 540], [1140, 516], [660, 60], [980, 390], [1130, 262]]
  const TURN = [0, -10, -20, 30, -45, 0, 0]
  const hop = (i: number, from: number, to: number, ease: Bezier) => move(from, to, { dx: spot[i][0] - spot[i - 1][0], dy: spot[i][1] - spot[i - 1][1], scaleBy: SIZES[i] / SIZES[i - 1], rotate: TURN[i] }, ease)
  add(tinted(`${t('layerNames.glow')} ✦`, 'glow', ORANGE, 960, 540, 0.04, 1500, [...cut(738, 770), fadeIn(738, 5), move(738, 760, { scaleBy: 0.35 }, 'ease-out'), fadeOut(752, 16)], { opacity: 0.45 }))
  add(tinted(k('trail'), 'trail', ORANGE, 900, 250, 0.045, 620, [...cut(777, 802), fadeIn(777, 7), fadeOut(792, 9)], { opacity: 0.5 }))
  add(tinted(t('layerNames.spark'), 'spark', ORANGE, 960, 540, 0.05, SIZES[0], [
    ...cut(734, 858), fadeIn(734, 9),
    hop(1, 736, 742, [0.2, 0.6, 0.3, 1]), hop(2, 742, 750, GLIDE), hop(3, 750, 764, GLIDE), hop(4, 764, 776, GLIDE), hop(5, 776, 784, GLIDE), hop(6, 784, 792, GLIDE),
    move(792, 799, { dx: starAt(0) - spot[6][0], dy: STAR_Y - spot[6][1], rotate: -45 }, GLIDE),
    move(799, 805, { dx: starAt(1) - starAt(0), rotate: -180 }, GLIDE),
    move(818, 824, { dx: starAt(2) - starAt(1), rotate: -180 }, GLIDE),
    move(824, 852, { rotate: -180 }, 'linear'),
    move(852, 858, { dx: 760 - starAt(2), scaleBy: 0.4 }, EASE_IN), fadeOut(853, 5),
  ]))
  // ===== 16) 786–858: "Prompt. Edit. Export" kelime kelime
  const at16 = [786, 801, 820]
  line16.forEach((p, i) => {
    add(text(`${k('title')} 16.${i + 1}`, w16[i], p.left, 540 + 26, S16, [TANG, ORANGE, INK][i], [...cut(at16[i], 858), ...riseIn(at16[i], 26), fadeOut(851, 6)]))
  })
  camTo(786, 786, { s: 1.1 })
  camTo(786, 850, { s: 1 }, 'ease-out')

  // ===== 17) 851–991: zemin kararır (logo yalnızca koyu zeminde), Mango logosu pop ile gelir, "Mango Studio" harf harf,
  // altta mangostudio.design
  reset(858, 1.05)
  camTo(858, 991, { s: 1 }, 'ease-out')
  add(layer({ name: t('layerNames.background'), kind: 'shape', shape: 'rect', shapeWidth: 60, shapeHeight: 40, color: '#000000', position: [0, 0, -4], blocks: [...cut(851, 991), fadeIn(851, 8)] }))
  const SW = 112
  const WORD = 'Mango Studio'
  const wordW = (em('Mango') + SPACE + em('Studio')) * SW
  const LOGO_INK = 98 // logonun mürekkep genişliği (px)
  const GAP = 30
  const left17 = 960 - (LOGO_INK + GAP + wordW) / 2
  // mango-logo-2048.png: mürekkep 660×976, merkezi (1024, 907) → görsel merkezi mürekkepten 117/2048 yukarıda
  const logoW = LOGO_INK * (2048 / 660)
  add(tinted(`${t('layerNames.glow')} ·`, 'glow', ORANGE, left17 + LOGO_INK / 2, 520, 0, 700, [...cut(858, 991), fadeIn(858, 14)], { opacity: 0.4 }))
  add(layer({ name: t('layerNames.logo'), kind: 'image', color: '#ffffff', image: `${base}brand/mango-logo-2048.png`, position: P(left17 + LOGO_INK / 2, 520 + ((1024 - 907) / 2048) * logoW, 0.02), scale: sc(logoW), blocks: [...cut(858, 991), pop(858, 10)] }))
  add(text(t('layerNames.wordmark'), WORD, left17 + LOGO_INK + GAP, 520, SW, LIGHT, [...cut(862, 991), b('typewriter', F(862), F(13))]))
  const SU = 36
  const dom = [{ text: 'mangostudio', color: LIGHT }, { text: '.design', color: ORANGE }]
  const domW = (em(dom[0].text) + em(dom[1].text)) * SU
  const split = 886 + (20 * dom[0].text.length) / (dom[0].text.length + dom[1].text.length)
  add(text(k('domain'), dom[0].text, 960 - domW / 2, 940, SU, dom[0].color, [...cut(886, 991), b('typewriter', F(886), F(split - 886))]))
  add(text(`${k('domain')} ·`, dom[1].text, 960 - domW / 2 + em(dom[0].text) * SU, 940, SU, dom[1].color, [...cut(split, 991), b('typewriter', F(split), F(906 - split))]))

  return {
    ...project(k('name'), END, BG, layers, camera(camBlocks)),
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
