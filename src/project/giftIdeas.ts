import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { GIFT_EM } from './giftIdeasMetrics'

// "Gift ideas": yatay (1920×1080, 60 kare/sn, 7.1 sn) yılbaşı reklamı. İlk 5 saniyenin hareket dili, yazı ölçüleri ve
// renk paleti 30 kare/sn'lik (1800×1080) bir referanstan kare kare ölçüldü: `F(n)` referansın 0'dan başlayan karesini
// saniyeye çevirir; ekran konumları referans karesinin 1920 genişliğe ortalanmış halinde (x + 60). Kopya değil: kilit
// ekranı, tuşlar, kartlar, simgeler ve kapanış bizim; "Siri" yerine marka adı yazılır. Emojiler Apple emoji görselleri
// (kullanıcı kararı, `public/templates/gift-ideas/emoji`; aynı adlarla başka bir set konabilir).
// Sahneler:
//  1 geriye yatık tutulan telefon, kilit ekranı; kamera telefona sürekli yaklaşır (17–66'da 1.08 → 1.5 kat), telefon
//    hafifçe alçalır. 15'ten itibaren ekran kenarları yanar; tuşlar ve emojiler telefonun üst kenarının ARKASINDAN çıkar,
//    açılıp kameraya doğru durmadan uçar ve kendi etraflarında döner; "hey Mango..." harf harf yazılır, tuşlar yazının
//    önünden geçer (17–66) → kamera telefona dalar, kısa beyaz (66–77)
//  2 tünel: duvarlarına kartlar, tavanına ve tabanına hediyeler dizili; kamera tünelde ilerler (dünya kameraya doğru akar,
//    ilk anda hızlı), kartlar kenarlardan akıp geçer. Ortadaki giriş hapı uzaktan yaklaşıp durur, "Christmas present
//    ideas..." kelime kelime yazılır, sahne yuvarlanır (100–150'de −19°) (77–151)
//  3 beyaza açılıp Mango logosu, "Mango Studio" ve mangostudio.design (151–214)
// Kamera açısı 55° (referansın güçlü perspektifi için). Yazı tipi: SF Pro'nun lisansı gömmeye izin vermediği için Inter.
// Görseller ve yazı genişlikleri: node scripts/build-gift-ideas-assets.mjs. Ses: dört efekt grubu (hava, arayüz, vuruş, ton;
// public/templates/gift-ideas/sfx/*.mp3), referansın ses olaylarına (15 giriş, 74 geçiş, 77 tünel, 152 logo) göre sentezlendi;
// müzik yok, konuşma yok.

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

const FOV = 55
const CAM_Z = 9
const TAN = Math.tan((FOV / 2) * (Math.PI / 180))
/** kameradan `d` uzaklıktaki düzlemde bir pikselin dünya birimi */
const UW = (d: number) => (2 * d * TAN) / 1080
/** kamera yerindeyken (z = 9, hedef merkezde) ekran pikseli → dünya konumu */
const P = (x: number, y: number, z = 0): Vec3 => [(x - 960) * UW(CAM_Z - z), (540 - y) * UW(CAM_Z - z), z]
/** görsel katman ölçeği: `widthPx` genişlikte görünsün (görsel katmanın genişliği 3 × ölçek) */
const sc = (widthPx: number, z = 0) => (widthPx * UW(CAM_Z - z)) / 3
/** referans karesi (30 kare/sn, 0'dan başlar) → saniye */
const F = (n: number) => Math.round((n / 30) * 1e6) / 1e6
const END = F(214)
const DEG = Math.PI / 180

// Renkler (referanstan piksel ölçümüyle; hepsi katman rengi, editörden değişir)
const BG1 = '#DBDCDF'
const BG1_EDGE = '#CFCED0'
const BG2 = '#E4E6ED'
/** tünelin zemini: referansta neredeyse beyaz, hafif mavimsi */
const TUNNEL_BG = '#EDF0F6'
const LILAC = '#B1A7D1'
const INK = '#131314'
const KEY_INK = '#120F0D'
const TILE_PINK = '#F0D8DA'
const TILE_SAND = '#F3E4D0'
const TILE_MIST = '#EFF0EC'
const GLOW_YELLOW = '#F4DC3C'
const GLOW_MAGENTA = '#C93BDB'
/** "Siri..." degradesinin altı dilimi (soldan sağa) */
const GRADIENT = ['#6C76BA', '#975996', '#9C5DA0', '#808CC1', '#906FBA', '#8B75BC']
const PILL = '#F6F6F5'
const PILL_EDGE = '#D6D9E4'
const PROMPT_INK = '#161613'
const BUTTON = '#E0BCDB'
const BUTTON_INK = '#BA92A5'
const MIC = '#9F7CE3'
const LABEL = '#2C5BC8'
const CARD_BLUE = '#0376D3'
const CARD_GREEN = '#3FD9A6'
const CARD_YELLOW = '#DFD172'
const CARD_PURPLE = '#C77DFF'
const CARD_PINK = '#F59BD6'
const BOKEH_BLUE = '#7FC0FF'
const BOKEH_ORANGE = '#FFB07A'

const em = (text: string, weight: 400 | 600 | 700) => {
  const w = GIFT_EM[text]
  const i = weight === 400 ? 0 : weight === 600 ? 1 : 2
  return w ? w[i] : text.length * 0.58
}

