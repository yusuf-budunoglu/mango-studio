import i18n from '../i18n'
import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { STORY_EM } from './productStoryMetrics'

// "Product story": yatay (1920×1080, 60 kare/sn, 20.8 sn) ürün tanıtım filmi; Mango Studio'yu anlatır. Temposu ve hareket
// dili 24 kare/sn'lik bir SaaS lansman filminin 17–37. saniyeleri arasından (kaynak kareleri 412–898) kare kare ölçüldü:
// `R(r)` kaynak karesini (24 kare/sn) şablon saniyesine çevirir, ölçüler 1920×1080 pikseli. Aynı filmin 5–16. saniyesinden
// yapılan `hidden-gem` ile aynı renk düzeni (referansınki: mavi-lila). Kopya değil: metinler, arayüzler, oda, grafikler ve
// logo bizim. Sahneler (kesmeler kaynak karesiyle):
//  1 mavi oda: laptop süzülür, kamera "dolly zoom" (pencere küçülür, laptop büyür), kurdeleler (412–455)
//  2 krem: "The studio for" → "motion design" kelime kelime bulanıktan; değerlendirme kartı yükselir, savrularak çıkar (456–543)
//  3 yatık stüdyo paneli, grafikler büyür, "Preview every scene at a glance" (544–598)
//  4 bulutlu turuncu: "And generate" (599–616)        5 yakın plan düğme, netlik soldan sağa kayar (617–640)
//  6 senaryo penceresinde yazılan metin, yakın plan (641–682)
//  7 pencere yandan döner, iki panel ve "from first idea" (683–759)    8 gece: "final render" (760–786)
//  9 istem kutusu yakın plan → geniş (787–812)      10 sahne asistanı kartı (813–840)
// 11 gece: "turn" "ideas" "into" (841–860)          12 krem: "motion" (861–886)      13 logo (887–911)
// Kamera hiç oynamaz: bütün hareket katmanlarda (letterbox şeritleri ekrana sabit kalsın). 3D gruplar (kart + yazılar
// birlikte dönerken) matrisle hesaplanıp kare kare `move` bloklarına çevrilir.
// Görseller ve yazı genişlikleri: node scripts/build-product-story-assets.mjs. Ses: dört efekt grubu
// (public/templates/product-story/sfx/*.mp3). Konuşma ve müzik yok.

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

const W = 1920
const H = 1080
const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / H
/** z derinliğindeki katmanın z = 0'daki gibi görünmesi için konum ve ölçek çarpanı (kamera z = 9) */
const depth = (z: number) => (9 - z) / 9
/** ekran pikseli + derinlik → sahne konumu (o derinlikte aynı yerde görünür) */
const P = (x: number, y: number, z = 0): Vec3 => [(x - W / 2) * U * depth(z), (H / 2 - y) * U * depth(z), z]
const FIRST = 412
/** kaynak karesi (24 kare/sn; 412 = şablonun başı) → saniye; mikro saniyeye yuvarlanır */
const R = (r: number) => Math.round(((r - FIRST) / 24) * 1e6) / 1e6
/** tek anda olan değişiklikler (kesme, belirme) karenin bir kıl öncesinde: yuvarlama yüzünden kare kaçmasın */
const AT = (r: number) => Math.max(0, R(r) - 2e-6)
const LAST = 911
const END = R(LAST)
const RAD = Math.PI / 180
/**
 * Zemin dikdörtgenleri ve ışık lekeleri çok geride durur: saydam pikseller de derinliğe yazdığı için z ≈ 0 civarındaki bir ışık
 * görseli, arkaya dönen panel kenarlarını ve uzaktan uçarak gelen kartı kesiyordu. `at` boyutu derinliğe göre büyütür.
 */
const BACK = -14
const LIGHTS = -12

// Renkler (hepsi katman rengi; editörden değişir). Referansın renk düzeni korundu (aynı filmden yapılan `hidden-gem` gibi):
// açık gri zemin, mavi-lila ışık, mavi bulutlu zemin, koyu ara kartlar; Mango logosu kendi renginde.
const PAPER = '#EEEEF0'
const NIGHT = '#222126'
const ACCENT = '#5B64DB'
const ACCENT_DEEP = '#4E59D5'
const CLOUD_LIGHT = '#759BDC'
const CLOUD_MID = '#6987DB'
const LILAC = '#A9AEE5'
const INK = '#2E2E33'
const SOFT_INK = '#323237'
const MUTED_INK = '#55555C'
const WHITE = '#FFFFFF'
const LIGHT = '#F0F0F2'
const BUTTON = '#36363C'
// oda (1. sahne): beyaz çizilmiş görseller bu renklere boyanır
const SKY = '#D7DEE6'
const WALL = '#4A6CC8'
const FLOOR = '#8EA9E0'
const PILLAR = '#4367BE'
const PLINTH = '#DCE5F7'
const RIBBON = '#E4EBFB'

type Key = [number, number]
/** ölçülen anahtar noktalardan geçen düzgün eğri (Catmull-Rom); uçların dışında ilk / son değerde kalır */
function curve(keys: Key[]) {
  const slope = (j: number) => {
    const a = keys[Math.max(0, j - 1)]
    const c = keys[Math.min(keys.length - 1, j + 1)]
    return (c[1] - a[1]) / (c[0] - a[0])
  }
  return (f: number) => {
    if (f <= keys[0][0]) return keys[0][1]
    const last = keys[keys.length - 1]
    if (f >= last[0]) return last[1]
    let i = 0
    while (keys[i + 1][0] < f) i++
    const [f0, v0] = keys[i]
    const [f1, v1] = keys[i + 1]
    const h = f1 - f0
    const u = (f - f0) / h
    const m0 = slope(i) * h
    const m1 = slope(i + 1) * h
    return (2 * u ** 3 - 3 * u ** 2 + 1) * v0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * v1 + (u ** 3 - u ** 2) * m1
  }
}
/** iki anahtar arasında bezier biçimli geçiş (x zaman, y ilerleme); dışında uç değerler */
const ease = (a: Key, b: Key, bz: Bezier) => {
  const solve = (x: number) => {
    let t = x
    for (let k = 0; k < 24; k++) {
      const cx = 3 * bz[0] * t * (1 - t) ** 2 + 3 * bz[2] * t ** 2 * (1 - t) + t ** 3
      const dx = 3 * bz[0] * (1 - t) ** 2 + 6 * (bz[2] - bz[0]) * t * (1 - t) + 3 * (1 - bz[2]) * t ** 2
      if (Math.abs(cx - x) < 1e-7 || Math.abs(dx) < 1e-7) break
      t -= (cx - x) / dx
    }
    return 3 * bz[1] * t * (1 - t) ** 2 + 3 * bz[3] * t ** 2 * (1 - t) + t ** 3
  }
  return (f: number) => (f <= a[0] ? a[1] : f >= b[0] ? b[1] : a[1] + (b[1] - a[1]) * solve((f - a[0]) / (b[0] - a[0])))
}
const OUT: Bezier = [0.2, 0.75, 0.3, 1]

