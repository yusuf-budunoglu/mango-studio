import i18n from '../i18n'
import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { GEM_EM } from './hiddenGemMetrics'

// "Hidden gem": yatay (1920×1080, 60 kare/sn, 9.5 sn) ürün tanıtımı teaser'ı; Mango Studio'yu tanıtır. Temposu, hareket dili
// ve renkleri 24 kare/sn'lik bir SaaS lansman filminin 6.5–16. saniyeleri arasından kare kare ölçüldü (referanstaki 5–6.5 sn
// kulaklık açılışı kullanıcı kararıyla çıkarıldı). `F(i)` referans aralığının (5. saniyeden başlayan) karesini şablonun
// saniyesine çevirir: (i - 36) / 24; ölçüler 1920×1080 pikseli. Renkler referanstan birebir (kullanıcı kararı 2026-10-14);
// metinler, 3D kumaş yığını, mücevher, afişler (kendi şablon kapaklarımız ve kendi afiş tasarımımız) ve tablet ekranları bizim.
// Sahneler (referans kareleri; kesmeler 60, 105, 139, 176, 192, 226, 250, 259):
//  B mavi: "Every" + "100" yazılır (36–59)
//  C açık gri: "Every 100 prompts", 3D kumaş yığını yükselir ve batar, "there's one" (60–104)
//  D bulutlu mavi: "hidden" → "hidden gem"; kelimeler aralanır, altın mücevher yandan dönerek açılır ve kapanır (105–138)
//  E açık gri: büyük "Don't" küçülür ve söner, "Don't miss it." kelime kelime, sonda uzaklaşır (139–175)
//  F koyu: "Introducing" küçülerek oturur (176–191)
//  G koyu masa: afişler gerçek 3D düzlemde (referanstan çözülen masa açısı); kamera iki vuruşla içeri dalar, süzülür, kaçar (192–225)
//  H tablet (cihaz sabit): satırları ters yönlerde kayan karolu ekran (226–249), slogan (250–258), kapanış kartı (259–263)
// 3D yığın ve mücevher three.js ile kodla çizildi: yığın 24 kare/sn'lik dizi (referansın temposu), mücevher 60 kare/sn'lik ve
// hareket bulanıklıklı dizi. Görseller, tablet ekranları ve yazı genişlikleri: node scripts/build-hidden-gem-assets.mjs.
// Ses: dört efekt grubu (public/templates/hidden-gem/sfx/*.mp3; Desktop/launch-ad-sfx projesindeki HiddenGem kompozisyonu).
// Konuşma ve müzik yok.

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
const P = (x: number, y: number, z = 0): Vec3 => [(x - W / 2) * U * depth(z), (H / 2 - y) * U * depth(z), z]
/** şablonun başladığı referans karesi: referanstaki kulaklık açılışı (0–35) çıkarıldı */
const START = 36
/** referans karesi (24 kare/sn, 5. saniyeden başlar) → şablonun saniyesi; mikro saniyeye yuvarlanır */
const F = (i: number) => Math.round(((i - START) / 24) * 1e6) / 1e6
/** kare sayısı (referans) → süre (sn) */
const D = (frames: number) => Math.round((frames / 24) * 1e6) / 1e6
/** tek anda olan değişiklikler (kesme, belirme) karenin bir kıl öncesinde: yuvarlama yüzünden kare kaçmasın */
const AT = (i: number) => Math.max(0, F(i) - 2e-6)
const SRC_FRAMES = 264
const END = F(SRC_FRAMES)

// Renkler referanstan ölçüldü (hepsi katman rengi; editörden değişir)
const BLUE = '#4758DD'
const BLUE_TEXT = '#485AD3'
const BLUE_BIG = '#4C5CDB'
const SKY = '#5670DD'
const SKY_DARK = '#485BDB'
const SKY_MID = '#6A8DE0'
const SKY_LIGHT = '#729BE0'
const PAPER = '#EDEDED'
const PAPER_E = '#EDECEF'
const INK = '#2E2E33'
const WHITE = '#FFFFFF'
const CHARCOAL = '#1F2025'
const TABLE = '#201F21'
const NIGHT = '#1B171F'
const NAVY = '#2C325D'
const FLOOR = '#4C6CC4'
const FLOOR_GLOW = '#7FA2E6'