/** CSS cubic-bezier eğrisi: ilerleme (0–1) → değer; yerleşim hesaplarında hareket bloklarıyla aynı eğriyi kullanmak için */
function bezier([x1, y1, x2, y2]: Bezier) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3
  return (x: number) => {
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (at(x1, x2, mid) < x) lo = mid
      else hi = mid
    }
    return at(y1, y2, (lo + hi) / 2)
  }
}

/** Euler (derece, three.js XYZ: R = Rx·Ry·Rz) ile yerel vektörü döndürür */
function rotate([ax, ay, az]: Vec3, [x, y, z]: Vec3): Vec3 {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(ax * DEG), Math.sin(ax * DEG), Math.cos(ay * DEG), Math.sin(ay * DEG), Math.cos(az * DEG), Math.sin(az * DEG)]
  const [x1, y1] = [x * cz - y * sz, x * sz + y * cz]
  const [x2, z2] = [x1 * cy + z * sy, -x1 * sy + z * cy]
  return [x2, y1 * cx - z2 * sx, y1 * sx + z2 * cx]
}

/** dönüş matrisinden (satır dizisi) three.js XYZ Euler açıları (derece) */
function eulerXYZ(m: number[][]): Vec3 {
  const y = Math.asin(Math.max(-1, Math.min(1, m[0][2])))
  const [x, z] = Math.abs(m[0][2]) < 0.9999 ? [Math.atan2(-m[1][2], m[2][2]), Math.atan2(-m[0][1], m[0][0])] : [Math.atan2(m[2][1], m[1][1]), 0]
  return [x / DEG, y / DEG, z / DEG]
}

