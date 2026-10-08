import i18n from '../i18n'
import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { DROP_EM } from './featureDropMetrics'

// "Feature drop": 4:5 (1080×1350, 60 kare/sn, 1518 kare) özellik duyurusu; Mango Studio'nun prompt kütüphanesini tanıtır.
// Temposu ve hareket dili 60 kare/sn'lik bir uygulama duyurusundan kare kare ölçüldü: `F(n)` referansın 1'den başlayan
// karesini saniyeye çevirir (mikro saniye), ölçüler 1080×1350 pikseli. Kopya değil: hikâye, metinler, arayüz, logo ve
// görseller bizim; referanstan yalnızca renk düzeni (mavi-mor degrade zemin, beyaz yazı, pembe etiket) ve zamanlama alındı.
// Sahneler (kesmeler 336 ve 783; diğer geçişler solma):
//  1 gözler + açılan halkalar, göz kırpma, büyüme (1–96)     2 üç başlık: soldan belirir, soldan silinirken yenisi gelir (96–288)
//  3 etiketin koruyucu yaprağı soyulur, dev satır (288–336)  4 telefon yakından uzaklaşır, akış kayar, sekmelere dalar (336–560)
//  5 sekmeler; ortadaki sekme yeni adına dönüşür (560–660)   6 sekme cam karta dönüşür, kart genişler (656–783)
//  7 kart telefondaki yerine oturur (783–866)                8 iki başlık (866–1026)
//  9 telefon alttan yükselir, bildirim iner (1018–1196)     10 koyu mavi zemin, yatay ışık bantları (1196–1312)
// 11 "now live on mangostudio.design" → alan adı ortalanır, gözler kırpar ve ambleme dönüşür (1312–1518)
// Renklerin hepsi katman rengi (beyaz görseller `tint` ile boyanır): editörden değişir. Telefon ekranları cihazın ekran
// videosu / görseli. Görseller, ekran videoları ve yazı genişlikleri: node scripts/build-feature-drop-assets.mjs.
// Ses: dört efekt grubu ayrı ses parçası (public/templates/feature-drop/sfx/*.mp3; Desktop/launch-ad-sfx projesindeki
// FeatureDrop kompozisyonu). Konuşma ve müzik yok.

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

const W = 1080
const H = 1350
const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / H
const P = (x: number, y: number, z = 0): Vec3 => [(x - W / 2) * U, (H / 2 - y) * U, z]
/** görselin kadrajdaki genişliği (px) → katman ölçeği (görsel 3 birim genişliğinde çizilir) */
const sc = (widthPx: number) => (widthPx * U) / 3
/** referans karesi (60 kare/sn, 1'den başlar: 1. kare t = 0) → saniye; mikro saniyeye yuvarlanır */
const F = (n: number) => Math.round(((n - 1) / 60) * 1e6) / 1e6
/** kare sayısı → süre (sn) */
const DUR = (frames: number) => Math.round((frames / 60) * 1e6) / 1e6
const END = DUR(1518)

const FONT = 'dm-sans'
const em = (text: string, bold = false) => DROP_EM[text]?.[bold ? 1 : 0] ?? text.length * 0.5
/** telefon modelinin gövde genişliği (ölçek 1'de, sahne birimi): render'dan ölçüldü */
const BODY_W = 1.7

// Renkler (referansın renk düzeni; hepsi katman rengi)
const BG_TOP = '#5365EF'
const BG_BOTTOM = '#B2BCF5'
const WHITE = '#FFFFFF'
const SHADE = '#3443C8'
const PINK = '#F9CDEB'
const MAGENTA = '#E83BD0'
const DEEP = '#2A2BEF'
const GLASS = '#6F7CEF'
const GLASS_HEAD = '#4E5DEE'
const PUPIL = '#4827F4'
/** z derinliğindeki katmanın z = 0'daki gibi görünmesi için ölçek çarpanı (kamera z = 9) */
const depth = (z: number) => (9 - z) / 9

// Ölçülen eğriler
/** başlık boyu (px) */
const TITLE = 64
const SETTLE: Bezier = [0.16, 0.84, 0.3, 1]
const GLIDE: Bezier = [0.3, 0, 0.2, 1]
/** telefonun yakından uzaklaşması: çok hızlı başlar, uzun kuyruk (genişlik 336'da ~1100 px → 460'ta 630 px) */
const PULL: Bezier = [0.03, 0.7, 0.25, 1]
/** sekmelere dalış: yavaş başlar, hızlanır (470'te 644 px → 510'da kadrajdan taşar) */
const DIVE: Bezier = [0.55, 0, 0.85, 0.55]
/** alttan yükselen telefon: üst kenarın her 4 karedeki konumuna uyduruldu (1044–1160, en büyük hata 2.8 px) */
const RISE: Bezier = [0.1, 0.5, 0.2, 0.9]