/** masa düzlemi: referansta afiş köşelerinden kameramızla (fov 40, z = 9) çözüldü (three.js Euler XYZ, derece) */
const TABLE_ROT: Vec3 = [-4.84, 9.06, 9.27]
const RAD = Math.PI / 180
/** yerel noktayı (düzlemde u, v; normali boyunca lift) dünyaya çevirir: three.js Euler 'XYZ' matrisi Rx·Ry·Rz */
const onTable = (u: number, v: number, lift = 0): Vec3 => {
  const [a, b, c] = TABLE_ROT.map((d) => d * RAD)
  const x1 = u * Math.cos(c) - v * Math.sin(c)
  const y1 = u * Math.sin(c) + v * Math.cos(c)
  const x2 = x1 * Math.cos(b) + lift * Math.sin(b)
  const z2 = -x1 * Math.sin(b) + lift * Math.cos(b)
  return [x2, y1 * Math.cos(a) - z2 * Math.sin(a), y1 * Math.sin(a) + z2 * Math.cos(a)]
}

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
/** iki anahtar arasında yumuşak geçiş (bezier eğrisiyle aynı biçim: x zaman, y ilerleme) */
const ease = (a: Key, b: Key, bz: Bezier) => {
  const solve = (x: number) => {
    let t = x
    for (let k = 0; k < 20; k++) {
      const cx = 3 * bz[0] * t * (1 - t) ** 2 + 3 * bz[2] * t ** 2 * (1 - t) + t ** 3
      const dx = 3 * bz[0] * (1 - t) ** 2 + 6 * (bz[2] - bz[0]) * t * (1 - t) + 3 * (1 - bz[2]) * t ** 2
      if (Math.abs(cx - x) < 1e-7 || Math.abs(dx) < 1e-7) break
      t -= (cx - x) / dx
    }
    return 3 * bz[1] * t * (1 - t) ** 2 + 3 * bz[3] * t ** 2 * (1 - t) + t ** 3
  }
  return (f: number) => (f <= a[0] ? a[1] : f >= b[0] ? b[1] : a[1] + (b[1] - a[1]) * solve((f - a[0]) / (b[0] - a[0])))
}
const OUT: Bezier = [0.2, 0.7, 0.3, 1]

/** Katmanın o karedeki duruşu: konum (px), dönüş (derece; `rot` saat yönü, `rotY` Y ekseni), ölçek çarpanı. */
interface Pose { x: number; y: number; rot?: number; rotY?: number; s?: number }
/** Kesintisiz bir hareket parçası; parçalar arasında duruş tek anda değişir. */
interface Section { from: number; to: number; pose: (f: number) => Pose; step?: number }

/** kelimenin ilerleme genişliği (em): 0 = Inter 500, 1 = Inter 600 */
const em = (word: string, weight: 0 | 1 = 0) => GEM_EM[word]?.[weight] ?? word.length * 0.55
const SPACE = (weight: 0 | 1 = 0) => GEM_EM[' '][weight]
/** troika metni satır kutusunun ortasından hizalar; büyük harflerin ortası 0.18 em yukarıda kalır (render'dan ölçüldü) */
const TEXT_DROP = 0.18
/** cümleyi ortalayıp her kelimenin sol kenarını verir */
const layout = (words: string[], size: number, cx: number, weight: 0 | 1 = 0) => {
  const widths = words.map((w) => em(w, weight) * size)
  const total = widths.reduce((s, w) => s + w, 0) + (words.length - 1) * SPACE(weight) * size
  let x = cx - total / 2
  return words.map((_, i) => {
    const left = x
    x += widths[i] + SPACE(weight) * size
    return left
  })
}