/** sayfa görsellerindeki saydam pay (hale ışığı için) ve görsel genişlikleri (gövde + 2 pay; betikteki `M` ile aynı) */
const PAD = 160
const PANEL_W = { review: 1666 + 2 * PAD, dashboard: 2200 + 2 * PAD, board: 1500 + 2 * PAD, assistant: 900 + 2 * PAD }

// ---------------------------------------------------------------- 3D: dönüş matrisleri (three.js Euler XYZ: R = Rx·Ry·Rz)
type M3 = [number, number, number, number, number, number, number, number, number]
const mul = (a: M3, b: M3): M3 => [
  a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
  a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
  a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
]
const rotation = ([x, y, z]: Vec3): M3 => {
  const [a, b, c] = [x * RAD, y * RAD, z * RAD]
  const rx: M3 = [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)]
  const ry: M3 = [Math.cos(b), 0, Math.sin(b), 0, 1, 0, -Math.sin(b), 0, Math.cos(b)]
  const rz: M3 = [Math.cos(c), -Math.sin(c), 0, Math.sin(c), Math.cos(c), 0, 0, 0, 1]
  return mul(mul(rx, ry), rz)
}
const euler = (m: M3): Vec3 => {
  const y = Math.asin(Math.max(-1, Math.min(1, m[2])))
  if (Math.abs(m[2]) < 0.9999999) return [Math.atan2(-m[5], m[8]) / RAD, y / RAD, Math.atan2(-m[1], m[0]) / RAD]
  return [Math.atan2(m[7], m[4]) / RAD, y / RAD, 0]
}
const apply = (m: M3, v: Vec3): Vec3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180

/** Katmanın o andaki dünya duruşu: konum (sahne birimi), dönüş (derece, Euler XYZ), ölçek. */
interface World { p: Vec3; r: Vec3; s: number }
/** ekran duruşu → dünya: (x, y) piksel, z derinlik; ölçek o derinlikte aynı boyda görünsün diye `depth` ile çarpılır */
const at = (x: number, y: number, z = 0, r: Vec3 = [0, 0, 0], s = 1): World => ({ p: P(x, y, z), r, s: s * depth(z) })
/**
 * Grup dönüşümü: pivot (ekran pikseli, z derinliği) etrafında `r` kadar döner ve (tx, ty piksel, tz birim) kayar. Çocuğun
 * dünya duruşu grup dönüşümünden geçirilir (konum pivota göre döner, dönüşler matrisle birleşir).
 */
interface Rig { x: number; y: number; z?: number; r: Vec3; tx?: number; ty?: number; tz?: number }
const rigged = (g: Rig, child: World): World => {
  const pivot = P(g.x, g.y, g.z ?? 0)
  const m = rotation(g.r)
  const v: Vec3 = [child.p[0] - pivot[0], child.p[1] - pivot[1], child.p[2] - pivot[2]]
  const w = apply(m, v)
  return {
    p: [pivot[0] + w[0] + (g.tx ?? 0) * U, pivot[1] + w[1] - (g.ty ?? 0) * U, pivot[2] + w[2] + (g.tz ?? 0)],
    r: euler(mul(m, rotation(child.r))),
    s: child.s,
  }
}
/** düzlemdeki bir noktanın dünya duruşu: düzlem `plane` (merkez), nokta yerelde (dx, dy piksel, düzlem ölçeği 1'de) ve dz */
const onPlane = (plane: World, dx: number, dy: number, dz = 0, own = 1): World => {
  const m = rotation(plane.r)
  const v = apply(m, [dx * U * plane.s, -dy * U * plane.s, dz])
  return { p: [plane.p[0] + v[0], plane.p[1] + v[1], plane.p[2] + v[2]], r: plane.r, s: plane.s * own }
}
/** Kesintisiz hareket parçası (kaynak kareleriyle); parçalar arasında duruş tek anda değişir. `step` kaynak karesi. */
interface Section { from: number; to: number; pose: (r: number) => World; step?: number }

/** kelimenin ilerleme genişliği (em): 0 = Inter 400 (500 için de), 1 = Inter 600, 2 = Fraunces 700 */
const em = (word: string, weight: 0 | 1 | 2 = 0) => STORY_EM[word]?.[weight] ?? word.length * 0.55
const SPACE = (weight: 0 | 1 | 2 = 0) => STORY_EM[' '][weight]
/** troika metni satır kutusunun ortasından hizalar; büyük harflerin ortası 0.18 em yukarıda kalır */
const TEXT_DROP = 0.18
/** cümleyi ortalayıp her kelimenin sol kenarını verir (kelimeler ayrı ağırlıkta olabilir) */
const layout = (words: { text: string; weight: 0 | 1 | 2; size: number }[], cx: number) => {
  const widths = words.map((w) => em(w.text, w.weight) * w.size)
  const gaps = words.map((w) => SPACE(w.weight === 2 ? 0 : w.weight) * w.size)
  const total = widths.reduce((s, w) => s + w, 0) + gaps.slice(0, -1).reduce((s, g) => s + g, 0)
  let x = cx - total / 2
  return words.map((_, i) => {
    const left = x
    x += widths[i] + gaps[i]
    return left
  })
}