export function buildGiftIdeas({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/gift-ideas/${name}.png`
  const k = (key: string) => t(`templates.gift-ideas.${key}`)

  const ease = (easing: string | Bezier) => (typeof easing === 'string' ? { easing } : { easing: 'custom', bezier: easing })
  /** dünya biriminde hareket ve dönüş */
  const move = (from: number, to: number, p: { dx?: number; dy?: number; dz?: number; rotate?: number; rotX?: number; rotY?: number; scaleBy?: number }, easing: string | Bezier = 'linear') =>
    b('move', F(from), F(to - from), { params: { dx: p.dx ?? 0, dy: p.dy ?? 0, dz: p.dz ?? 0, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, rotY: p.rotY ?? 0, scaleBy: p.scaleBy ?? 1 }, ...ease(easing) })
  const cut = (from: number, to: number) => [b('fade-in', F(from), 0), b('fade-out', F(to), 0)]
  const fadeIn = (from: number, frames: number) => b('fade-in', F(from), F(frames), { easing: 'ease-out' })
  const fadeOut = (from: number, frames: number) => b('fade-out', F(from), F(frames), { easing: 'ease-in' })

  /** dünya konumunda görsel (genişlik dünya biriminde) */
  const image = (name: string, file: string, pos: Vec3, width: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: pos, scale: width / 3, blocks, ...extra })
  const tinted = (name: string, file: string, color: string, pos: Vec3, width: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    image(name, file, pos, width, blocks, { tint: true, color, ...extra })
  /** dünya konumunda metin (yazı boyu dünya biriminde; `align` center ise konum metnin ortası) */
  const text = (name: string, value: string, pos: Vec3, size: number, color: string, weight: 400 | 600 | 700, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'text', text: value, fontFamily: weight === 600 ? 'inter-medium' : 'inter', fontWeight: weight === 400 ? 400 : 700, fontSize: size, textWidth: 60, align: 'left', color, position: pos, blocks, ...extra })

  // --- kamera: mutlak hedef (px: kamera yerindeyken z = 0 düzlemindeki nokta) ve ölçek
  const cam = { x: 960, y: 540, s: 1 }
  const camBlocks: BlockSpec[] = []
  const camTo = (from: number, to: number, target: { x?: number; y?: number; s?: number }, easing: string | Bezier = 'linear') => {
    const dx = (target.x ?? cam.x) - cam.x
    const dy = (target.y ?? cam.y) - cam.y
    const zoom = (target.s ?? cam.s) / cam.s
    Object.assign(cam, target)
    camBlocks.push(b('camera-move', F(from), F(to - from), { params: { dx: dx * UW(CAM_Z), dy: -dy * UW(CAM_Z), zoom }, ...ease(easing) }))
  }

  const layers: Layer[] = []
  const add = (...ls: Layer[]) => layers.unshift(...ls) // sonra eklenen önde
  /** çizim sırası için derinlik (verilmezse katmanın z'si): sonunda yakından uzağa sıralanır */
  const depthKey = new Map<Layer, number>()

  // ================= 1) 0–77: telefon, tuşlar ve "hey Mango..."
  const S1_END = 77
  // kamera: 0–17 hafif (1.08), 17–66 düzgün yaklaşma (1.5 kat, hedef 70 px yukarı), 66–77 telefona dalış
  const CAM1: { from: number; to: number; s0: number; s1: number; y0: number; y1: number }[] = [
    { from: 0, to: 17, s0: 1, s1: 1.08, y0: 540, y1: 540 },
    { from: 17, to: 66, s0: 1.08, s1: 1.5, y0: 540, y1: 470 },
  ]
  for (const c of CAM1) camTo(c.from, c.to, { s: c.s1, y: c.y1 })
  /** sahne 1'de `f` karesindeki kamera: uzaklığı ve hedefi (dünya) */
  const camAt = (f: number) => {
    const c = CAM1.find((x) => f <= x.to) ?? CAM1[CAM1.length - 1]
    const e = Math.max(0, Math.min(1, (f - c.from) / (c.to - c.from)))
    const s = c.s0 + (c.s1 - c.s0) * e
    return { z: CAM_Z / s, ty: (540 - (c.y0 + (c.y1 - c.y0) * e)) * UW(CAM_Z) }
  }
  /** `f` karesinde (sx, sy) ekran pikselinde, `z` derinliğinde görünen dünya noktası */
  const worldAt = (f: number, sx: number, sy: number, z: number): Vec3 => {
    const c = camAt(f)
    const d = c.z - z
    return [(sx - 960) * UW(d), c.ty + (540 - sy) * UW(d), z]
  }
  /** `f` karesinde `z` derinliğinde `px` genişliğinde görünen dünya uzunluğu */
  const widthAt = (f: number, px: number, z: number) => px * UW(camAt(f).z - z)

  // zemin: proje zemini (açık gri, ortası parlak, kenarları koyu: radyal degrade); üstte beyaz pus
  add(tinted(k('layers.glow'), 'glow', '#FFFFFF', P(960, 300, -16), 2600 * UW(25), [...cut(0, S1_END)], { opacity: 0.55 }))

  // telefon: geriye yatık (üst kenar uzakta), hafif sağa eğik. 0. karede üst kenarı y = 320'de, üst genişliği ~600 px;
  // 58. karede üst kenarı y = 420'de (kamera yaklaşırken telefon alçalır)
  const PHONE_ROT: Vec3 = [-38, 0, -2]
  const PHONE_Z = -2
  const topLocal = (scale: number): Vec3 => rotate(PHONE_ROT, [0, (3.5 * scale) / 2, 0])
  let PS = 2
  for (let i = 0; i < 8; i++) PS = (570 * UW(CAM_Z - (PHONE_Z + topLocal(PS)[2]))) / 1.7
  const top0 = topLocal(PS)
  const phoneTop = worldAt(0, 960, 350, PHONE_Z + top0[2])
  const phonePos: Vec3 = [phoneTop[0] - top0[0], phoneTop[1] - top0[1], PHONE_Z]
  const topAt58 = worldAt(58, 960, 450, PHONE_Z + top0[2])
  const sink = (topAt58[1] - phoneTop[1]) * (49 / 41) // 17–66 hareketinin 58. karede 41/49'u tamam
  const phoneMove = move(17, 66, { dy: sink, rotate: 2 })
  add(layer({ name: k('layers.phone'), kind: 'phone', color: '#ffffff', image: img('lockscreen'), deviceFinish: 'space', position: phonePos, rotation: PHONE_ROT, scale: PS, blocks: [...cut(0, S1_END), phoneMove] }))
  // ekran kenarı ışığı (Siri gibi): ekranın hemen önünde, telefonla aynı düzlem ve dönüşte; 15. karede yanar
  {
    const normal = rotate(PHONE_ROT, [0, 0, 1])
    const lift = 0.1 * PS
    const pos: Vec3 = [phonePos[0] + normal[0] * lift, phonePos[1] + normal[1] * lift, phonePos[2] + normal[2] * lift]
    const width = 1.54 * PS * (616 / 560)
    const glow = (name: string, file: string, color: string) =>
      layer({ name, kind: 'image', color, tint: true, image: img(file), position: pos, rotation: PHONE_ROT, scale: width / 3, blocks: [...cut(15, S1_END), fadeIn(15, 8), phoneMove] })
    const glows = [glow(`${k('layers.screenGlow')} 1`, 'glow-left', GLOW_YELLOW), glow(`${k('layers.screenGlow')} 2`, 'glow-right', GLOW_MAGENTA)]
    for (const g of glows) depthKey.set(g, 40) // en son: saydam kenarları derinlik yazıp tuşları kesmesin
    add(...glows)
  }

  // "hey Mango...": telefonun üstünde, tuşların arkasında; harf harf (h 18, e 22, y 25, S 27, i 31, r 34, i 37, noktalar
  // 42–44). 40. karede taban çizgisi y = 310, "hey" ~310 px genişliğinde; kamerayla birlikte büyür.
  const TEXT_Z = PHONE_Z + top0[2] + 0.35
  const HEY_PX = 172
  const size = widthAt(40, HEY_PX, TEXT_Z)
  const hey = k('hey')
  const brand = k('brand')
  const letters = [...hey].map((ch) => ({ ch, color: INK })).concat([{ ch: ' ', color: INK }], [...brand].map((ch, i, all) => ({ ch, color: GRADIENT[Math.min(GRADIENT.length - 1, Math.floor((i / Math.max(1, all.length - 1)) * (GRADIENT.length - 1)))] })))
  const total = letters.reduce((s, l) => s + em(l.ch, 700) * HEY_PX, 0)
  const brandStarts = [27, 31, 34, 37, 39, 42, 43, 44]
  const heyStarts = [18, 22, 25]
  let x = 990 - total / 2
  let typed = 0
  letters.forEach((l, i) => {
    const w = em(l.ch, 700) * HEY_PX
    if (l.ch !== ' ') {
      const isBrand = i > hey.length
      const n = isBrand ? i - hey.length - 1 : i
      const at = isBrand ? (brandStarts[n] ?? 44 + (n - brandStarts.length + 1)) : (heyStarts[n] ?? 18 + n * 3)
      // harf hafif yukarıdan ve büyük başlayıp 5 karede oturur
      const pos = worldAt(40, x + w / 2, 310 - 0.076 * HEY_PX, TEXT_Z)
      const drop = widthAt(40, 14, TEXT_Z)
      const letter = text(`${k('layers.title')} ${++typed}`, l.ch, [pos[0], pos[1] + drop, pos[2]], size, l.color, 700, [...cut(at, S1_END), fadeIn(at, 3), move(at, at + 5, { dy: -drop, scaleBy: 1 / 1.1 }, [0.2, 0.7, 0.3, 1])], { scale: 1.1, align: 'center' })
      // yazı telefonun üst kenarının gerisinde ama ekranda üstünde: telefondan ve ışığından sonra, tuşlardan önce çizilir
      depthKey.set(letter, PHONE_Z + 0.3)
      add(letter)
    }
    x += w
  })

  // tuşlar ve emojiler: 58. karedeki ekran yerleri (px), görünen genişlikleri ve dönüşleri. Her biri telefonun üst kenarının
  // arkasından (yazının ve telefonun gerisinden) çıkar, 12 karede yerine açılır, sonra durmadan kameraya doğru uçar ve döner.
  type Tile = { x: number; y: number; px: number; rot: number; spin: [number, number]; key?: string; emoji?: string; color: string }
  const TILES: Tile[] = [
    { x: 470, y: 320, px: 140, rot: -8, spin: [30, -20], emoji: 'gift', color: TILE_SAND },
    { x: 712, y: 330, px: 145, rot: 22, spin: [45, 10], key: 'r', color: TILE_SAND },
    { x: 982, y: 322, px: 145, rot: -28, spin: [20, 35], emoji: 'gem', color: TILE_PINK },
    { x: 1260, y: 368, px: 170, rot: 0, spin: [-15, -25], key: 'u', color: TILE_PINK },
    { x: 1492, y: 465, px: 150, rot: 12, spin: [25, -30], key: 'i', color: TILE_PINK },
    { x: 405, y: 510, px: 150, rot: -35, spin: [-30, 55], key: 'd', color: TILE_SAND },
    { x: 375, y: 645, px: 160, rot: 0, spin: [15, 25], key: 'a', color: TILE_SAND },
    { x: 532, y: 622, px: 175, rot: -5, spin: [-20, 15], emoji: 'joy', color: TILE_SAND },
    { x: 787, y: 615, px: 175, rot: 8, spin: [20, -15], key: 'f', color: TILE_SAND },
    { x: 1080, y: 532, px: 190, rot: -5, spin: [-25, 20], key: 'g', color: TILE_PINK },
    { x: 1350, y: 622, px: 180, rot: 6, spin: [20, 25], key: 'j', color: TILE_PINK },
    { x: 1582, y: 668, px: 160, rot: 5, spin: [-15, -20], emoji: 'tree', color: TILE_PINK },
    { x: 285, y: 862, px: 175, rot: -4, spin: [10, 40], key: '⇧', color: TILE_MIST },
    { x: 442, y: 885, px: 185, rot: -10, spin: [-25, 20], emoji: 'butterfly', color: TILE_MIST },
    { x: 622, y: 960, px: 210, rot: 0, spin: [20, -15], key: 'x', color: TILE_MIST },
    { x: 990, y: 945, px: 215, rot: 0, spin: [-15, 20], emoji: 'soccer', color: TILE_PINK },
    { x: 1290, y: 908, px: 215, rot: 0, spin: [15, -25], key: 'b', color: TILE_PINK },
    { x: 1680, y: 892, px: 190, rot: 0, spin: [-20, -15], key: '⌫', color: TILE_PINK },
  ]
  const SLIDE: Bezier = [0.4, 0, 0.8, 0.6] // kenardan kayarken hızlanır
  const EMERGE: Bezier = [0.1, 0.45, 0.35, 1] // kayışın hızıyla başlayıp yavaşlar
  const BACK = PHONE_Z + top0[2] - 0.4
  const GROW = 1.9
  /** `f` karesinde (sx, sy) ekran noktasından geçen ışının telefon düzlemini kestiği derinlik */
  const surfaceZ = (f: number, sx: number, sy: number) => {
    const n = rotate(PHONE_ROT, [0, 0, 1])
    const dot = (z: number) => {
      const q = worldAt(f, sx, sy, z)
      return n[0] * (q[0] - phonePos[0]) + n[1] * (q[1] - phonePos[1]) + n[2] * (q[2] - phonePos[2])
    }
    const a = dot(0)
    return a / (a - dot(1)) // dot doğrusal: sıfır noktası
  }
    TILES.forEach((tile, i) => {
    const at = 11 + ((i * 5) % 9) // kenardan çıkış (peek) 16–24
    const peek = at + 5 // kenardan çıktığı an
    const settled = at + 13
    // derinlik: yukarıdakiler uzakta, aşağıdakiler yakında; kameraya fazla yakın olurlarsa yaklaşmayla çok hızlı büyürler
    // (referansta 30 → 58 arası ~1.2 kat)
    const z58 = -1.5 + ((tile.y - 300) / 660) * 1.5
    const zSettled = z58 - 0.7 * ((58 - settled) / 46)
    const speed = (z58 - zSettled) / (58 - settled)
    const goal = worldAt(58, tile.x, tile.y, z58)
    // Doğduğu yer telefonun silüetinin içinde ve gövdenin en uzak noktasının (üst kenar) gerisi: telefon onu derinlikle
    // gizler. 5 karede en yakın kenardan (yan ya da üst) dışarı kayar, sonra kameraya doğru açılır.
    // Telefonun yarı genişliği ekranda üst kenarda (y 330) ~330 px, aşağı indikçe genişler.
    const dx = tile.x - 960
    const side = Math.sign(dx) || 1
    const sy = Math.max(380, Math.min(560, tile.y))
    const half = 330 + (sy - 330) * 0.43
    const fromTop = Math.abs(dx) < 220 && tile.y < 600
    // derinlik: çıktığı satırda telefon yüzeyinin hemen gerisi (üstten çıkanlar için üst kenarın gerisi)
    const back = fromTop ? BACK : surfaceZ(at, 960 + side * half, sy) - 0.8
    const startPos = fromTop ? worldAt(at, 960 + dx * 0.5, 440, back) : worldAt(at, 960 + side * (half - 150), sy, back)
    const peekPos = fromTop ? worldAt(peek, 960 + dx * 0.7, 285, back) : worldAt(peek, 960 + side * (half + 70), sy, back)
    const width = widthAt(58, tile.px, z58)
    const lean = 25 * Math.sign(tile.rot || 1)
    const rot0: Vec3 = [tile.spin[0], tile.spin[1], tile.rot + lean]
    const blocks = [
      ...cut(at, S1_END),
      move(at, peek, { dx: peekPos[0] - startPos[0], dy: peekPos[1] - startPos[1], rotate: -lean * 0.3 }, SLIDE),
      move(peek, settled, { dx: goal[0] - peekPos[0], dy: goal[1] - peekPos[1], dz: zSettled - back, rotX: -tile.spin[0] * 0.6, rotY: -tile.spin[1] * 0.6, rotate: -lean * 0.7, scaleBy: 1 / GROW }, EMERGE),
      // sürekli uçuş ve dönme (dalış bitene kadar)
      move(settled, S1_END, { dz: speed * (S1_END - settled), rotX: tile.spin[0] * 0.5, rotY: tile.spin[1] * 0.6, rotate: tile.rot * 0.4 }),
    ]
    const name = tile.key ? `${k('layers.key')} ${tile.key}` : `${k('layers.emoji')} ${i + 1}`
    // uzaktan çıktığı için GROW kat iri başlar, yerine otururken (EMERGE) normal boyuna iner
    const plate = tinted(name, 'tile', tile.color, startPos, width * GROW, blocks, { rotation: rot0, opacity: 0.9 })
    const face: Vec3 = [startPos[0], startPos[1], startPos[2] + 0.01]
    const front = tile.key ? text(`${name} ·`, tile.key, face, width * 0.46, KEY_INK, 400, blocks, { rotation: rot0, align: 'center', scale: GROW }) : image(`${name} ·`, `emoji/${tile.emoji}`, face, width * 0.5 * GROW, blocks, { rotation: rot0 })
    depthKey.set(plate, z58)
    depthKey.set(front, z58 + 0.01)
    add(plate, front)
  })

  // dalış: kamera telefonun ekranına doğru hızlanarak (66–77), sonra kısa beyaz
  camTo(66, S1_END, { s: 4.2, y: 560 }, [0.55, 0, 0.85, 0.4])
  camBlocks.push(b('fade-white', F(73), F(8)))

  // ================= 2) 77–151: kart tüneli ve giriş hapı
  const S2_FROM = 77
  const S2_END = 151
  camTo(S2_FROM, S2_FROM, { x: 960, y: 540, s: 1 })
  const s2: Layer[] = []
  const add2 = (...ls: Layer[]) => { s2.push(...ls); add(...ls) }
  // dünya kameraya doğru akar: ilk 15 karede hızlı (dalışın devamı), sonra düzgün
  const RUSH: Bezier = [0.25, 0.6, 0.45, 1]
  const rushEase = bezier(RUSH)
  const D1 = 6
  const D2 = 10
  const flowAt = (f: number) => (f <= 92 ? D1 * rushEase(Math.max(0, (f - S2_FROM) / 15)) : D1 + D2 * Math.min(1, (f - 92) / (S2_END - 92)))
  const flow = [move(S2_FROM, 92, { dz: D1 }, RUSH), move(92, S2_END, { dz: D2 })]
  /** z0'dan başlayan öğe kameraya fazla yaklaştığında (kameradan 1.6 birim) kaybolur */
  const until = (z0: number) => {
    for (let f = S2_FROM; f <= S2_END; f++) if (z0 + flowAt(f) > CAM_Z - 1.6) return f
    return S2_END
  }

  // zemin ve ışık: uzakta, akmaz
  add2(tinted(k('layers.background'), 'solid', TUNNEL_BG, [0, 0, -70], 2 * 79 * TAN * 1.9 * (1920 / 1080), [...cut(S2_FROM, S2_END)]))
  // tünelin sonunda parlak beyaz ışık: geniş pus + yoğun çekirdek
  add2(tinted(k('layers.glow'), 'glow', '#FFFFFF', [0, 0.4, -55], 110, [...cut(S2_FROM, S2_END)], { opacity: 1 }))
  add2(tinted(`${k('layers.glow')} ·`, 'glow', '#FFFFFF', [0, 0.3, -45], 40, [...cut(S2_FROM, S2_END)], { opacity: 0.75 }))
  ;[
    [-1, 1], [1, 1], [-1, -1], [1, -1],
  ].forEach(([sx, sy], i) => add2(tinted(`${k('layers.edge')} ${i + 1}`, 'glow', LILAC, [sx * 34, sy * 20, -60], 60, [...cut(S2_FROM, S2_END)], { opacity: 0.45 })))
  add2(tinted(`${k('layers.lights')} 1`, 'bokeh-a', BOKEH_BLUE, [0, 0, -40], 2 * 49 * TAN * 1.9 * (1920 / 1080), [...cut(S2_FROM, S2_END)], { opacity: 0.8 }))
  add2(tinted(`${k('layers.lights')} 2`, 'bokeh-b', BOKEH_ORANGE, [0, 0, -30], 2 * 39 * TAN * 1.9 * (1920 / 1080), [...cut(S2_FROM, S2_END)], { opacity: 0.6 }))
  // tünel: kesiti 2·RX × 2·RY; duvar kartları merkeze döner (sol duvar sağa, sağ duvar sola, tavan aşağı, taban yukarı bakar)
  const RX = 3.5
  const RY = 2.1
  const COLORS = [CARD_BLUE, CARD_GREEN, CARD_YELLOW, CARD_PURPLE, CARD_PINK]
  const KINDS = [
    { emoji: 'sofa', label: 'sofa' }, { emoji: 'soccer', label: 'soccer' }, { emoji: 'headphones', label: 'headphones' },
    { emoji: 'shirt', label: 'clothes' }, { emoji: 'plant', label: 'plants' }, { emoji: 'shoes', label: 'shoes' },
  ]
  let seed = 23
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  type Wall = 'left' | 'right' | 'top' | 'bottom'
  const WALL_ROT: Record<Wall, Vec3> = { left: [0, 72, 0], right: [0, -72, 0], top: [70, 0, 0], bottom: [-74, 0, 0] }
  let cardN = 0
  const card = (wall: Wall, z: number, along: number, w: number) => {
    const i = cardN++
    const [rx, ry, rz] = WALL_ROT[wall]
    const rot: Vec3 = [rx + (rnd() - 0.5) * 10, ry + (rnd() - 0.5) * 12, rz + (rnd() - 0.5) * 10]
    const pos: Vec3 =
      wall === 'left' ? [-RX, along * RY, z] : wall === 'right' ? [RX, along * RY, z] : wall === 'top' ? [along * RX, RY, z] : [along * RX, -RY, z]
    const on = (lx: number, ly: number, lz: number): Vec3 => {
      const v = rotate(rot, [lx * w, ly * w, lz * w])
      return [pos[0] + v[0], pos[1] + v[1], pos[2] + v[2]]
    }
    const gone = until(z)
    if (gone <= S2_FROM + 1) return
    const blocks = [...cut(S2_FROM, gone), ...flow]
    const name = `${k('layers.card')} ${i + 1}`
    const kind = KINDS[i % KINDS.length]
    // renkli arka levha tünel duvarına doğru taşar
    const out = wall === 'left' ? -1 : wall === 'right' ? 1 : 0
    const outY = wall === 'top' ? 1 : wall === 'bottom' ? -1 : 0
    // renkli ışıma: arka levhanın rengini duvara yayar (referansta levhalar ışık saçıyor)
    add2(tinted(`${name} ✧`, 'glow', COLORS[i % COLORS.length], on(0.22 * out, 0.12 * outY, -0.12), w * 2.3, blocks, { rotation: rot, opacity: 0.5 }))
    add2(tinted(`${name} ·`, 'card', COLORS[i % COLORS.length], on(0.1 * out, 0.06 * outY - 0.03, -0.04), w * 1.04 * (320 / 300), blocks, { rotation: rot }))
    add2(tinted(name, 'card', '#FFFFFF', pos, w * (320 / 300), blocks, { rotation: rot }))
    add2(image(`${name} ✦`, `emoji/${kind.emoji}`, on(0, 0.1, 0.02), w * 0.42, blocks, { rotation: rot }))
    add2(text(`${name} ·`, k(`cards.${kind.label}`), on(0, -0.27, 0.02), w * 0.11, LABEL, 600, blocks, { rotation: rot, align: 'center' }))
  }
  // her duvarda derinlik boyunca dizili kartlar (yakından uzağa); tavanda ve tabanda daha seyrek
  for (let z = 1; z > -34; z -= 2.1) {
    card('left', z - rnd() * 1.2, rnd() > 0.5 ? 0.45 : -0.45, 1.3 + rnd() * 0.5)
    card('right', z - 1 - rnd() * 1.2, rnd() > 0.5 ? 0.45 : -0.45, 1.3 + rnd() * 0.5)
    if (rnd() > 0.35) card('top', z - 0.6 - rnd(), (rnd() - 0.5) * 1.4, 1.1 + rnd() * 0.4)
    if (rnd() > 0.35) card('bottom', z - 1.8 - rnd(), (rnd() - 0.5) * 1.3, 1.4 + rnd() * 0.5)
  }
  // tavandan sarkan ve tabanda duran hediyeler
  for (let z = -1; z > -30; z -= 4.3) {
    const top = rnd() > 0.4
    const gz = z - rnd() * 2
    const gone = until(gz)
    if (gone <= S2_FROM + 1) continue
    const pos: Vec3 = [(rnd() - 0.5) * RX * 1.4, top ? RY * 0.78 : -RY * 0.82, gz]
    add2(image(`${k('layers.gift')} ${Math.round(-z)}`, 'emoji/gift', pos, 0.55 + rnd() * 0.25, [...cut(S2_FROM, gone), ...flow, b('float', F(S2_FROM), F(S2_END - S2_FROM), { params: { amount: 0.06, cycles: 1 } })]))
  }
  // ışık çizgileri: tünel boyunca uzanan ince çizgiler, yüzleri eksene dönük; dünyadan biraz hızlı akar (hız hissi).
  // En son çizilir (derinlik sırası `depthKey`), böylece saydam kenarları kartları kesmez.
  for (let n = 0; n < 22; n++) {
    const th = rnd() * Math.PI * 2
    const r = 0.55 + rnd() * 0.45
    const L = 5 + rnd() * 5
    const z0 = -32 + rnd() * 26
    const extra = 5
    const c = Math.cos(th)
    const sn = Math.sin(th)
    const rot = eulerXYZ([[0, sn, c], [0, -c, sn], [1, 0, 0]])
    let gone = S2_END
    for (let f = S2_FROM; f <= S2_END; f++) if (z0 + L / 2 + flowAt(f) + (extra * (f - S2_FROM)) / (S2_END - S2_FROM) > CAM_Z - 1.2) { gone = f; break }
    if (gone <= S2_FROM + 2) continue
    const streak = tinted(`${k('layers.streak')} ${n + 1}`, 'streak', '#FFFFFF', [c * RX * r, sn * RY * r, z0], L, [...cut(S2_FROM, gone), fadeIn(S2_FROM, 6), ...flow, move(S2_FROM, S2_END, { dz: extra })], { rotation: rot, opacity: 0.55 + rnd() * 0.35 })
    depthKey.set(streak, 50 + z0 * 0.01)
    add2(streak)
  }
  // parıltılar: ekranı kaplayan parıltı katmanları derinliğe dizili, dünyayla birlikte kameraya akar (noktalar dışa saçılır);
  // kameraya çok yaklaşınca söner. En son çizilir.
  ;[-52, -44, -36, -28, -20, -12, -4].forEach((z0, n) => {
    const kind = n % 3
    const file = kind === 1 ? 'glitter-b' : 'glitter-a'
    const color = kind === 0 ? BOKEH_BLUE : kind === 1 ? BOKEH_ORANGE : '#FFFFFF'
    const gone = until(z0)
    if (gone <= S2_FROM + 4) return
    const blocks = [...cut(S2_FROM, gone), fadeIn(S2_FROM, 5), ...(gone < S2_END ? [fadeOut(gone - 8, 8)] : []), ...flow]
    const sparkle = tinted(`${k('layers.lights')} ${n + 3}`, file, color, [0, 0, z0], 2 * (CAM_Z - z0) * TAN * (1920 / 1080) * 1.15, blocks, { opacity: kind === 2 ? 0.85 : 0.95 })
    depthKey.set(sparkle, 100 + z0 * 0.01)
    add2(sparkle)
  })

  // giriş hapı: uzaktan yaklaşıp 106'da durur (kameradan 6.5 birim, tünel duvarlarının içinde); 77–98 mikrofon, 99'dan kelime kelime yazı
  // (Christmas 99, present 105, ideas... 110); düğme altında
  const PILL_D = 6.5
  const pillZ0 = CAM_Z - PILL_D - 14
  const pillMove = [move(S2_FROM, 106, { dz: 14 }, [0.3, 0.55, 0.4, 1]), move(106, S2_END, { dz: 0.3 })]
  const u = UW(PILL_D) // hap ölçüsü: duruş uzaklığında 1 px
  const PILL_ROT = -1
  const at2 = (ox: number, oy: number, dz = 0): Vec3 => {
    const a = PILL_ROT * DEG
    return [(ox * Math.cos(a) - oy * Math.sin(a)) * u, (60 + ox * Math.sin(a) + oy * Math.cos(a)) * u, pillZ0 + dz]
  }
  const prot: Vec3 = [0, 0, PILL_ROT]
  // hap grubu kartlardan ve ışık çizgilerinden sonra, parıltılardan önce çizilir (parıltı düzlemleri ekranı kaplar): halenin saydam köşeleri derinlik yazıp
  // arkadan akan kartları kare biçiminde kesiyordu. Grubun içindeki sıra ekleme sırası.
  let pillOrder = 0
  const addPill = (...ls: Layer[]) => { for (const l of ls) depthKey.set(l, 90 + pillOrder++ * 0.001); add2(...ls) }
  addPill(tinted(`${k('layers.input')} ✧`, 'glow', '#FFFFFF', at2(0, -50, -0.06), 1100 * u, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot, opacity: 0.6 }))
  // ince gri-leylak kenar: beyaz hap parlak zeminden ayrılsın (referanstaki cam kenarı)
  addPill(tinted(`${k('layers.input')} ·`, 'pill', PILL_EDGE, at2(0, -3, -0.03), 925 * u, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot }))
  addPill(tinted(k('layers.input'), 'pill', PILL, at2(0, 0), 909 * u, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot }))
  addPill(tinted(k('layers.mic'), 'mic', MIC, at2(0, 0, 0.02), 70 * u, [...cut(S2_FROM, 99), fadeOut(95, 4), ...pillMove], { rotation: prot }))
  const PROMPT_PX = 51
  const words = k('prompt').split(' ')
  const wordAt = [99, 105, 110]
  const space = em(' ', 600) * PROMPT_PX
  const promptW = words.reduce((s, w) => s + em(w, 600) * PROMPT_PX, 0) + space * (words.length - 1)
  let off = -promptW / 2
  words.forEach((w, i) => {
    const ww = em(w, 600) * PROMPT_PX
    const at = wordAt[i] ?? 110 + (i - 2) * 4
    addPill(text(`${k('layers.prompt')} ${i + 1}`, w, at2(off, 0, 0.03), PROMPT_PX * u, PROMPT_INK, 600, [...cut(at, S2_END), fadeIn(at, 4), ...pillMove], { rotation: prot }))
    off += ww + space
  })
  addPill(tinted(k('layers.button'), 'button', BUTTON, at2(0, -142, 0.01), 515 * u, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot, opacity: 0.9 }))
  const BTN_PX = 30
  const btnText = k('button')
  const btnW = em(btnText, 400) * BTN_PX
  addPill(image(k('layers.sparkle'), 'sparkle', at2(-btnW / 2 - 14, -142, 0.03), 40 * u, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot }))
  addPill(text(k('layers.buttonText'), btnText, at2(-btnW / 2 + 18, -142, 0.03), BTN_PX * u, BUTTON_INK, 400, [...cut(S2_FROM, S2_END), ...pillMove], { rotation: prot }))

  // sahne yuvarlanması (kamera ekseni çevresinde): her katman merkez etrafında döner; 100–150 arasında −19°
  const ROLL: [number, number, number][] = [
    [100, 125, -6],
    [125, 150, -13],
  ]
  for (const l of s2) {
    let [wx, wy] = l.position
    for (const [from, to, deg] of ROLL) {
      const a = deg * DEG
      const nx = wx * Math.cos(a) - wy * Math.sin(a)
      const ny = wx * Math.sin(a) + wy * Math.cos(a)
      l.blocks.push({ ...move(from, to, { dx: nx - wx, dy: ny - wy, rotate: deg }, 'ease-in'), id: `${l.id}-roll-${from}` })
      ;[wx, wy] = [nx, ny]
    }
  }
  camBlocks.push(b('fade-white', F(147), F(8)))

  // ================= 3) 151–214: Mango logosu, "Mango Studio", mangostudio.design
  const S3 = 151
  camTo(S3, S3, { x: 960, y: 540, s: 1.06 })
  camTo(S3, 214, { s: 1 }, 'ease-out')
  add(tinted(k('layers.background'), 'solid', BG2, P(960, 540, -6), 1920 * 2.2 * UW(15), [...cut(S3, 214)]))
  ;[
    [-80, 120], [2000, 160], [-60, 980], [1980, 1000],
  ].forEach(([gx, gy], i) => add(tinted(`${k('layers.edge')} ${i + 1}`, 'glow', LILAC, P(gx, gy, -4.5), 1500 * UW(13.5), [...cut(S3, 214)], { opacity: 0.6 })))
  add(tinted(`${k('layers.lights')} 1`, 'bokeh-a', BOKEH_BLUE, P(960, 540, -2), 1920 * 1.25 * UW(11), [...cut(S3, 214), move(S3, 214, { dy: 30 * UW(11) })], { opacity: 0.45 }))
  const SW = 112
  const word = k('wordmark')
  const wordW = em(word, 700) * SW
  const LOGO_INK = 98
  const GAP = 30
  const left = 960 - (LOGO_INK + GAP + wordW) / 2
  const logoW = LOGO_INK * (2048 / 660)
  const u3 = UW(CAM_Z)
  add(tinted(k('layers.glow'), 'glow', '#FFFFFF', P(left + LOGO_INK / 2, 525, 0), 620 * u3, [...cut(S3, 214), fadeIn(S3, 14)], { opacity: 0.7 }))
  add(layer({ name: k('layers.logo'), kind: 'image', color: '#ffffff', image: `${base}brand/mango-logo-2048.png`, position: P(left + LOGO_INK / 2, 520 + ((1024 - 907) / 2048) * logoW, 0.02), scale: sc(logoW, 0.02), blocks: [...cut(S3 + 2, 214), b('pop', F(S3 + 2), F(10))] }))
  // troika metni satır kutusunun ortasına hizalar: mürekkep ortası için 0.15 em aşağı
  const line = (x: number, y: number, px: number, z = 0.02) => P(x, y + 0.15 * px, z)
  add(text(k('layers.wordmark'), word, line(left + LOGO_INK + GAP, 520, SW), SW * UW(CAM_Z - 0.02), INK, 700, [...cut(S3 + 6, 214), b('typewriter', F(S3 + 6), F(13))]))
  const SU = 36
  const dom = [
    { text: 'mangostudio', color: INK },
    { text: '.design', color: GRADIENT[2] },
  ]
  const domW = (em(dom[0].text, 600) + em(dom[1].text, 600)) * SU
  add(text(k('layers.domain'), dom[0].text, line(960 - domW / 2, 650, SU), SU * UW(CAM_Z - 0.02), dom[0].color, 600, [...cut(S3 + 22, 214), b('typewriter', F(S3 + 22), F(12))]))
  add(text(`${k('layers.domain')} ·`, dom[1].text, line(960 - domW / 2 + em(dom[0].text, 600) * SU, 650, SU), SU * UW(CAM_Z - 0.02), dom[1].color, 600, [...cut(S3 + 34, 214), b('typewriter', F(S3 + 34), F(7))]))

  layers.sort((a, c) => (depthKey.get(c) ?? c.position[2]) - (depthKey.get(a) ?? a.position[2]))
  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: `${base}templates/gift-ideas/sfx/${group}.mp3`,
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  const cameraTrack = { ...camera(camBlocks), fov: FOV }
  return {
    ...project(k('name'), END, BG1, layers, cameraTrack),
    audio: sfx,
    fps: 60,
    backgroundStyle: 'radial',
    background2: BG1_EDGE,
    lighting: 'studio',
    accentLight: '#E6E0FF',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: true, intensity: 0.25, threshold: 0.95 },
      vignette: { enabled: false, darkness: 0.35 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