export function buildFeatureDrop({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const file = (name: string) => `${base}templates/feature-drop/${name}`
  const img = (name: string) => file(`${name}.png`)
  const lang: 'en' | 'tr' = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.feature-drop.${key}`)

  type MoveP = { dx?: number; dy?: number; rotate?: number; rotX?: number; scaleBy?: number }
  const move = (from: number, to: number, p: MoveP, easing: string | Bezier = 'linear') => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', F(from), DUR(to - from), { params, easing }) : b('move', F(from), DUR(to - from), { params, easing: 'custom', bezier: easing })
  }
  /** katmanı (x, y) konumundayken (cx, cy) noktasına göre `factor` katına getirir */
  const about = (from: number, to: number, x: number, y: number, factor: number, easing: Bezier | string, cx = W / 2, cy = H / 2, extra: MoveP = {}) =>
    move(from, to, { dx: (x - cx) * (factor - 1), dy: (y - cy) * (factor - 1), scaleBy: factor, ...extra }, easing)
  const cut = (from: number, to: number) => [b('fade-in', F(from), 0), b('fade-out', F(to), 0)]
  const fadeIn = (from: number, frames: number, easing = 'ease-out') => b('fade-in', F(from), DUR(frames), { easing })
  const fadeOut = (from: number, frames: number, easing = 'ease-in') => b('fade-out', F(from), DUR(frames), { easing })
  const reveal = (from: number, to: number, softness = 0.35) => b('soft-reveal', F(from), DUR(to - from), { easing: 'linear', params: { softness } })
  const hide = (from: number, to: number, softness = 0.35) => b('soft-hide', F(from), DUR(to - from), { easing: 'linear', params: { softness } })

  const layers: Layer[] = []
  /** sona eklenen katman listede arkada kalır: önce öndekiler eklenir */
  const add = (...items: Layer[]) => layers.push(...items)
  const text = (name: string, value: string, x: number, y: number, size: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'text', text: value, fontFamily: FONT, fontWeight: 400, fontSize: size * U, textWidth: 40, align: 'center', color: WHITE, position: P(x, y, 0.05), blocks, ...extra })
  const image = (name: string, src: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'image', color: WHITE, image: src, position: P(x, y, z), scale: sc(widthPx), blocks, ...extra })
  /** beyaz çizilmiş görsel, katman rengiyle boyanır */
  const tinted = (name: string, src: string, color: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    image(name, src, x, y, z, widthPx, blocks, { tint: true, color, ...extra })

  // Telefon solarken gövdesi saydamlaşıp arkası (kamera lensleri) görünüyordu: telefonun kendisi solmaz, önüne zeminin
  // kopyası (`veil`, proje degradesiyle aynı renkler) çekilir. Zemin rengi değişirse bu görsel de değişmeli.
  const VEIL_Z = 0.6
  const veil = (n: number, blocks: BlockSpec[], z = VEIL_Z) => image(`${k('veil')} ${n}`, img('veil'), W / 2, H / 2, z, 1200 * depth(z), blocks)
  /** veil'in önünde duran katmanlar için derinlik */
  const FRONT = 0.72

  // Gözler: göz akı ve göz bebekleri ayrı görseller (ikisi de boyanır). Açıkken tek görsel durur, göz bebekleri `look`
  // bloklarıyla bakışını değiştirir; kırpma kare kare görsellerdir (4 kapanma durumu, kapalı çizgi, 4 açılma durumu).
  // Her kare kendi katmanı olduğu için ortak hareket (`shared`) hepsine eklenir. Klipler yarım kare erken başlar (bkz. yaprak).
  const pad = (i: number) => String(i).padStart(2, '0')
  const frame = (n: number) => cut(Math.max(1, n - 0.5), n + 0.5)
  const span = (from: number, to: number) => cut(Math.max(1, from - 0.5), to - 0.5)
  interface EyeSpec { tag: string; x: number; y: number; z: number; widthPx: number; from: number; to: number; blinks: [number, number][]; shared: BlockSpec[]; look: BlockSpec[][]; baseScale?: number }
  const eyes = ({ tag, x, y, z, widthPx, from, to, blinks, shared, look, baseScale = 1 }: EyeSpec): Layer[] => {
    const pupils: Layer[] = []
    const whites: Layer[] = []
    const scale = sc(widthPx) * baseScale
    const pupil = (src: string, blocks: BlockSpec[]) => pupils.push(tinted(`${k('pupils')}${tag}`, img(src), PUPIL, x, y, z + 0.01, widthPx, [...blocks, ...shared], { scale }))
    const white = (src: string, blocks: BlockSpec[]) => whites.push(tinted(`${k('eyes')}${tag}`, img(src), WHITE, x, y, z, widthPx, [...blocks, ...shared], { scale }))
    let open = from
    blinks.forEach(([close, reopen], n) => {
      white('eye-w', span(open, close))
      pupil('eye-p', [...span(open, close), ...(look[n] ?? [])])
      for (let i = 0; i < 4; i++) {
        white(`eye-w-${i}`, frame(close + i)); pupil(`eye-p-${i}`, frame(close + i))
        white(`eye-w-${3 - i}`, frame(reopen + i)); pupil(`eye-p-${3 - i}`, frame(reopen + i))
      }
      white('eye-w-4', span(close + 4, reopen))
      open = reopen + 4
    })
    white('eye-w', span(open, to))
    pupil('eye-p', [...span(open, to), ...(look[blinks.length] ?? [])])
    return [...pupils, ...whites]
  }

  // ------------------------------------------------------------------ 11) kapanış (1312–1518)
  {
    const SIZE = 58
    const lead = k('nowLive')
    const brand = 'mangostudio.design'
    const leadW = (em(lead) + em(' ')) * SIZE
    const brandW = em(brand, true) * SIZE
    const left = W / 2 - (leadW + brandW) / 2
    const Y = 686
    // gözler alan adının üstünde belirir (1404), giden yazıya bakar, kırpar (1432–1452) ve 16 karede mango amblemine
    // dönüşür (1460–1475); amblem son karenin üstünde belirir, sonra o kare söner. Görsellerin kadrajı aynı: hepsi aynı yerde, aynı ölçekte.
    const EX = W / 2
    const EY = 505
    const EW = 250
    const pop = move(1476, 1494, { scaleBy: 1.07 }, SETTLE)
    add(tinted(`${t('layerNames.logo')} 2`, img('logo'), WHITE, EX, EY, 0.05, EW, [...cut(1476, 1519), fadeIn(1476, 6, 'linear'), pop]))
    add(...eyes({
      tag: ' 2', x: EX, y: EY, z: 0.06, widthPx: EW, from: 1404, to: 1460, blinks: [[1432, 1449]], baseScale: 0.5,
      shared: [fadeIn(1404, 4, 'linear'), move(1404, 1418, { scaleBy: 2 }, SETTLE)],
      look: [[move(1407, 1415, { dx: -12, dy: 9 }, GLIDE), move(1420, 1428, { dx: 12, dy: -9 }, GLIDE)], [fadeOut(1456, 4, 'linear')]],
    }))
    for (let i = 16; i >= 1; i--) add(tinted(`${k('morph')} ${i}`, img(`eye-m-${pad(i)}`), WHITE, EX, EY, 0.04, EW, i === 16 ? [...cut(1474.5, 1494), pop, fadeOut(1482, 10, 'linear')] : frame(1459 + i)))
    add(text(t('layerNames.wordmark'), brand, left + leadW, Y, SIZE, [...cut(1334, 1519), reveal(1334, 1358, 0.3), move(1398, 1426, { dx: W / 2 - brandW / 2 - (left + leadW) }, GLIDE)], { align: 'left', fontWeight: 700 }))
    add(text(k('nowLiveName'), lead, left, Y, SIZE, [...cut(1314, 1408), reveal(1314, 1338, 0.4), hide(1384, 1404, 0.4)], { align: 'left' }))
    add(tinted(`${k('arcs')} 2`, img('arcs'), WHITE, 620, 760, -0.2, 1700, [...cut(1306, 1440), fadeIn(1306, 26, 'linear'), move(1306, 1440, { dx: -70, dy: -50 }), fadeOut(1396, 44, 'linear')]))
  }

  // ------------------------------------------------------------------ 10) koyu zemin + yatay ışık bantları (1196–1312)
  {
    add(text(k('libraryName'), k('library'), W / 2, 676, 62, [...cut(1196, 1314), fadeIn(1196, 10), fadeOut(1298, 14)]))
    // bantlar: her satır kendi hızında yatay kayar (yön değiştirmez), sırayla belirir
    const ROWS = [
      { y: 70, x: 900, dx: -520, o: 0.55, at: 1222, wide: false },
      { y: 215, x: 380, dx: 460, o: 0.42, at: 1214, wide: true },
      { y: 360, x: 1040, dx: -640, o: 0.6, at: 1230, wide: false },
      { y: 505, x: 260, dx: 380, o: 0.34, at: 1240, wide: true },
      { y: 650, x: 820, dx: -420, o: 0.3, at: 1226, wide: true },
      { y: 795, x: 200, dx: 560, o: 0.5, at: 1218, wide: false },
      { y: 940, x: 960, dx: -480, o: 0.46, at: 1210, wide: true },
      { y: 1085, x: 340, dx: 620, o: 0.62, at: 1204, wide: false },
      { y: 1230, x: 780, dx: -360, o: 0.5, at: 1208, wide: true },
    ]
    ROWS.forEach((r, i) =>
      add(tinted(`${k('band')} ${i + 1}`, img(r.wide ? 'band-wide' : 'band'), WHITE, r.x, r.y, -0.1 - i * 0.01, 2420, [
        ...cut(r.at, 1312), fadeIn(r.at, 30, 'linear'), move(1200, 1312, { dx: r.dx }), fadeOut(1286, 26, 'linear'),
      ], { opacity: r.o })),
    )
    add(layer({ name: k('deep'), kind: 'shape', shape: 'rect', shapeWidth: 12, shapeHeight: 12, color: DEEP, position: [0, 0, -0.4], blocks: [...cut(1196, 1314), fadeIn(1196, 12, 'linear'), fadeOut(1236, 78, 'linear')] }))
  }

  const grow = move(866, 1026, { scaleBy: 1.06 })
  // ------------------------------------------------------------------ 9) telefon alttan yükselir, bildirim iner (1018–1196)
  {
    const widthPx = 924
    const s = (widthPx * U) / BODY_W
    const h = widthPx * 2.07
    // 5. başlık silinirken telefon belirir: veil'in önünde durur (z = FRONT, derinliğe göre küçültülür) ve listede de önde
    add(text(`${t('layerNames.title')} 5`, k('line5'), W / 2, 675, TITLE * depth(FRONT), [...cut(920, 1028), grow, reveal(922, 948), hide(1000, 1026)], { position: P(W / 2, 675, FRONT) }))
    add(veil(3, [...cut(1018, 1040), fadeOut(1018, 22, 'linear')]), veil(4, [...cut(1166, 1196), fadeIn(1166, 30, 'linear')]))
    // üst kenar 1018'de 1080 px, 1186'da 428 px (ölçüldü)
    add(layer({
      name: `${t('layerNames.phone')} 3`, kind: 'phone', color: WHITE, image: file(`prompts-${lang}.jpg`), media: file(`notify-${lang}.mp4`), deviceFinish: 'space',
      position: P(W / 2, 1080 + h / 2, 0), scale: s,
      blocks: [...cut(1018, 1196), move(1018, 1186, { dy: -652 }, RISE)],
    }))
  }

  // ------------------------------------------------------------------ 8) iki başlık (866–1026)
  {
    add(text(`${t('layerNames.title')} 4`, k('line4'), W / 2, 675, TITLE, [...cut(866, 942), grow, reveal(866, 892), hide(912, 940)]))
  }

  // ------------------------------------------------------------------ 7) kart telefondaki yerinde (783–866)
  const scene7: Layer[] = []
  {
    const w0 = 586
    const s = (w0 * U) / BODY_W
    const cy = 468
    // listede kartın ARKASINDA olmalı (kart → veil → telefon): saydam kart görseli derinliğe yazdığı için sıra ters olursa
    // kartın saydam kenarlarında veil çizilmiyor, telefon görünüyordu. Bu yüzden kart katmanlarından sonra eklenir.
    scene7.push(veil(1, [...cut(780, 789), fadeOut(780, 9, 'linear')]), veil(2, [...cut(838, 866), fadeIn(838, 28, 'linear')]))
    scene7.push(layer({
      name: `${t('layerNames.phone')} 2`, kind: 'phone', color: WHITE, image: file(`prompts-${lang}.jpg`), deviceFinish: 'space',
      position: P(W / 2, cy + (cy - 690) * 0.08, 0), scale: s * 1.08,
      blocks: [...cut(780, 866), about(780, 812, W / 2, cy + (cy - 690) * 0.08, 1 / 1.08, SETTLE, W / 2, 690), about(818, 868, W / 2, cy, 1.1, 'ease-in', W / 2, 690)],
    }))
  }

  // ------------------------------------------------------------------ 5–6) sekmeler → cam kart (560–806)
  {
    const SIZE = 40
    const Y = 650
    const tabs = [k('tabFeed'), k('tabPrompts'), k('tabAbout')]
    const details = k('tabDetails')
    const cx = [180, 540, 900]
    const leftOf = (label: string, c: number, bold = false) => c - (em(label, bold) * SIZE) / 2
    // sekmeler hafifçe yükselerek belirir; kart açılırken söner
    const RISE_IN: Bezier = [0.2, 0.7, 0.3, 1]
    const drift = move(560, 640, { dy: -34 }, RISE_IN)
    const START_Y = Y + 34
    const side = (label: string, c: number, name: string) =>
      text(name, label, leftOf(label, c), START_Y, SIZE, [...cut(560, 668), fadeIn(560, 22, 'linear'), drift, fadeOut(654, 12)], { align: 'left', opacity: 0.62 })

    // Kart: ortadaki sekmenin arkasında hap belirir (652), küçük karta büyür (658–676), küçük kart büyük karta açılır
    // (712–742, kenarları dalgalanır), büyük kart telefon ekranındaki kartın üstüne iner (778–786) ve orada söner (790–806).
    // Gövde ve başlık şeridi kare kare görsel (her kare bir katman, ayrı renkler). Başlık yazısı sekmenin kendi yazısı:
    // sekmeden kartın başlığına taşınır. Kart, telefon belirirken veil'in önünde kalır: z = FRONT, ölçüler derinliğe
    // göre küçültülür. Kart görsellerinin kadrajı 1040×640, ortası (540, 700).
    const D = depth(FRONT)
    const at = (x: number, y: number, dz: number): Vec3 => { const [px, py] = P(x, y); return [px * D, py * D, FRONT + dz] }
    const mv = (from: number, to: number, p: MoveP, easing: string | Bezier = 'linear') => move(from, to, { ...p, dx: (p.dx ?? 0) * D, dy: (p.dy ?? 0) * D }, easing)
    const CARD_Y = 700
    const CARD_W = 1040
    /** küçük ve büyük kartın sol üst köşesi (kadraj pikseli) */
    const S = { x: 68, y: 608 }
    const B = { x: 150, y: 430, w: 780, cy: 702 }
    /** başlık yazısının kartın sol kenarına uzaklığı; simge yazının 25.5 px solunda */
    const TITLE_X = 72
    /** kartın açılma eğrisi (görsellerdeki boyut eğrisiyle aynı: yavaş başlar, yavaş biter) */
    const GROW: Bezier = [0.42, 0, 0.5, 1]
    // telefon ekranındaki kart (telefon oturduğunda; render'dan ölçüldü)
    const SCREEN = { cx: 540.5, cy: 692.1, w: 528 }
    const ZOOM = 1.08 // telefon 780–812 arasında bu kadar büyükten oturur; kart da onunla birlikte küçülür
    const PIVOT_Y = 690
    /** (x, y) noktasındaki katmanı büyük kartla birlikte telefondaki yerine indirir, sonra telefonun oturmasını izler */
    const land = (x: number, y: number): BlockSpec[] => {
      const f = (SCREEN.w / B.w) * ZOOM
      const tcx = W / 2 + (SCREEN.cx - W / 2) * ZOOM
      const tcy = PIVOT_Y + (SCREEN.cy - PIVOT_Y) * ZOOM
      const x1 = tcx + (x - W / 2) * f
      const y1 = tcy + (y - B.cy) * f
      return [
        mv(778, 786, { dx: x1 - x, dy: y1 - y, scaleBy: f }, GLIDE),
        mv(780, 812, { dx: (x1 - W / 2) * (1 / ZOOM - 1), dy: (y1 - PIVOT_Y) * (1 / ZOOM - 1), scaleBy: 1 / ZOOM }, SETTLE),
      ]
    }
    const toBig = (extra: MoveP = {}) => mv(712, 726, { dx: B.x - S.x, dy: B.y + 45 - (S.y + 52), ...extra }, GROW)
    /** kartın sağ kenarı açılırken bu kadar kayar (944 → 780 px genişlik) */
    const RIGHT = B.x + B.w - (S.x + 944)
    const gone = fadeOut(792, 12, 'linear')
    const cardImage = (name: string, src: string, color: string | null, dz: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
      layer({ name, kind: 'image', color: color ?? WHITE, tint: color !== null, image: src, position: at(W / 2, CARD_Y, dz), scale: sc(CARD_W) * D, blocks, ...extra })

    // başlık: sekmenin yeni adı + simgesi. Sekmeden küçük kartın başlığına (658–676), oradan büyük kartın başlığına (712–726)
    const dLeft = leftOf(details, cx[1] + 26, true)
    const driftF = mv(560, 640, { dy: -34 }, RISE_IN)
    const titleS = { x: S.x + TITLE_X, y: S.y + 52 }
    const titleB = { x: B.x + TITLE_X, y: B.y + 45 }
    const SHRINK = 0.75
    add(layer({
      name: k('tabDetailsName'), kind: 'text', text: details, fontFamily: FONT, fontWeight: 700, fontSize: SIZE * D * U, textWidth: 40, align: 'left', color: WHITE, position: at(dLeft, START_Y, 0.06),
      blocks: [...cut(604, 806), driftF, reveal(604, 628, 0.3), mv(658, 676, { dx: titleS.x - dLeft, dy: titleS.y - Y, scaleBy: SHRINK }, SETTLE), toBig(), ...land(titleB.x, titleB.y), gone],
    }))
    add(layer({
      name: k('spark'), kind: 'image', color: WHITE, tint: true, image: img('spark'), position: at(dLeft - 34, START_Y, 0.06), scale: sc(36) * D,
      blocks: [...cut(604, 806), fadeIn(604, 10), driftF, mv(658, 676, { dx: titleS.x - 34 * SHRINK - (dLeft - 34), dy: titleS.y - Y, scaleBy: SHRINK }, SETTLE), toBig(), ...land(titleB.x - 34 * SHRINK, titleB.y), gone],
    }))
    // başlığın sağı: satır sayısı ve ok (kart açılınca ok yukarı döner)
    add(cardImage(k('cardMeta'), img(`card-meta-${lang}`), null, 0.05, [...cut(664, 806), fadeIn(666, 10), toBig({ dx: RIGHT }), ...land(W / 2 + RIGHT, CARD_Y + B.y + 45 - (S.y + 52)), gone], { opacity: 0.9 }))
    add(layer({
      name: k('chev'), kind: 'image', color: WHITE, tint: true, image: img('chev'), position: at(S.x + 944 - 44, S.y + 52, 0.05), scale: sc(24) * D, opacity: 0.9,
      blocks: [...cut(664, 806), fadeIn(666, 10), toBig({ dx: RIGHT, rotate: 180 }), ...land(B.x + B.w - 44, B.y + 45), gone],
    }))
    // içerik: küçük kartta tek satır (kart açılırken ilk kaydın yerine doğru kayıp söner); büyük kartta iki kayıt sırayla,
    // alttan hafifçe yükselerek belirir
    add(cardImage(k('cardSmall'), img(`card-row-${lang}`), null, 0.05, [...cut(666, 722), fadeIn(668, 10), mv(712, 726, { dx: 36, dy: -96 }, GROW), fadeOut(713, 8)]))
    const entry = (n: number, from: number) =>
      layer({ name: `${k('cardBig')} ${n}`, kind: 'image', color: WHITE, image: img(`card-e${n}-${lang}`), position: at(W / 2, CARD_Y + 18, 0.05), scale: sc(CARD_W) * D, blocks: [...cut(from, 806), fadeIn(from, 12), mv(from, from + 16, { dy: -18 }, SETTLE), ...land(W / 2, CARD_Y), gone] })
    add(entry(1, 718), entry(2, 725))
    // açılırken kartın üstünden geçen ışık
    add(cardImage(k('sheen'), img('card-sheen'), null, 0.04, [...cut(718, 750), fadeIn(718, 8, 'linear'), fadeOut(730, 18, 'linear')], { opacity: 0.5 }))
    // başlık şeridi ve gövde: açılış kareleri (712–741), son kare telefona inene kadar durur
    const settle = (name: string, src: string, color: string, dz: number) =>
      cardImage(name, src, color, dz, [...cut(740.5, 806), ...land(W / 2, CARD_Y), fadeOut(790, 14, 'linear')])
    add(settle(`${k('panelBig')} · ${k('head')}`, img('card-h-29'), GLASS_HEAD, 0.03))
    for (let i = 28; i >= 0; i--) add(cardImage(`${k('panelBig')} · ${k('head')} ${i + 1}`, img(`card-h-${pad(i)}`), GLASS_HEAD, 0.03, frame(712 + i)))
    add(settle(k('panelBig'), img('card-g-29'), GLASS, 0.02))
    for (let i = 28; i >= 0; i--) add(cardImage(`${k('panelBig')} ${i + 1}`, img(`card-g-${pad(i)}`), GLASS, 0.02, frame(712 + i)))
    // hap → küçük kart (658–675); son kare 712'ye kadar durur
    add(cardImage(k('panelSmall'), img('card-p-17'), GLASS, 0.02, cut(674.5, 711.5)))
    for (let i = 16; i >= 0; i--) add(cardImage(`${k('panelSmall')} ${i + 1}`, img(`card-p-${pad(i)}`), GLASS, 0.02, frame(658 + i)))
    add(cardImage(`${k('panelSmall')} 0`, img('card-p-00'), GLASS, 0.02, [...cut(650, 657.5), fadeIn(650, 7, 'linear')]))
    add(...scene7)
    // ortadaki sekmenin eski adı silinir, yenisi belirir
    add(text(`${k('tab')} 2`, tabs[1], leftOf(tabs[1], cx[1]), START_Y, SIZE, [...cut(560, 612), fadeIn(560, 22, 'linear'), drift, hide(596, 610, 0.3)], { align: 'left', opacity: 0.62 }))
    add(side(tabs[0], cx[0], `${k('tab')} 1`), side(tabs[2], cx[2], `${k('tab')} 3`))
    // alt çizgiler: ince taban çizgisi ve etkin sekmenin çizgisi (ilk sekmeden ortadakine kayar)
    const lineY = START_Y + 46
    add(layer({ name: k('tabActive'), kind: 'shape', shape: 'rect', shapeWidth: 150 * U, shapeHeight: 3 * U, color: WHITE, position: P(cx[0], lineY, 0.04), blocks: [...cut(566, 664), fadeIn(566, 16, 'linear'), drift, move(592, 610, { dx: cx[1] - cx[0], scaleBy: 2.2 }, GLIDE), fadeOut(652, 8)] }))
    add(layer({ name: k('tabLine'), kind: 'shape', shape: 'rect', shapeWidth: 930 * U, shapeHeight: 1.5 * U, color: WHITE, opacity: 0.45, position: P(W / 2, lineY, 0.03), blocks: [...cut(560, 664), fadeIn(560, 22, 'linear'), drift, fadeOut(654, 10)] }))
    // dalışın arkasındaki geniş yaylar
    // Yaylar perde (veil 0) bittikten sonra ve ARKADA başlar: öne (z = 3.2) alınınca saydam görsel derinliğe yazıp
    // arkasındaki sekme yazılarını 612. kareye kadar kesiyordu.
    add(tinted(`${k('arcs')} 1`, img('arcs'), WHITE, 560, 700, -0.2, 1700, [...cut(556, 614), fadeIn(556, 18, 'linear'), move(556, 614, { dx: 50, dy: 34 }), fadeOut(582, 30, 'linear')]))
  }

  // ------------------------------------------------------------------ 4) telefon: yakından uzaklaşır, akış kayar, sekmelere dalar (336–560)
  {
    const w1 = 630 // oturduğu genişlik (px)
    const s1 = (w1 * U) / BODY_W
    const c1 = 400 // oturduğu andaki merkez y
    const ANCHOR = 686 // uzaklaşma kadrajın ortasındaki noktaya göre (ölçüldü)
    const f0 = 1100 / w1
    const c0 = ANCHOR + (c1 - ANCHOR) * f0
    // dalış: sekme satırı (ekranın %47.8'i) kadrajın altına iner, telefon geriye yatar
    const tabY = c1 - 0.022 * w1 * 2.07
    const f2 = 2.7
    // dalışın sonunda telefon solmaz (saydamlaşınca arkası görünüyordu): görünen kısmı z < 0'da olduğu için önüne veil çekilir
    // (yatan telefonun alt yarısı kameraya yaklaştığı için bu sahnede veil daha önde: z = 3)
    add(veil(0, [...cut(528, 556), fadeIn(528, 26, 'linear')], 3))
    add(layer({
      name: `${t('layerNames.phone')} 1`, kind: 'phone', color: WHITE, image: file(`prompts-${lang}.jpg`), media: file(`feed-${lang}.mp4`), deviceFinish: 'space',
      position: P(W / 2, c0, 0), scale: s1 * f0,
      blocks: [
        ...cut(336, 556),
        about(336, 462, W / 2, c0, 1 / f0, PULL, W / 2, ANCHOR),
        move(464, 552, { dy: 1440 + (c1 - tabY) * f2 - c1, scaleBy: f2, rotX: -60 }, DIVE),
      ],
    }))
  }

  // ------------------------------------------------------------------ 3) etiket: koruyucu yaprak soyulur (288–336)
  {
    const CY = 668
    const drift = move(286, 336, { dx: -34 }, [0.2, 0.6, 0.4, 1])
    const X = W / 2 + 34
    const rowSize = 165
    const row = k('row')
    const date = k('date')
    // yaprak: her kare ayrı görsel (30 kare), beyaz → boyanır. Klip yarım kare erken başlar: `F` mikro saniyeye
    // yuvarladığı için tam kare sınırında başlayan tek karelik klip o kareyi kaçırabiliyor.
    for (let i = 29; i >= 0; i--) add(tinted(`${k('sheet')} ${i + 1}`, img(`peel-${String(i).padStart(2, '0')}`), WHITE, X, CY, 0.12, 900, [...cut(287.5 + i, 288.5 + i), drift]))
    add(text(k('badgeName'), k('badge'), X, CY + 6, 138, [...cut(288, 336), fadeIn(288, 6, 'linear'), drift], { fontWeight: 700, color: MAGENTA, position: P(X, CY + 6, 0.1) }))
    add(tinted(k('badgePlate'), img('badge'), PINK, X, CY, 0.08, 760, [...cut(288, 336), fadeIn(288, 6, 'linear'), drift]))
    add(tinted(k('badgeGlow'), img('badge-shadow'), PINK, X, CY + 14, 0.06, 900, [...cut(292, 336), fadeIn(292, 20, 'linear'), drift], { opacity: 0.4 }))
    // etiketin iki yanındaki dev satır (kadrajdan taşar) ve alttaki cümle: bulanıktan netleşir
    add(text(`${k('rowName')} 1`, row, X - 320 - 70, CY, rowSize, [...cut(294, 336), fadeIn(296, 16, 'linear'), drift, move(294, 336, { dx: 46 }, [0.2, 0.6, 0.4, 1])], { align: 'right', position: P(X - 320 - 70, CY, 0.05) }))
    add(text(`${k('rowName')} 2`, date, X + 320 + 70, CY, rowSize, [...cut(302, 336), fadeIn(304, 16, 'linear'), drift, move(302, 336, { dx: -46 }, [0.2, 0.6, 0.4, 1])], { align: 'left', opacity: 0.9 }))
    const liveSize = 215
    const live = k('live')
    const liveW = em(live) * liveSize
    const right = 1068
    const slide = move(286, 336, { dx: -78 }, [0.2, 0.6, 0.4, 1])
    add(text(k('liveName'), live, right, 1092, liveSize, [...cut(300, 336), fadeIn(302, 20, 'linear'), slide], { align: 'right', opacity: 0.86 }))
    add(image(`${k('liveName')} (blur)`, img(`live-blur-${lang}`), right - liveW + 1550, 1092, 0.03, 3300, [...cut(286, 326), fadeIn(286, 10, 'linear'), slide, fadeOut(304, 20, 'linear')], { opacity: 0.7 }))
  }

  // ------------------------------------------------------------------ 2) üç başlık (96–288)
  {
    const shrink = move(96, 288, { scaleBy: 0.9 })
    // eski başlık soldan sağa yavaşça silinir; yenisi onun arkasından, aynı yerde belirir (ölçülen kareler)
    add(text(`${t('layerNames.title')} 3`, k('line3'), W / 2, 675, TITLE, [...cut(216, 290), shrink, reveal(218, 240), hide(264, 288)]))
    add(text(`${t('layerNames.title')} 2`, k('line2'), W / 2, 675, TITLE, [...cut(152, 234), shrink, reveal(154, 176), hide(200, 232)]))
    add(text(`${t('layerNames.title')} 1`, k('line1'), W / 2, 675, TITLE, [...cut(96, 172), shrink, reveal(96, 117), hide(144, 170)]))
    // 3. başlığa geçişte yazının iki yanında yanıp sönen ışık lekeleri
    const blob = (n: number, x: number, y: number, w: number, from: number, o: number) =>
      tinted(`${k('flare')} ${n}`, img('blob'), WHITE, x, y, 0.02, w, [...cut(from, from + 30), fadeIn(from, 10, 'linear'), about(from, from + 30, x, y, 1.5, 'ease-out', x, y), fadeOut(from + 14, 16, 'linear')], { opacity: o })
    add(blob(1, 850, 675, 380, 210, 0.95), blob(2, 250, 675, 300, 208, 0.55), blob(3, 520, 690, 170, 214, 0.5))
    // kenarlardan içeri doğru halkalar
    add(tinted(k('ripples'), img('ripples'), WHITE, W / 2, H / 2, -0.2, W * 1.02, [...cut(98, 292), fadeIn(98, 30, 'linear'), about(98, 292, W / 2, H / 2, 1.07, 'linear'), fadeOut(272, 18, 'linear')]))
  }

  // ------------------------------------------------------------------ 1) gözler (1–96)
  {
    const CX = 540
    const CY = 672
    const EYE_W = 370
    // gözlerin ortası görselin ortasının 28/500 altında: katman o kadar yukarıda durur
    const LY = CY - (28 / 500) * EYE_W
    // 1–10 hafif büyüyerek oturur; 10–23 sola, sonra sağa bakar; 26–30 kapanır (halkalar savrulur), 47–51 açılır;
    // 48–62 büyür, sağ üste ve sola bakar; 80–96 küçülüp kaybolur
    add(...eyes({
      tag: '', x: CX, y: LY + 12, z: 0.05, widthPx: EYE_W, from: 1, to: 97, blinks: [[26, 47]], baseScale: 0.8,
      shared: [move(1, 10, { scaleBy: 1 / 0.8, dy: -12 }, SETTLE), move(48, 62, { scaleBy: 1.48 }, SETTLE), move(80, 96, { scaleBy: 0.7 }, [0.5, 0, 0.9, 0.5]), fadeOut(91, 5, 'linear')],
      look: [
        [move(9, 15, { dx: -15, dy: 5 }, GLIDE), move(17, 24, { dx: 15, dy: -5 }, GLIDE)],
        [move(55, 63, { dx: 22, dy: -9 }, GLIDE), move(69, 77, { dx: -42, dy: 4 }, GLIDE)],
      ],
    }))
    // halkalar gözlerin arkasından açılır (2–27), gözler kapanınca kadrajın dışına savrulur (29–44)
    const open = [move(2, 27, { scaleBy: 1 / 0.42 }, [0.1, 0.7, 0.3, 1]), move(29, 44, { scaleBy: 3.4, rotate: 14 }, [0.5, 0, 0.8, 0.6])]
    add(tinted(k('rings'), img('lobes'), WHITE, CX, CY, -0.05, 1130, [...cut(2, 46), fadeIn(2, 6, 'linear'), ...open, fadeOut(34, 11, 'linear')], { scale: sc(1130) * 0.42 }))
    add(tinted(k('ringShade'), img('lobes-shade'), SHADE, CX, CY, -0.1, 1130, [...cut(2, 46), fadeIn(2, 8, 'linear'), ...open, fadeOut(30, 12, 'linear')], { scale: sc(1130) * 0.42, opacity: 0.2 }))
  }

  // Ses efektleri: her grup videonun tamamı boyunca süren ayrı bir parça; seviyesi zaman çizelgesinden ayrı ayarlanır.
  // Olaylar videodaki karelerle eşli olduğu için parçalar 0'dan başlar; kaydırılırsa eşleme bozulur.
  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: file(`sfx/${group}.mp3`),
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  return {
    ...project(k('name'), END, BG_TOP, layers, camera([])),
    backgroundStyle: 'linear',
    background2: BG_BOTTOM,
    audio: sfx,
    width: W,
    height: H,
    fps: 60,
    lighting: 'studio',
    accentLight: '#C9CFFF',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      motionBlur: { enabled: true, samples: 8, shutter: 0.5 },
    },
  }
}