export function buildProductStory({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const file = (name: string) => `${base}templates/product-story/${name}`
  const lang: 'en' | 'tr' = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.product-story.${key}`)
  const words = (key: string) => k(key).split(' ')

  const cut = (from: number, to: number) => [b('fade-in', AT(from), 0), b('fade-out', AT(to), 0)]
  const fadeIn = (from: number, frames: number) => b('fade-in', R(from), R(FIRST + frames), { easing: 'linear' })
  const fadeOut = (from: number, frames: number) => b('fade-out', R(from), R(FIRST + frames), { easing: 'linear' })
  const blurIn = (from: number, frames: number, amount: number) => b('blur-in', R(from), R(FIRST + frames), { easing: 'ease-out', params: { amount } })
  const blurOut = (from: number, frames: number, amount: number) => b('blur-out', R(from), R(FIRST + frames), { easing: 'ease-in', params: { amount } })

  /** dünya duruşlarını `move` bloklarına çevirir; parçalar arasındaki geçiş tek anda (0 sn) olur */
  const poseBlocks = (sections: Section[]): BlockSpec[] => {
    const out: BlockSpec[] = []
    const delta = (p: World, q: World) => ({
      dx: q.p[0] - p.p[0], dy: q.p[1] - p.p[1], dz: q.p[2] - p.p[2],
      rotX: wrap(q.r[0] - p.r[0]), rotY: wrap(q.r[1] - p.r[1]), rotate: wrap(q.r[2] - p.r[2]), scaleBy: q.s / p.s,
    })
    const still = (d: ReturnType<typeof delta>) =>
      Math.abs(d.dx) < 1e-7 && Math.abs(d.dy) < 1e-7 && Math.abs(d.dz) < 1e-7 && Math.abs(d.rotX) < 1e-6 && Math.abs(d.rotY) < 1e-6 && Math.abs(d.rotate) < 1e-6 && Math.abs(d.scaleBy - 1) < 1e-7
    const clean = (d: ReturnType<typeof delta>) => {
      // `dx`in varsayılanı 1 (diğerlerinin 0 / 1 çarpan): her blokta açıkça yazılır, sıfır olan diğerleri atlanır
      const params: Record<string, number> = { dx: d.dx }
      for (const [key, v] of Object.entries(d)) if (key === 'scaleBy' ? Math.abs(v - 1) > 1e-9 : Math.abs(v) > 1e-9) params[key] = v
      return params
    }
    sections.forEach((section, i) => {
      if (i > 0) {
        const prev = sections[i - 1]
        const jump = delta(prev.pose(prev.to), section.pose(section.from))
        if (!still(jump)) out.push(b('move', AT(section.from), 0, { params: clean(jump) }))
      }
      const step = section.step ?? 1
      const closing = i === sections.length - 1
      for (let f = section.from; f < section.to - 1e-9; ) {
        let g = Math.min(section.to, f + step)
        // son parçada bitişten bir önceki kare sınırı atlanır: `fitClip` o sınırda biten blokta klibi bitiriyordu
        if (closing && section.to - g < 1 - 1e-9 && g < section.to) g = section.to
        const d = delta(section.pose(f), section.pose(g))
        if (!still(d)) out.push(b('move', R(f), R(FIRST + (g - f)), { params: clean(d), easing: 'linear' }))
        f = g
      }
    })
    return out
  }
  /** ilk duruşunda yerleştirilmiş, duruşlarını izleyen katman; `size` katmanın ölçek 1'deki çarpanı */
  const tracked = (spec: Omit<LayerSpec, 'position' | 'blocks' | 'rotation' | 'scale'>, sections: Section[], extra: BlockSpec[] = [], size = 1) => {
    const first = sections[0].pose(sections[0].from)
    const last = sections[sections.length - 1]
    return layer({
      ...spec,
      position: first.p,
      rotation: first.r,
      scale: size * first.s,
      blocks: [...cut(sections[0].from, last.to), ...poseBlocks(sections), ...extra],
    })
  }
  const still = (from: number, to: number, pose: World): Section[] => [{ from, to, pose: () => pose }]
  /** görsel 3 birim genişliğinde çizilir: kadrajdaki genişliği (px, ölçek 1'de) verilir */
  const image = (name: string, src: string, widthPx: number, sections: Section[], extra: BlockSpec[] = [], more: Partial<LayerSpec> = {}) =>
    tracked({ name, kind: 'image', color: WHITE, image: src, ...more }, sections, extra, (widthPx * U) / 3)
  const rect = (name: string, w: number, h: number, color: string, sections: Section[], extra: BlockSpec[] = [], kind: 'rect' | 'rounded' = 'rect') =>
    tracked({ name, kind: 'shape', shape: kind, shapeWidth: w * U, shapeHeight: h * U, color }, sections, extra)
  /** yazı (sol kenar hizalı): `size` px, ağırlık 400 / 500 / 600 / 700 ya da Fraunces 700; duruş satırın sol ucu ve büyük harf ortası */
  const text = (name: string, value: string, size: number, weight: 400 | 500 | 600 | 700 | 'serif', color: string, sections: Section[], extra: BlockSpec[] = []) => {
    const family = weight === 'serif' ? 'fraunces' : weight === 400 ? 'inter' : weight === 700 ? 'inter' : 'inter-medium'
    const bold = weight === 'serif' || weight === 700 || weight === 600
    return tracked(
      { name, kind: 'text', text: value, fontFamily: family, fontWeight: bold ? 700 : 400, fontSize: size * U, textWidth: 60, align: 'left', color },
      // satır ortası büyük harf ortasından 0.18 em aşağıda: yerel y ekseninde kaydırılır (dönmüş düzlemde de doğru yönde)
      sections.map((section) => ({ ...section, pose: (r: number) => { const w = section.pose(r); return onPlane({ ...w, s: w.s }, 0, TEXT_DROP * size) } })),
      extra,
    )
  }

  const layers: Layer[] = []
  /** sona eklenen katman listede arkada kalır: önce öndekiler eklenir */
  const add = (...items: Layer[]) => layers.push(...items)

  // ---------------------------------------------------------------- letterbox (1., 5. ve 6. sahne): ekrana sabit şeritler
  {
    const bar = (name: string, y: number, from: number, to: number) => rect(name, 2400, 132, '#000000', still(from, to, at(960, y, 6)))
    add(bar(`${k('letterbox')} 1`, 66, FIRST, 456), bar(`${k('letterbox')} 2`, 1014, FIRST, 456))
    add(bar(`${k('letterbox')} 3`, 66, 617, 683), bar(`${k('letterbox')} 4`, 1014, 617, 683))
  }

  // ---------------------------------------------------------------- 13) logo (887–910)
  {
    add(text(k('domain'), 'mangostudio.design', 30, 500, LIGHT, still(887, LAST, at(960 - (em('mangostudio.design') * 30) / 2, 640, 0.02)), [blurIn(889, 6, 0.06)]))
    add(image(k('logo'), `${base}brand/mango-mark.png`, 150, still(887, LAST, at(960, 530, 0.02)), [blurIn(887, 5, 0.12), b('move', R(887), R(FIRST + 23), { params: { dx: 0, scaleBy: 1.06 }, easing: 'linear' })]))
    add(image(k('logoGlow'), file('glow.png'), 420, still(887, LAST, at(960, 530, 0.01)), [fadeIn(887, 6)], { tint: true, color: ACCENT, opacity: 0.3 }))
    add(rect(k('nightBg'), 2400, 1400, NIGHT, still(887, LAST, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 12) "motion" (861–886)
  {
    const word = k('closing')
    const SIZE = 160
    const left = 961 - (em(word, 1) * SIZE * 1.02) / 2
    // bulanıktan netleşerek yükselir ve büyür (0.9 → 1), sonra yavaşça büyümeye devam eder
    const lift = ease([861, 34], [874, 0], OUT)
    const grow = curve([[861, 0.9], [866, 0.95], [870, 0.98], [875, 0.995], [880, 1], [887, 1.004]])
    add(text(k('closingName'), word, SIZE, 700, ACCENT, [{ from: 861, to: 887, step: 2, pose: (r) => at(961 + (left - 961) * grow(r), 503 + lift(r), 0.02, [0, 0, 0], grow(r)) }], [blurIn(861, 9, 0.3)]))
  }

  // ---------------------------------------------------------------- 11) gece: üç kelime art arda (841–860)
  {
    const list = words('bridge')
    const slots: [number, number][] = [[841, 850], [850, 858], [858, 861]]
    list.slice(0, 3).forEach((w, i) => {
      const left = 960 - (em(w) * 62) / 2
      add(text(`${k('bridgeName')} ${i + 1}`, w, 62, 500, LIGHT, still(slots[i][0], slots[i][1], at(left, 540, 0.02))))
    })
    add(rect(k('nightBg'), 2400, 1400, NIGHT, still(841, 861, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 10) sahne asistanı kartı (813–840)
  {
    // kart yan dönük (sağ kenarı uzakta), kamera yavaşça yaklaşır; satırlar kartın üstünde yazılır
    const card = (r: number): World => {
      // uzaktan (z −9) kameraya doğru uçar ve 821'de yerine oturur; sonra hafifçe sola ve yukarı süzülür
      const a = curve([[813, 0], [815, 0.06], [817, 0.28], [819, 0.72], [820, 0.9], [821, 1], [822, 1]])(r)
      const drift = (r - 821) / 19
      const x = 900 + 130 * a - (r > 821 ? 30 * drift : 0)
      const y = 560 + 190 * a - (r > 821 ? 10 * drift : 0)
      // kart kameraya yakın (z 3) durur: referanstaki güçlü perspektif. Uçuşta dünya boyu sabit (at() uzağı büyütmesin)
      const z = 3 - 12 * (1 - a)
      return at(x + 20 * a, y + 95 * a, z, [6, 48 - 3 * a, -3.5], (1.05 * depth(3)) / depth(z))
    }
    const CARD_W = PANEL_W.assistant
    const local = (x: number, y: number) => [x + PAD - CARD_W / 2, y + PAD - (1180 + 2 * PAD) / 2] as const
    const lines = [k('assistantLine1'), k('assistantLine2'), k('assistantLine3'), k('assistantLine4'), k('assistantLine5'), k('assistantLine6')]
    const lineY = [560, 604, 648, 692, 770, 814]
    const lineStart = [826, 829, 831.5, 834, 836, 838]
    lines.forEach((value, i) => {
      const [lx, ly] = local(110, lineY[i])
      const typed = Math.max(2, Math.min(5, value.length / 8))
      add(text(`${k('assistantLineName')} ${i + 1}`, value, 27, i === 4 ? 600 : 500, i === 4 ? INK : SOFT_INK, [{ from: 813, to: 841, step: 4, pose: (r) => onPlane(card(r), lx, ly, 0.02) }],
        [b('typewriter', R(lineStart[i]), R(FIRST + typed), { easing: 'linear', params: { trail: 6, trailHue: 235 } })]))
    })
    const [sx, sy] = local(110, 480)
    add(text(k('sent'), k('sentText'), 24, 400, '#9A9AA3', [{ from: 813, to: 841, step: 4, pose: (r) => onPlane(card(r), sx + 40, sy, 0.02) }], [fadeIn(822, 3)]))
    const [ix, iy] = local(86, 480)
    add(image(k('spinner'), file('spinner.png'), 30, [{ from: 813, to: 841, step: 4, pose: (r) => onPlane(card(r), ix, iy, 0.02) }],
      [fadeIn(822, 3), b('move', R(822), R(FIRST + 19), { params: { dx: 0, rotate: -18 * 19 }, easing: 'linear' })], { tint: true, color: ACCENT }))
    add(image(k('assistant'), file(`assistant-${lang}.png`), CARD_W, [{ from: 813, to: 822, step: 1, pose: card }, { from: 822, to: 841, step: 4, pose: card }], [fadeIn(813, 5)]))
    // kartın sağ yarısı referanstaki gibi beyaz bir ışığa karışır (gri zemine değil)
    add(image(k('cardLight'), file('glow.png'), 2600, still(813, 841, at(1760, 560, LIGHTS)), [fadeIn(813, 8)], { tint: true, color: WHITE, opacity: 0.8 }))
    add(image(`${k('cardLight')} 2`, file('glow.png'), 1100, still(813, 841, at(640, 620, LIGHTS)), [fadeIn(813, 8)], { tint: true, color: LILAC, opacity: 0.35 }))
    add(rect(k('creamBg'), 2400, 1400, PAPER, still(813, 841, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 9) istem kutusu: yakın plan (787–799) → geniş (800–812)
  {
    const prompt = k('prompt')
    const typing = b('typewriter', R(779), R(FIRST + 27), { easing: 'linear', params: { trail: 7, trailHue: 235 } })
    // yakın plan: kutunun sol kenarı 460 → 255 px kayar, yükseklik 375 px (kutu görseli 1400 × 132, ölçek 2.84)
    const CLOSE = 2.6
    const boxLeft = curve([[787, 470], [789, 414], [792, 340], [795, 285], [799, 255], [800, 250]])
    const boxTop = curve([[787, 330], [789, 336], [795, 360], [800, 362]])
    const close = (r: number) => at(boxLeft(r) + 700 * CLOSE, boxTop(r) + 66 * CLOSE, 0, [0, 5, 0], CLOSE)
    add(text(`${k('promptName')} 1`, prompt, 64, 500, INK, [{ from: 787, to: 800, step: 1, pose: (r) => onPlane(close(r), -700 + 52, 0, 0.03) }], [typing]))
    add(image(`${k('promptBox')} 1`, file('prompt-box.png'), 1520, [{ from: 787, to: 800, step: 1, pose: close }]))
    // geniş plan: kutu ortada (merkez 990, 540), 811'den sonra sağa yatıp kayar
    const tilt = curve([[800, 0], [810, 0], [811, 2.4], [812, 4.2], [813, 6.5]])
    const shift = curve([[800, 0], [806, 0], [811, 10], [812, 25], [813, 45]])
    const wide = (r: number) => at(990 + shift(r), 540 - shift(r) * 0.3, 0, [0, 0, tilt(r)], 1)
    add(text(`${k('promptName')} 2`, prompt, 44, 500, INK, [{ from: 800, to: 813, step: 1, pose: (r) => onPlane(wide(r), -700 + 48, 0, 0.03) }], [typing]))
    add(image(k('sparkle'), file('sparkle.png'), 46, [{ from: 800, to: 813, step: 1, pose: (r) => onPlane(wide(r), 615, 0, 0.03) }], [], { tint: true, color: ACCENT }))
    add(image(`${k('promptBox')} 2`, file('prompt-box.png'), 1520, [{ from: 800, to: 813, step: 1, pose: wide }]))
  }

  // ---------------------------------------------------------------- 8) gece: "final render" (760–786)
  {
    const list = words('finale')
    const lefts = layout(list.map((w) => ({ text: w, weight: 0 as const, size: 58 })), 960)
    const drift = curve([[760, 0], [780, -2], [784, -6], [786, -18], [787, -40]])
    list.forEach((w, i) => {
      const from = i === 0 ? 760 : 768
      add(text(`${k('finaleName')} ${i + 1}`, w, 58, 500, LIGHT, [{ from, to: 787, step: 1, pose: (r) => at(lefts[i] + drift(r) + (i === 0 ? 0 : 30 * (1 - ease([768, 0], [776, 1], OUT)(r))), 540, 0.02) }],
        [blurIn(from, 4, 0.08), blurOut(784, 3, 0.08)]))
    })
    add(rect(k('nightBg'), 2400, 1400, NIGHT, still(760, 787, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 6–7) senaryo penceresi: yakın plan yazı (641–682), yandan dönüş ve iki panel (683–759)
  {
    const BOARD = PANEL_W.board
    // pencerenin merkezi: ekran pikseli ve ölçek (1500 px'lik gövde ölçek 1'de)
    const closeX = curve([[641, 1580], [646, 1513], [652, 1440], [660, 1369], [668, 1352], [680, 1342], [683, 1340]])
    const closeY = curve([[641, 720], [660, 715], [664, 705], [672, 650], [680, 588], [683, 570]])
    const closePose = (r: number) => at(closeX(r), closeY(r), 0, [0, 14, -0.6], 2.44)
    const ry = curve([[683, 82], [686, 62], [689, 45], [692, 32], [696, 20], [700, 13], [708, 7], [716, 4], [719, 3], [722, -4], [724, -10], [727, -17], [730, -19], [735, -18], [750, -17], [760, -17]])
    const bx = curve([[683, 1230], [686, 990], [692, 925], [700, 905], [708, 935], [716, 954], [719, 960], [722, 880], [724, 780], [727, 640], [730, 560], [735, 543], [745, 448], [750, 440], [760, 436]])
    const by = curve([[683, 600], [700, 551], [716, 611], [719, 615], [724, 640], [730, 720], [735, 750], [750, 758], [760, 760]])
    const bs = curve([[683, 0.78], [690, 0.8], [700, 0.88], [710, 0.96], [716, 1.0], [719, 1.0], [724, 0.87], [730, 0.7], [735, 0.64], [750, 0.635], [760, 0.63]])
    const widePose = (r: number) => at(bx(r), by(r), 0, [0, ry(r), 0], bs(r))
    const sections = (step = 1): Section[] => [
      { from: 641, to: 683, step: 6, pose: closePose },
      { from: 683, to: 700, step, pose: widePose },
      { from: 700, to: 719, step: 6, pose: widePose },
      { from: 719, to: 736, step, pose: widePose },
      { from: 736, to: 760, step: 8, pose: widePose },
    ]
    // yazılan satırlar (gövdenin sol üstüne göre px): yükleniyor simgesinin yanında
    const lines: { key: string; x: number; y: number; weight: 400 | 600; start: number; frames: number; color: string }[] = [
      { key: 'line1', x: 426, y: 468, weight: 400, start: 650, frames: 12, color: MUTED_INK },
      { key: 'line2', x: 426, y: 495, weight: 600, start: 662, frames: 5, color: INK },
      { key: 'line3a', x: 426, y: 543, weight: 600, start: 666, frames: 2, color: INK },
      { key: 'line3b', x: 426, y: 543, weight: 400, start: 668, frames: 5, color: MUTED_INK },
      { key: 'line4', x: 426, y: 591, weight: 600, start: 671, frames: 3, color: INK },
      { key: 'line5', x: 426, y: 618, weight: 400, start: 674, frames: 5, color: MUTED_INK },
      { key: 'line6', x: 426, y: 645, weight: 400, start: 679, frames: 3, color: MUTED_INK },
      { key: 'line7', x: 432, y: 693, weight: 400, start: 682, frames: 10, color: MUTED_INK },
      { key: 'line8', x: 432, y: 720, weight: 400, start: 692, frames: 8, color: MUTED_INK },
    ]
    const label = k('board.line3a')
    // sağ panel: değerlendirme kartı (724'ten sonra sağdan gelir). Listede pencereden önce ve biraz önde (z 0.4): öne dönen
    // iki kenar üst üste gelince pencerenin saydam ışık payı kartı kesiyordu
    const cx = curve([[724, 2050], [727, 1820], [730, 1660], [735, 1530], [750, 1495], [760, 1488]])
    const cy = curve([[724, 650], [735, 640], [750, 636], [760, 634]])
    const cardPose = (r: number) => at(cx(r), cy(r), 0.4, [0, 18, 0], 0.58)
    const card: Section[] = [{ from: 724, to: 736, step: 1, pose: cardPose }, { from: 736, to: 760, step: 8, pose: cardPose }]
    add(image(`${k('review')} 2`, file(`card-score-${lang}.png`), PANEL_W.review, card.map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), 0, 0, 0.01) }))))
    add(image(`${k('review')} 1`, file(`card-review-${lang}.png`), PANEL_W.review, card))
    lines.forEach((line) => {
      const value = k(`board.${line.key}`)
      const x = line.key === 'line3b' ? line.x + (em(label, 1) + SPACE(0)) * 19 : line.x
      add(text(`${k('boardLineName')} ${line.key}`, value, 19, line.weight, line.color, sections(2).map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), x - 750, line.y - 500, 0.02) })),
        [b('typewriter', R(line.start), R(FIRST + line.frames), { easing: 'linear', params: { trail: 6, trailHue: 235 } })]))
    })
    add(image(k('spinner'), file('spinner.png'), 26, sections(2).map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), 387 - 750, 468 - 500, 0.02) })),
      [b('move', R(641), R(FIRST + 119), { params: { dx: 0, rotate: -18 * 119 }, easing: 'linear' })], { tint: true, color: ACCENT }))
    add(image(k('window'), file(`board-${lang}.png`), BOARD, sections()))


    // başlık: "from first idea" (orta kelime renkli), kelime kelime bulanıktan
    const list = words('origin')
    const lefts = layout(list.map((w) => ({ text: w, weight: 0 as const, size: 50 })), 960)
    const starts = [731, 737, 743]
    list.slice(0, 3).forEach((w, i) => {
      const slide = ease([starts[i], 24], [starts[i] + 8, 0], OUT)
      add(text(`${k('originName')} ${i + 1}`, w, 50, 400, i === 1 ? ACCENT : SOFT_INK, [{ from: starts[i], to: starts[i] + 8, step: 1, pose: (r) => at(lefts[i] + slide(r), 255, 0.02) }, { from: starts[i] + 8, to: 760, step: 20, pose: (r) => at(lefts[i] + slide(r), 255, 0.02) }], [blurIn(starts[i], 5, 0.07)]))
    })
    add(image(k('glow'), file('glow.png'), 1600, still(719, 760, at(960, 760, LIGHTS)), [], { tint: true, color: LILAC, opacity: 0.45 }))
    add(image(`${k('glow')} 2`, file('glow.png'), 520, still(737, 760, at(lefts[1] + (em(list[1] ?? '') * 50) / 2, 262, LIGHTS)), [fadeIn(737, 6)], { tint: true, color: LILAC, opacity: 0.55 }))
    add(rect(k('creamBg'), 2400, 1400, WHITE, still(641, 683, at(960, 540, BACK))))
    add(rect(k('creamBg'), 2400, 1400, PAPER, still(683, 760, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 5) düğme yakın plan (617–640): netlik soldan sağa kayar
  {
    const left = curve([[617, 540], [620, 516], [626, 500], [632, 486], [640, 468], [641, 466]])
    const BTN_W = 2300
    const BTN_H = 310
    const pose = (r: number) => at(left(r) + BTN_W / 2 - 60, 537, 0, [0, 12, 0], 1)
    const btn: Section[] = [{ from: 617, to: 641, step: 1, pose }]
    add(text(k('buttonName'), k('button'), 118, 500, WHITE, btn.map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), -BTN_W / 2 + 250, 8, 0.02) }))))
    add(rect(k('button'), BTN_W, BTN_H, BUTTON, btn, [], 'rounded'))
    add(image(k('buttonGlow'), file('glow-box.png'), 3000, btn.map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), -200, 0, -0.05) })), [], { tint: true, color: ACCENT, opacity: 0.85 }))
    add(rect(k('creamBg'), 2400, 1400, '#F8F9FD', still(617, 641, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 4) bulutlu turuncu: "And generate" (599–616)
  {
    const list = words('generate')
    const lefts = layout(list.map((w) => ({ text: w, weight: 0 as const, size: 56 })), 960)
    const drift = curve([[599, 0], [606, 0], [610, -10], [614, -22], [616, -40], [617, -70]])
    list.forEach((w, i) => {
      const from = i === 0 ? 600 : 604
      add(text(`${k('generateName')} ${i + 1}`, w, 56, 500, WHITE, [{ from, to: 617, step: 1, pose: (r) => at(lefts[i] + drift(r) + (i === 0 ? 0 : 26 * (1 - ease([604, 0], [610, 1], OUT)(r))), 540, 0.02) }],
        [blurIn(from, 4, 0.09), blurOut(615, 2, 0.1)]))
    })
    const cloud = (n: number, color: string, x0: number, y0: number, x1: number, y1: number, size: number, opacity: number, from: number, to: number) =>
      image(`${k('cloud')} ${n}`, file('glow.png'), size, [{ from, to, step: 3, pose: (r) => at(x0 + ((x1 - x0) * (r - from)) / (to - from), y0 + ((y1 - y0) * (r - from)) / (to - from), LIGHTS + 0.5 - n * 0.02) }], [], { tint: true, color, opacity })
    // 4. ve 9. sahnenin bulutları aynı düzende (referansta aynı zemin)
    for (const [from, to] of [[599, 617], [787, 813]] as const) {
      add(
        cloud(1, CLOUD_LIGHT, 1500, 260, 1380, 300, 1500, 0.75, from, to),
        cloud(2, LILAC, 360, 880, 470, 830, 1300, 0.6, from, to),
        cloud(3, CLOUD_MID, 980, 620, 900, 590, 1200, 0.65, from, to),
        cloud(4, CLOUD_LIGHT, 200, 160, 280, 200, 1000, 0.5, from, to),
        cloud(5, LILAC, 1750, 950, 1650, 900, 1100, 0.5, from, to),
      )
      add(rect(k('blueBg'), 2400, 1400, ACCENT_DEEP, still(from, to, at(960, 540, BACK))))
    }
  }

  // ---------------------------------------------------------------- 3) stüdyo paneli (544–598)
  {
    // yerleşmiş duruş referansa oturtuldu (üst köşeler, özet satırı, grafikler): x 0, y -1.4, rx -52.5°, genişlik 8.94 birim
    const settle = ease([544, 0], [557, 1], OUT)
    const push = curve([[590, 0], [592, 0.12], [594, 0.35], [596, 0.62], [598, 0.9], [599, 1]])
    const drift = curve([[557, 0], [579, 0.02], [591, 0.06]])
    const dash = (r: number): World => {
      const a = settle(r)
      const rx = -52.5 + 8 * (1 - a)
      const rz = -22 * (1 - a)
      const ry = 10 * (1 - a)
      const y = -1.4 + 0.9 * (1 - a) - 0.3 * drift(r) - 1.2 * push(r)
      const z = 2.2 * (1 - a) + 0.6 * drift(r) + 6.5 * push(r)
      // ölçek görsel pikseli başına: gövde (2200 px) 8.478 birim (oturtma 2320 px'lik eski görselde 8.94 birimdi)
      return { p: [0.4 * (1 - a), y, z], r: [rx, ry, rz], s: 8.478 / (2200 * U) }
    }
    const DW = PANEL_W.dashboard
    const sections: Section[] = [{ from: 544, to: 558, step: 1, pose: dash }, { from: 558, to: 590, step: 4, pose: dash }, { from: 590, to: 599, step: 1, pose: dash }]
    // grafikler panelin üstünde (yerel konum: görsel merkezine göre px), büyüyerek gelir
    const chart = (name: string, src: string, width: number, dx: number, dy: number, from: number, frames: number, extra: Partial<LayerSpec> = {}) =>
      image(name, src, width, sections.map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), dx, dy, 0.03) })), [b('scale-in', R(from), R(FIRST + frames), { easing: 'ease-out-expo' })], extra)
    // panel gövdesi 2200 × 1900, görselde 60 px kenar; grafik kartları gövdede x 540 + i·530, üst 610
    const local = (x: number, y: number) => [x + PAD - DW / 2, y + PAD - (1900 + 2 * PAD) / 2] as const
    const [fx, fy] = local(790, 900)
    const [px, py] = local(1320, 960)
    const [rx_, ry_] = local(1850, 960)
    add(chart(k('chartFunnel'), file('chart-funnel.png'), 360, fx, fy, 556, 8))
    add(chart(k('chartPie'), file('chart-pie.png'), 300, px, py, 557, 14))
    add(chart(k('chartRadar'), file(`chart-radar-${lang}.png`), 420, rx_, ry_, 562, 12))
    add(image(k('dashboard'), file(`dashboard-${lang}.png`), DW, sections))

    // başlık: "Preview every scene at a" + "glance" (serif), kelime kelime; sonra yavaşça büyür, itişte büyüyüp söner
    const list = words('glanceLead')
    const accent = k('glance')
    const items = [...list.map((w) => ({ text: w, weight: 0 as const, size: 48 })), { text: accent, weight: 2 as const, size: 52 }]
    const lefts = layout(items, 966)
    const starts = [548, 552, 556, 561, 564, 567, 570, 573].slice(0, items.length)
    const grow = curve([[544, 1], [579, 1], [591, 1.07], [595, 1.16], [599, 1.4]])
    const lower = curve([[591, 0], [595, 18], [599, 70]])
    items.forEach((item, i) => {
      const slide = ease([starts[i], 22], [starts[i] + 7, 0], OUT)
      const pose = (r: number) => at(966 + (lefts[i] + slide(r) - 966) * grow(r), 362 + lower(r), 0.05, [0, 0, 0], grow(r))
      add(text(`${k('glanceName')} ${i + 1}`, item.text, item.size, i === items.length - 1 ? 'serif' : 400, i === items.length - 1 ? INK : SOFT_INK,
        [{ from: starts[i], to: 590, step: 3, pose }, { from: 590, to: 599, step: 1, pose }], [blurIn(starts[i], 5, 0.06), blurOut(595, 4, 0.08)]))
    })
    add(rect(k('creamBg'), 2400, 1400, PAPER, still(544, 599, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 2) "The studio for" → "motion design"; değerlendirme kartı (456–543)
  {
    const SIZE = 71
    const CAP_Y = 534
    // kartla birlikte yükselme (494–534) ve çıkıştaki grup savrulması (534–544)
    const rise = curve([[494, 0], [496, -6], [498, -17], [500, -37], [502, -73], [504, -120], [506, -163], [508, -198], [510, -226], [512, -247], [514, -265], [516, -279], [518, -290], [520, -300], [522, -308], [524, -315], [526, -321], [528, -325], [530, -329], [532, -332], [534, -334]])
    const swing = (r: number): Rig => {
      const a = curve([[534, 0], [536, 0.03], [538, 0.12], [540, 0.3], [542, 0.62], [544, 1]])(r)
      return { x: 1300, y: 560, r: [-4 * a, -55 * a, 32 * a], tx: 600 * a, ty: -220 * a, tz: 4.6 * a }
    }
    const exit: Section = { from: 534, to: 544, step: 1, pose: () => at(0, 0) }

    // 1. satır: kelimeler sırayla bulanıktan, sağdan kayarak; 471'den sola savrulup kaybolur
    const line1 = words('lead')
    const lefts1 = layout(line1.map((w) => ({ text: w, weight: 0 as const, size: SIZE })), 968)
    const whip = curve([[470, 0], [471, -2.5], [472, -6], [473, -13], [474, -24], [475, -49], [476, -94], [477, -150]])
    line1.forEach((w, i) => {
      const from = [456, 459.5, 462.5, 464.5][i] ?? 464.5
      const slide = ease([from, 40], [from + 10, 0], OUT)
      add(text(`${k('leadName')} ${i + 1}`, w, SIZE, 400, SOFT_INK, [{ from, to: 470, step: 2.5, pose: (r) => at(lefts1[i] + slide(r) + whip(r), CAP_Y, 0.03) }, { from: 470, to: 477, step: 1, pose: (r) => at(lefts1[i] + slide(r) + whip(r), CAP_Y, 0.03) }], [blurIn(from, 6, 0.1), blurOut(474, 3, 0.09)]))
    })
    // 2. satır: ilk kelime turuncu belirip koyulaşır (iki kopya), ikincisi turuncu kalır
    const line2 = words('focus')
    const lefts2 = layout(line2.map((w) => ({ text: w, weight: 0 as const, size: SIZE })), 968)
    const starts = [477, 482]
    line2.slice(0, 2).forEach((w, i) => {
      const slide = ease([starts[i], 55], [starts[i] + 13, 0], OUT)
      const pose = (r: number) => at(lefts2[i] + slide(r), CAP_Y + rise(r), 0.03)
      const sections: Section[] = [{ from: starts[i], to: 534, step: 2, pose }, { ...exit, pose: (r) => rigged(swing(r), pose(Math.min(r, 534))) }]
      if (i === 0) {
        add(text(`${k('focusName')} ${i + 1}`, w, SIZE, 400, SOFT_INK, sections, [fadeIn(481, 4)]))
        add(text(`${k('focusName')} ${i + 1} · ${k('tint')}`, w, SIZE, 400, ACCENT, [{ from: starts[i], to: 486, step: 3, pose }], [blurIn(starts[i], 5, 0.1), fadeOut(482, 4)]))
      } else {
        add(text(`${k('focusName')} ${i + 1}`, w, SIZE, 400, ACCENT, sections, [blurIn(starts[i], 5, 0.1)]))
      }
    })

    // kart: alttan eğik gelir (üst kenar 1066 → 310 → 332 px), yerine yaylanarak oturur; puan sütunu 511–516 belirir
    const top = curve([[494, 1140], [495, 1066], [496, 1034], [497, 979], [498, 903], [499, 826], [500, 764], [501, 712], [502, 667], [503, 626], [504, 586], [505, 547], [506, 499], [507, 468], [508, 440], [509, 417], [510, 397], [511, 380], [512, 366], [513, 352], [514, 342], [515, 333], [516, 324], [517, 318], [518, 313], [519, 310], [520, 311], [521, 319], [522, 327], [523, 330], [524, 332], [534, 332]])
    const tilt = curve([[494, -16], [495, -15], [500, -11], [505, -7], [510, -3.5], [515, -1], [519, 0.8], [523, 0], [534, 0]])
    const size = curve([[494, 0.91], [495, 0.92], [505, 0.95], [512, 0.99], [519, 1.015], [524, 1.0], [534, 1.0]])
    // gövde 1666 × 820 (görselde `PAD` kadar saydam pay): merkezin gövde üstüne uzaklığı 410
    const card = (r: number) => at(971, top(r) + 410 * size(r), 0.01, [tilt(r), 0, 0], size(r))
    const cardSections: Section[] = [{ from: 494, to: 524, step: 1, pose: card }, { from: 524, to: 534, step: 5, pose: card }, { ...exit, pose: (r) => rigged(swing(r), card(Math.min(r, 534))) }]
    add(image(`${k('review')} 2`, file(`card-score-${lang}.png`), PANEL_W.review, cardSections.map((s) => ({ ...s, pose: (r: number) => onPlane(s.pose(r), 0, 0, 0.01) })), [fadeIn(511, 5)]))
    add(image(`${k('review')} 1`, file(`card-review-${lang}.png`), PANEL_W.review, cardSections))

    // zemin: krem, solda ve sağ altta şeftali ışık
    add(image(`${k('glow')} 1`, file('glow.png'), 1300, still(456, 544, at(10, 470, LIGHTS)), [], { tint: true, color: LILAC, opacity: 0.85 }))
    add(image(`${k('glow')} 2`, file('glow.png'), 1200, still(456, 544, at(1900, 1060, LIGHTS)), [], { tint: true, color: LILAC, opacity: 0.6 }))
    add(rect(k('creamBg'), 2400, 1400, PAPER, still(456, 544, at(960, 540, BACK))))
  }

  // ---------------------------------------------------------------- 1) oda ve laptop (412–455)
  {
    // dolly zoom: oda (duvar, zemin, sütunlar, bulutlar) pencerenin merkezi etrafında 1.31 → 1 küçülür, sonda yeniden itilir;
    // pencere genişliği referansta 1287 → 983 px. Laptop ve kaide ise büyür (kameraya yakınlar).
    const A = { x: 955, y: 410 }
    const room = curve([[412, 1.309], [415, 1.242], [418, 1.193], [421, 1.16], [424, 1.132], [427, 1.105], [430, 1.082], [433, 1.068], [436, 1.049], [439, 1.033], [442, 1.018], [446, 1.005], [448, 1], [451, 1], [453, 1.013], [455, 1.047], [456, 1.06]])
    const inRoom = (cx: number, cy: number, z: number, rot: Vec3 = [0, 0, 0], own = 1) => (r: number) => {
      const s = room(r)
      return at(A.x + (cx - A.x) * s, A.y + (cy - A.y) * s, z, rot, s * own)
    }
    const S1: [number, number] = [FIRST, 456]
    const roomSection = (pose: (r: number) => World): Section[] => [{ from: S1[0], to: 448, step: 2, pose }, { from: 448, to: S1[1], step: 2, pose }]

    // laptop: öne eğik ve yatık başlar (ekran basık görünür), doğrulup süzülür
    const lrx = curve([[412, 40], [414, 34], [416, 28], [418, 22], [420, 18], [422, 15], [424, 12], [427, 10], [430, 9], [440, 9], [450, 9], [456, 9]])
    const lry = curve([[412, -6], [416, -9], [420, -12], [424, -14], [430, -15], [440, -16], [450, -17], [456, -17]])
    const lrz = curve([[412, 18], [416, 16], [420, 14], [424, 13], [430, 12], [440, 11], [450, 10], [456, 10]])
    const ls = curve([[412, 0.48], [416, 0.51], [420, 0.535], [424, 0.55], [430, 0.56], [440, 0.567], [450, 0.572], [453, 0.58], [456, 0.6]])
    const ly = curve([[412, 640], [416, 600], [420, 575], [424, 562], [430, 556], [440, 551], [450, 548], [456, 545]])
    add(tracked({ name: k('laptop'), kind: 'laptop', color: NIGHT, image: file(`laptop-screen-${lang}.png`), deviceFinish: 'silver', lidAngle: 105 },
      [{ from: S1[0], to: S1[1], step: 2, pose: (r) => at(962, ly(r), 1, [lrx(r), lry(r), lrz(r)], ls(r)) }]))

    // kurdeleler: üst köşelerden içeri kıvrılarak iner (428–448); görsel 560 × 560, sivri ucu (540, 500), bandın üstü (105, 0)
    const ribbon = (side: -1 | 1) => {
      const grow = ease([428, 0], [449, 1], OUT)
      // son halde sivri uç (600, 630) / (1320, 630)
      const tipX = side < 0 ? 600 : 1320
      const cx = side < 0 ? tipX - 540 + 280 : tipX + 540 - 280
      const cy = 630 - 500 + 280
      const pivot = { x: side < 0 ? cx - 280 + 105 : cx + 280 - 105, y: cy - 280 }
      return (r: number) => {
        const a = grow(r)
        const deg = side < 0 ? -55 * (1 - a) : 55 * (1 - a)
        const own = 0.8 + 0.2 * a
        // pivot etrafında dön (ekranda saat yönünün tersi pozitif), sonra oda ölçeği
        const vx = (cx - pivot.x) * own
        const vy = (cy - pivot.y) * own
        const c = Math.cos(deg * RAD)
        const s = Math.sin(deg * RAD)
        const x = pivot.x + vx * c + vy * s
        const y = pivot.y - vx * s + vy * c
        return inRoom(x, y, 0.05, [0, 0, deg], own)(r)
      }
    }
    add(image(`${k('ribbon')} 1`, file('ribbon-l.png'), 560, [{ from: 428, to: 456, step: 2, pose: ribbon(-1) }], [fadeIn(428, 3)], { tint: true, color: RIBBON }))
    add(image(`${k('ribbon')} 2`, file('ribbon-r.png'), 560, [{ from: 428, to: 456, step: 2, pose: ribbon(1) }], [fadeIn(428, 3)], { tint: true, color: RIBBON }))
    // kaide: üst elipsin merkezi (960, 870); görselde (310, 43), görsel 620 × 330
    const plinth = curve([[412, 0.9], [430, 0.96], [448, 1.0], [456, 1.06]])
    add(image(k('plinth'), file('pedestal.png'), 620, [{ from: S1[0], to: S1[1], step: 4, pose: (r) => at(960, 870 + (165 - 43) * plinth(r), 0.04, [0, 0, 0], plinth(r)) }], [], { tint: true, color: PLINTH }))
    add(image(k('columns'), file('room-columns.png'), 2400, roomSection(inRoom(960, 540, 0.03)), [], { tint: true, color: PILLAR }))
    add(image(k('floor'), file('room-floor.png'), 2400, roomSection(inRoom(960, 952.5, 0.02)), [], { tint: true, color: FLOOR }))
    add(image(k('wall'), file('room-wall.png'), 2400, roomSection(inRoom(960, 540, 0.01)), [], { tint: true, color: WALL }))
    add(image(k('clouds'), file('room-clouds.png'), 1150, roomSection(inRoom(955, 590, 0.005)), [], { tint: true, color: WHITE, opacity: 0.9 }))
    add(rect(k('sky'), 2400, 1400, SKY, still(S1[0], S1[1], at(960, 540, BACK))))
  }

  // Ses efektleri: her grup videonun tamamı boyunca süren ayrı bir parça; seviyesi zaman çizelgesinden ayrı ayarlanır.
  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: file(`sfx/${group}.mp3`),
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  const cam: BlockSpec[] = [
    // alan derinliği yalnızca 5., 6., 9. (yakın plan) ve 10. sahnede; diğerlerinde her şey net
    b('focus-pull', 0, 0, { params: { from: 0, to: 0, blur: 0 } }),
    b('focus-pull', AT(617), R(641) - R(617), { easing: 'ease-in', params: { from: 1.1, to: 0.3, blur: 1.5 } }),
    b('focus-pull', AT(641), 0, { params: { from: 0.3, to: 0.3, blur: 0.45 } }),
    b('focus-pull', AT(683), 0, { params: { from: 0, to: 0, blur: 0 } }),
    b('focus-pull', AT(787), 0, { params: { from: 0.9, to: 0.9, blur: 0.9 } }),
    b('focus-pull', AT(800), 0, { params: { from: 0, to: 0, blur: 0 } }),
    b('focus-pull', AT(813), 0, { params: { from: 4, to: 4, blur: 0.25 } }),
    b('focus-pull', AT(841), 0, { params: { from: 0, to: 0, blur: 0 } }),
    b('fade-to-black', R(907), END - R(907)),
  ]

  return {
    ...project(k('name'), END, PAPER, layers, camera(cam)),
    audio: sfx,
    width: W,
    height: H,
    fps: 60,
    effects: {
      dof: { enabled: true, bokeh: 4, range: 1.2 },
      bloom: { enabled: false, intensity: 0.3, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.3 },
      motionBlur: { enabled: true, samples: 16, shutter: 0.55 },
    },
  }
}