export function buildHiddenGem({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const file = (name: string) => `${base}templates/hidden-gem/${name}`
  const lang: 'en' | 'tr' = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.hidden-gem.${key}`)

  const cut = (from: number, to: number) => [b('fade-in', AT(from), 0), b('fade-out', AT(to), 0)]
  const fadeIn = (from: number, frames: number) => b('fade-in', F(from), D(frames), { easing: 'linear' })
  const fadeOut = (from: number, frames: number) => b('fade-out', F(from), D(frames), { easing: 'linear' })

  /** duruşları `move` bloklarına çevirir (son parçada bitişten önceki sınır atlanır: `fitClip` son kareyi gizlemesin) */
  const poseBlocks = (sections: Section[], scale: number): BlockSpec[] => {
    const out: BlockSpec[] = []
    const delta = (p: Pose, q: Pose) => ({
      dx: (q.x - p.x) * U * scale, dy: -(q.y - p.y) * U * scale, rotate: -((q.rot ?? 0) - (p.rot ?? 0)), rotY: (q.rotY ?? 0) - (p.rotY ?? 0), scaleBy: (q.s ?? 1) / (p.s ?? 1),
    })
    const still = (d: ReturnType<typeof delta>) => Math.abs(d.dx) < 1e-7 && Math.abs(d.dy) < 1e-7 && Math.abs(d.rotate) < 1e-6 && Math.abs(d.rotY) < 1e-6 && Math.abs(d.scaleBy - 1) < 1e-7
    sections.forEach((section, i) => {
      if (i > 0) {
        const prev = sections[i - 1]
        const jump = delta(prev.pose(prev.to), section.pose(section.from))
        if (!still(jump)) out.push(b('move', AT(section.from), 0, { params: jump }))
      }
      const step = section.step ?? 1
      const closing = i === sections.length - 1
      for (let f = section.from; f < section.to - 1e-9; ) {
        let g = Math.min(section.to, f + step)
        if (closing && Math.abs(g - (section.to - 1)) < 1e-9) g = section.to
        const d = delta(section.pose(f), section.pose(g))
        if (!still(d)) out.push(b('move', F(f), D(g - f), { params: d, easing: 'linear' }))
        f = g
      }
    })
    return out
  }
  const placed = (spec: Omit<LayerSpec, 'position' | 'blocks'>, z: number, sections: Section[], extra: BlockSpec[] = [], size = 1, rotation: [number, number] = [0, 0]) => {
    const first = sections[0].pose(sections[0].from)
    const last = sections[sections.length - 1]
    return layer({
      ...spec,
      position: P(first.x, first.y, z),
      rotation: [rotation[0], rotation[1] + (first.rotY ?? 0), -(first.rot ?? 0)],
      scale: size * depth(z) * (first.s ?? 1),
      blocks: [...cut(sections[0].from, last.to), ...poseBlocks(sections, depth(z)), ...extra],
    })
  }
  const still = (from: number, to: number, x: number, y: number, extra: Partial<Pose> = {}): Section[] => [{ from, to, pose: () => ({ x, y, ...extra }) }]
  /** ekranı kaplayan zemin (şekil, rengi düzenlenir); derinde durur: eğik duran tabletin ve afişlerin geride kalan kenarı zeminin arkasına düşmesin */
  const backdrop = (name: string, color: string, from: number, to: number, extra: BlockSpec[] = []) =>
    placed({ name, kind: 'shape', shape: 'rect', shapeWidth: (W + 40) * U, shapeHeight: (H + 40) * U, color }, -3, still(from, to, W / 2, H / 2), extra)
  const image = (name: string, src: string, widthPx: number, z: number, sections: Section[], extra: BlockSpec[] = [], more: Partial<LayerSpec> = {}, rotation: [number, number] = [0, 0]) =>
    placed({ name, kind: 'image', color: WHITE, image: src, ...more }, z, sections, extra, (widthPx * U) / 3, rotation)
  /** yazı: Inter 500 / 600; duruş satırın sol ucu ve büyük harf ortası */
  const text = (name: string, value: string, size: number, color: string, z: number, sections: Section[], extra: BlockSpec[] = [], more: Partial<LayerSpec> = {}) =>
    placed(
      { name, kind: 'text', text: value, fontFamily: 'inter-medium', fontWeight: 400, fontSize: size * U, textWidth: 40, align: 'left', color, ...more },
      z,
      sections.map((section) => ({ ...section, pose: (f: number) => { const p = section.pose(f); return { ...p, y: p.y + TEXT_DROP * size * (p.s ?? 1) } } })),
      extra,
    )

  const layers: Layer[] = []
  /** sona eklenen katman listede arkada kalır: önce öndekiler eklenir */
  const add = (...items: Layer[]) => layers.push(...items)

  // ---------------------------------------------------------------- H) tablet (226–263): üç çekim, her biri ayrı tablet katmanı
  {
    // tablet modeli ölçek 1'de 3.6 birim geniş; ekran referanstaki gibi ~1200 px görünsün (perspektifle). Sağ kenarı önde (Y'de -11°).
    const TABLET = { x: 820, y: 580, scale: (1035 * U) / 3.6, rot: [3, -11, 3.2] as [number, number, number] }
    // referansta cihaz bu sahnede hiç kımıldamıyor (ölçüldü); hareket yalnızca ekrandaki karolarda
    const shot = (n: number, from: number, to: number, screen: { image?: string; media?: string }) =>
      layer({
        name: `${t('layerNames.tablet')} ${n}`, kind: 'tablet', color: WHITE, deviceFinish: 'space', ...screen,
        position: P(TABLET.x, TABLET.y), rotation: TABLET.rot, scale: TABLET.scale,
        blocks: cut(from, to),
      })
    add(shot(3, 259, SRC_FRAMES, { image: file(`screen-3-${lang}.jpg`) }))
    add(shot(2, 250, 259, { image: file(`screen-2-${lang}.jpg`) }))
    add(shot(1, 226, 250, { image: file(`screen-2-${lang}.jpg`), media: file(`screen-1-${lang}.mp4`) }))
    // zemin: referanstaki parlak mavi zemin tam cihazın altından başlar (cihaz zeminde durur); cihazın altında ekranın
    // açık mavi yansıması, zeminin ortasında parlama. Işık yukarı, arka plana taşmaz.
    add(image(k('reflection'), file('blob.png'), 1150, -2.3, still(226, SRC_FRAMES, 830, 1010), [], { tint: true, color: '#AFC2F4', opacity: 0.5 }))
    add(image(k('floorGlow'), file('blob.png'), 1500, -2.4, still(226, SRC_FRAMES, 880, 1150), [], { tint: true, color: FLOOR_GLOW, opacity: 0.7 }))
    add(placed({ name: k('floor'), kind: 'shape', shape: 'rect', shapeWidth: (W + 200) * U, shapeHeight: 140 * U, color: FLOOR }, -2.5, still(226, SRC_FRAMES, W / 2, 1036)))
    const block = (n: number, x: number, y: number, w: number, h: number, color: string) =>
      placed({ name: `${k('block')} ${n}`, kind: 'shape', shape: 'rect', shapeWidth: w * U, shapeHeight: h * U, color }, -2.8, still(226, SRC_FRAMES, x, y))
    add(block(1, 770, 300, 230, 620, NAVY), block(2, 200, 560, 560, 780, '#1F2038'), block(3, 1760, 560, 600, 900, '#1F2038'))
    add(backdrop(`${k('background')} H`, NIGHT, 226, SRC_FRAMES))
  }

  // ---------------------------------------------------------------- G) afişler gerçek 3D masa düzleminde (192–225)
  // Afişler aynı düzlemde (TABLE_ROT); yerleri ve boyları referansın 206. karesindeki köşelerden çözüldü (ortalama hata 4 px).
  // Kamera 192–206 arası yavaşlayarak kayar (içerik 52 px sola, 10 px yukarı), 222'den sonra çıkışa hızlanır: perspektif
  // değiştiği için düzlem gerçekten eğik görünür. Her afişin altında yumuşak gölge.
  {
    const POSTER_W = 2.91
    // Hızlı dalışta (192–197) ve kaçışta (222–225) referans kareleri belirgin bulanık (24 kare/sn, tam pozlama): kameranın
    // gerçek hareket bulanıklığına ek olarak afişler ve yazı bulanıktan netleşir / bulanıklaşır. Bloklar klipten önce başlar
    // ve sonra biter: 192'de belirme yarıda (opaklık tam, bulanıklık yarıda), 226'da kaybolma yarıda (opaklık hâlâ tam).
    // Hafif tutulur (kullanıcı "hafif hareket bulanıklığı" istedi): 192'de 0.06 birim, 195'te net; kaçışta 225'te 0.04. Yazıda
    // daha az (troika'nın bulanık konturu harfleri sisli gösteriyor).
    const smear = (amount: number): BlockSpec[] => [
      b('blur-in', F(189), D(6), { params: { amount }, easing: 'linear' }),
      b('blur-out', F(223), D(6), { params: { amount }, easing: 'linear' }),
    ]
    const poster = (name: string, src: string, u: number, v: number, w: number, z: number, lit = true) => {
      const scale = w / 3
      const shadow = layer({ name: `${name} · ${k('shadow')}`, kind: 'image', color: '#000000', tint: true, image: file('card-shadow.png'), position: onTable(u + 0.08, v - 0.14, -0.02), rotation: TABLE_ROT, scale: (w * 1.25) / 3, opacity: 0.55, blocks: cut(192, 226) })
      const card = layer({ name, kind: 'image', color: WHITE, image: src, position: onTable(u, v, z), rotation: TABLE_ROT, scale, blocks: [...cut(192, 226), ...smear(0.12)] })
      if (!lit) return [card, shadow]
      // kartın ışığı: sağ üstten vuran ışık, sol alt koyu, kenarda ince parlak çizgi (afişin hemen üstünde)
      const shade = layer({ name: `${name} · ${k('light')}`, kind: 'image', color: WHITE, image: file('card-shade.png'), position: onTable(u, v, z + 0.006), rotation: TABLE_ROT, scale, blocks: [...cut(192, 226), ...smear(0.12)] })
      return [shade, card, shadow]
    }
    // masanın ışığı: ortada yumuşak ışık havuzu, kenarlara doğru kararma (masa düzleminde: kamera yaklaştıkça perspektifle büyür)
    add(layer({ name: k('vignette'), kind: 'image', color: WHITE, image: file('vignette.png'), position: onTable(0.4, -0.4, 0.05), rotation: TABLE_ROT, scale: 17 / 3, opacity: 0.9, blocks: cut(192, 226) }))
    // sol afişin yazısı afişin üstünde, aynı düzlemde; afişin içinde kalsın diye 2.8 birimde satır atlar
    const lines = k('posterLine')
    add(layer({ name: k('posterText'), kind: 'text', text: lines, fontFamily: 'inter-medium', fontWeight: 400, fontSize: 0.56, textWidth: 2.8, align: 'left', color: WHITE, lineHeight: 0.95, letterSpacing: -0.035, position: onTable(-4.85, -0.75, 0.03), rotation: TABLE_ROT, scale: 1, blocks: [...cut(192, 226), ...smear(0.05)] }))
    add(...poster(`${k('poster')} 1`, file('poster-grad.webp'), -3.62, -0.12, 3.06, 0.01))
    add(...poster(`${k('poster')} 2`, file('poster-crystal.webp'), 0.287, -0.065, POSTER_W, 0.01))
    add(...poster(`${k('poster')} 3`, file(`poster-pill-${lang}.webp`), 4.121, -0.015, POSTER_W, 0.01))
    add(...poster(`${k('poster')} 4`, file('poster-wide.webp'), -1.25, 5.05, 5.9, 0.01, false))
    add(...poster(`${k('poster')} 5`, file('poster-grad.webp'), 4.3, -5.75, POSTER_W, 0.01))
    add(...poster(`${k('poster')} 6`, file('poster-grad.webp'), 0.45, -5.95, POSTER_W, 0.01))
    add(layer({ name: k('tableLight'), kind: 'image', color: '#4A4D66', tint: true, image: file('blob.png'), position: onTable(0.4, -0.3, -0.04), rotation: TABLE_ROT, scale: 14 / 3, opacity: 0.55, blocks: cut(192, 226) }))
    add(backdrop(`${k('background')} G`, TABLE, 192, 226))
  }

  // ---------------------------------------------------------------- F) "Introducing" küçülerek oturur (176–191)
  {
    const word = k('introducing')
    const SIZE = 65
    const width = em(word) * SIZE
    const scale = curve([[176, 610], [177, 564], [178, 526], [179, 494], [180, 470], [181, 446], [182, 430], [183, 414], [184, 400], [185, 390], [186, 380], [187, 372], [188, 366], [189, 358], [190, 354], [191, 350], [192, 347]].map(([f, w]): Key => [f, w / 350]))
    // metin sol kenarından ölçeklenmez: ortası 961'de kalsın diye sol kenar ölçekle kayar
    add(text(k('introducingName'), word, SIZE, WHITE, 0.03, [{ from: 176, to: 192, pose: (f) => ({ x: 961 - (width * scale(f)) / 2, y: 540, s: scale(f) }) }]))
    add(image(k('glow'), file('blob.png'), 1800, -2.5, still(176, 192, 1010, 1330), [], { tint: true, color: BLUE, opacity: 0.4 }))
    add(backdrop(`${k('background')} F`, CHARCOAL, 176, 192))
  }

  // ---------------------------------------------------------------- E) "Don't" → "Don't miss it." (139–175)
  {
    const big = k('dont')
    const BIG = 141
    const bigScale = curve([[139, 1.32], [140, 1.21], [141, 1.125], [142, 1.07], [143, 1.035], [144, 1.012], [145, 1]])
    const bigWidth = em(big) * BIG
    add(text(k('dontName'), big, BIG, BLUE_BIG, 0.03, [{ from: 139, to: 147, pose: (f) => ({ x: 962 - (bigWidth * bigScale(f)) / 2, y: 540, s: bigScale(f) }) }], [fadeOut(145.4, 1.2)]))
    // küçük satır: kelimeler art arda belirir, satır 148–160 arası 20 px sola oturur, 170–175 uzaklaşır (ivmelenerek)
    const words = k('line').split(' ')
    const SMALL = 60
    const lefts = layout(words, SMALL, 958)
    const accentAt = Number(k('accentWord'))
    const shift = ease([148, 20], [160, 0], OUT)
    const zoom = curve([[165, 1], [170, 0.951], [171, 0.924], [172, 0.891], [173, 0.837], [174, 0.75], [175, 0.636], [176, 0.5]])
    const appear = [147, 149, 151, 151, 151]
    words.forEach((word, i) => {
      const from = appear[Math.min(i, appear.length - 1)]
      add(text(`${k('lineName')} ${i + 1}`, word, SMALL, i === accentAt ? BLUE : INK, 0.03, [
        { from, to: 165, step: 2, pose: (f) => ({ x: lefts[i] + shift(f), y: 538 }) },
        { from: 165, to: 176, pose: (f) => ({ x: 958 + (lefts[i] - 958) * zoom(f), y: 538, s: zoom(f) }) },
      ], [fadeIn(from, i === 0 ? 1.4 : 0.9)]))
    })
    add(backdrop(`${k('background')} E`, PAPER_E, 139, 176))
  }

  // ---------------------------------------------------------------- D) "hidden gem" + mücevher (105–138)
  {
    const [w1, w2] = [k('hidden'), k('gem')]
    const SIZE = 51
    const [l1, l2] = layout([w1, w2], SIZE, 964)
    const alone = 960 - (em(w1) * SIZE) / 2
    // tek kelime ortada, alttan kayarak gelir (105–113); ikinci kelimeyle çift 114–120 arası sola ortalanır
    const rise = ease([105, 38], [113, 0], OUT)
    const settle = ease([114, 54], [120, 0], OUT)
    // 121–125 kelimeler aralanır (mücevher arada açılır); taş çubuğa inerken 135.4–138 arası hızlanarak kapanır
    const split = (f: number) => (f < 130 ? ease([121, 0], [125, 1], OUT)(f) : ease([135.4, 1], [138, 0], [0.5, 0, 0.85, 0.45])(f))
    // aralanınca kelimelerin arasında, cümlenin ortasında 192 px boşluk açılır (referans); kayma kelime genişliğinden: her dilde aynı
    const GAP = 192
    const open1 = 964 - GAP / 2 - (l1 + em(w1) * SIZE)
    const open2 = 964 + GAP / 2 - l2
    const firstX = (f: number) => (f < 114 ? alone : l1 + settle(f)) + open1 * split(f)
    const secondX = (f: number) => l2 + settle(f) + open2 * split(f)
    add(text(`${k('hiddenName')} 1`, w1, SIZE, WHITE, 0.04, [{ from: 105, to: 139, pose: (f) => ({ x: firstX(f), y: 534 + rise(f) }) }], [fadeIn(105, 1.2)]))
    add(text(`${k('hiddenName')} 2`, w2, SIZE, WHITE, 0.04, [{ from: 114, to: 139, pose: (f) => ({ x: secondX(f), y: 534 }) }], [fadeIn(113.6, 0.6)]))
    // mücevher: three.js'te çizilmiş 3D taş dizisi (60 kare/sn, hareket bulanıklıklı); her görsel tek kare. Referansta tam
    // yandan önden görünene iki karede döner, önden yavaşça dönmeyi sürdürür, aynı yönde dönerek çubuğa iner. Taş 128 px yüksek.
    // Taş yazıların (z 0.04) arkasında: saydam kenarı derinliğe yazdığı için önde dururken kelimeyi kesiyordu.
    for (let n = 40; n >= 0; n--) {
      const f = 121.6 + n * 0.4
      add(image(`${k('gemName')} ${String(n).padStart(2, '0')}`, file(`gem-${String(n).padStart(2, '0')}.webp`), 164, 0.03, still(f, f + 0.4, 964, 543)))
    }
    // bulutlar: mavi zeminde yavaşça kayan açık ve koyu mavi yumuşak ışıklar (referansın renkleri)
    const cloud = (n: number, color: string, x0: number, y0: number, x1: number, y1: number, size: number, opacity: number) =>
      image(`${k('cloud')} ${n}`, file('blob.png'), size, -2 - n * 0.05, [{ from: 105, to: 139, step: 3, pose: (f) => ({ x: x0 + ((x1 - x0) * (f - 105)) / 34, y: y0 + ((y1 - y0) * (f - 105)) / 34 }) }], [], { tint: true, color, opacity })
    add(cloud(1, SKY_LIGHT, 1500, 230, 1420, 280, 1300, 0.85), cloud(2, SKY_MID, 420, 860, 520, 820, 1200, 0.7), cloud(3, SKY_DARK, 980, 640, 900, 600, 1100, 0.8), cloud(4, SKY_LIGHT, 260, 160, 330, 200, 900, 0.6))
    add(backdrop(`${k('background')} D`, SKY, 105, 139))
  }

  // ---------------------------------------------------------------- C) "Every 100 prompts" + kumaş yığını + "there's one" (60–104)
  const phrase = k('phrase').split(' ')
  const PHRASE = 60
  const phraseLefts = layout(phrase, PHRASE, 956)
  {
    // yığın: 24 kare/sn'lik görsel dizisi, her görsel bir referans karesi boyunca (1440×1080 tuval, kadrajın ortasında)
    for (let i = 101; i >= 60; i--) {
      add(image(`${k('stack')} ${String(i - 60).padStart(2, '0')}`, file(`stack-${String(i - 60).padStart(2, '0')}.webp`), 1440, 0.05, still(i, i + 1, 960, 540)))
    }
    const tail = k('tail').split(' ')
    const tailLefts = layout(tail, PHRASE, 960)
    tail.forEach((word, i) => add(text(`${k('tailName')} ${i + 1}`, word, PHRASE, BLUE_TEXT, 0.02, still(96 + i, 105, tailLefts[i], 524), [fadeIn(96 + i, 1.2)])))
    // cümle yığının arkasında kalır; yığın batmadan (90) kesilir
    phrase.forEach((word, i) => add(text(`${k('phraseName')} ${i + 1}`, word, PHRASE, BLUE_TEXT, 0.02, still(60, 90, phraseLefts[i], 538))))
    add(backdrop(`${k('background')} C`, PAPER, 60, 105))
  }

  // ---------------------------------------------------------------- B) "Every" + "100" yazılır (36–59)
  {
    add(text(`${k('phraseName')} B1`, phrase[0], PHRASE, WHITE, 0.02, still(36, 60, phraseLefts[0], 538)))
    // ikinci kelime harf harf: 45'te ilk harf, 46'da tamamı (referanstaki gibi)
    add(text(`${k('phraseName')} B2`, phrase[1], PHRASE, WHITE, 0.02, still(45, 60, phraseLefts[1], 538), [b('typewriter', F(44.5) - 1e-4, D(1.5), { easing: 'linear' })]))
    add(backdrop(`${k('background')} B`, BLUE, 36, 60))
  }

  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: file(`sfx/${group}.mp3`),
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  // Kamera yalnızca afiş sahnesinde hareket eder (192–226). Referansta kare kare ölçüldü (ardışık karelerin benzerlik dönüşümü;
  // dönme yok): iki vuruşlu içeri dalış (192–194 hızlı, 196–201 yumuşak; 192'den 206'ya toplam ~%9.5 yakınlaşma), görüntü
  // ~90 px sola ve ~20 px aşağı süzülür, 206–220 çok yavaş yakınlaşma sürer, 221–225 kamera ~%3 geri çekilip kaçar.
  // `ZOOM[k]`: k. kareden sonrakine ölçek; `SHIFT[k]`: kadraj ortasındaki içeriğin o karedeki kayması (px).
  const ZOOM = [1.036, 1.019, 0.997, 0.998, 1.012, 1.009, 1.0075, 1.006, 1.0044, 1.0003, 1.0007, 1.0007, 1.0004, 1.0005, 1.0007, 1.0006, 1.0007, 1.0005, 1.0007, 1.0006, 1.0006, 1.0006, 1.0005, 1.0005, 1.0003, 1.0003, 1.0002, 1.0001, 0.9999, 0.9983, 0.9964, 0.9929, 0.9805]
  const SHIFT: [number, number][] = [[6.3, -0.8], [3, -0.5], [-8.8, 3], [-7.3, 1.4], [-14.8, 1.9], [-12.1, 1.9], [-9.8, 1.85], [-7.9, 2], [-6.5, 2], [-3.7, 0.6], [-3, 1], [-2.5, 1.1], [-1.8, 0.7], [-1.5, 0.7], [-1, 0.5], [-0.9, 0.6], [-0.5, 0.4], [-0.4, 0.4], [-0.3, 0.3], [-0.2, 0.2], [-0.2, 0.2], [-0.1, 0.2], [-0.1, 0.2], [0, 0.1], [0, 0.1], [0, 0], [0, 0], [0, 0], [0, 0.05], [-0.5, 0.2], [-1.2, 0.4], [-2.2, 0.7], [-6.4, 2.3]]
  // her karedeki kamera: yakınlaşma (206 = 1, afiş düzlemi o kareden çözüldü) ve 206'ya göre konum (sahne birimi)
  const CAM_FROM = 192
  const camZoom: number[] = []
  const camPos: [number, number][] = []
  camZoom[206 - CAM_FROM] = 1
  camPos[206 - CAM_FROM] = [0, 0]
  for (let f = 206; f < 225; f++) {
    const k = f - CAM_FROM
    camZoom[k + 1] = camZoom[k] * ZOOM[k]
    // içerik sola kayarsa kamera sağa gider; kadrajdaki px, o andaki yakınlaşmayla sahne birimine çevrilir
    camPos[k + 1] = [camPos[k][0] - (SHIFT[k][0] * U) / camZoom[k + 1], camPos[k][1] + (SHIFT[k][1] * U) / camZoom[k + 1]]
  }
  for (let f = 205; f >= CAM_FROM; f--) {
    const k = f - CAM_FROM
    camZoom[k] = camZoom[k + 1] / ZOOM[k]
    camPos[k] = [camPos[k + 1][0] + (SHIFT[k][0] * U) / camZoom[k + 1], camPos[k + 1][1] - (SHIFT[k][1] * U) / camZoom[k + 1]]
  }
  const camBlocks: BlockSpec[] = [b('camera-move', AT(CAM_FROM), 0, { params: { dx: camPos[0][0], dy: camPos[0][1], zoom: camZoom[0] } })]
  for (let f = CAM_FROM; f < 225; f++) {
    const k = f - CAM_FROM
    camBlocks.push(b('camera-move', F(f), D(1), { params: { dx: camPos[k + 1][0] - camPos[k][0], dy: camPos[k + 1][1] - camPos[k][1], zoom: ZOOM[k] }, easing: 'linear' }))
  }
  // 225–226 son karede çıkış hızı sürer, 226'da (kesme) kamera başlangıca döner
  const last = camPos[225 - CAM_FROM]
  const exit = SHIFT[SHIFT.length - 1]
  const lastZoom = camZoom[225 - CAM_FROM] * ZOOM[ZOOM.length - 1]
  const exitPos: [number, number] = [last[0] - (exit[0] * U) / lastZoom, last[1] + (exit[1] * U) / lastZoom]
  camBlocks.push(b('camera-move', F(225), D(1), { params: { dx: exitPos[0] - last[0], dy: exitPos[1] - last[1], zoom: ZOOM[ZOOM.length - 1] }, easing: 'linear' }))
  camBlocks.push(b('camera-move', AT(226), 0, { params: { dx: -exitPos[0], dy: -exitPos[1], zoom: 1 / lastZoom } }))

  return {
    ...project(k('name'), END, BLUE, layers, camera(camBlocks)),
    audio: sfx,
    width: W,
    height: H,
    fps: 60,
    lighting: 'studio',
    accentLight: '#C9D2FF',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      // referans 24 kare/sn ve tam pozlamalı: hızlı kayan kelimelerde belirgin bulanıklık
      motionBlur: { enabled: true, samples: 16, shutter: 0.9 },
    },
  }
}
