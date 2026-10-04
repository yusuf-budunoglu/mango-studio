import i18n from '../i18n'
import { preciseCubicBezier } from '../engine/easing'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Mango AI ad": yatay (1920×1080, 60 kare/sn, 21 sn) Mango Studio reklamı. Bir SaaS ürün demosu referansından
// (2560×1440, 29.97 kare/sn) kare kare ölçüldü; kare numaraları referansın kareleri (`s(n)` saniyeye çevirir),
// ölçüler 1920×1080 pikseli. Birebir kopya değil: metinler, renkler, arayüz ve sahneler Mango Studio'ya uyarlandı.
// Sahneler (kesmeler 38, 88, 143, 251, 289, 326, 371, 464, 534; 4–6 tek kesintisiz çekim):
//  1 renk lekeli fonda "Turn your words" (kamera 1.33 → 1, sonra hızlanarak aşağı çıkış)
//  2 parlak turuncu yüzeyde "into videos"            3 beyazda degrade "with intelligence" + yıldız
//  4 istem kartı açılır, imleç gelir                  5 kamera yazıya dalar, istem yakın planda yazılır
//  6 kamera geri çekilir, yazı tamamlanır                 7 Oluştur düğmesine yakın plan, imleç tıklar
//  8 "Motion" satırları arasında "Meet Mango Studio"  9 projenin JSON'u akar
// 10 kontrol listesi → "Your video is ready!"        11 şablon kartları silindirde döner (camera-spin)
// 12 koyu fonda ışık huzmeleri, Mango logosu ve mangostudio.design
// Görseller: node scripts/build-saas-ad-assets.mjs (public/templates/saas-ad).

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
/** referans karesi (29.97 kare/sn) → saniye */
// mikro saniyeye yuvarlanır: fitClip klip kenarlarını mikro saniyeye yuvarlıyor, kayma olmasın
const s = (n: number) => Math.round((n / 29.97) * 1e6) / 1e6
const END = s(630)

// Yazı tipi: Inter Medium (referanstaki SF Pro'ya en yakın; normal = Inter 500, kalın = Inter 600).
const FONT = 'inter-medium'
// Inter 600 ilerleme genişlikleri (em, fontTools); yeni kelime eklenirse tabloya ekle
const EM: Record<string, number> = {
  Turn: 2.2812, your: 2.2065, words: 3.0186, into: 1.8354, videos: 3.2222, Kelimelerini: 5.6948, videoya: 3.8354, 'dönüştür': 4.3687,
}
const SPACE = 0.252
// 5. sahnedeki istemin harf harf birikimli genişliği (Inter 500, em): imleç yazının sonunu izler
const PROMPT_ADV: Record<'en' | 'tr', number[]> = {
  en: [0, 0.9126, 1.4805, 2.0396, 2.627, 2.8936, 3.4615, 3.7281, 3.9801, 4.548, 5.1496, 5.7512, 6.3283, 6.9299, 7.1965, 7.7712, 8.0232, 8.6414, 9.2288, 9.8328, 10.0994, 10.4788, 11.0828, 11.4695, 11.7361, 12.6243, 13.1995, 13.4661, 14.034, 14.6522, 15.2704, 15.5736],
  tr: [0, 0.7402, 1.3154, 1.935, 2.5366, 2.7886, 3.3565, 4.2447, 4.8126, 5.7008, 5.9674, 6.2194, 6.7965, 7.0485, 7.6501, 7.9167, 8.5349, 8.7869, 9.1736, 9.4402, 9.7805, 10.3484, 10.95, 11.202, 11.5423, 11.7943, 12.6825, 12.9491, 13.5238, 13.7758, 14.394, 14.9814, 15.5854, 16.124, 16.7256, 16.9922, 17.5674, 18.1353, 18.7535, 19.0567],
}
// degrade görsellerin mürekkep sınırları (css px; PNG'ler 2 kat)
const INTEL_INK = { en: { x0: 138, x1: 1064, y0: 19.5 }, tr: { x0: 190, x1: 1007.5, y0: 18.5 } }
const MEET_INK = { en: 998, tr: 1117.5 }
const EASE_IN: Bezier = [0.55, 0, 1, 0.45]
const INK = '#1F2430'
const PAGE = '#EBF2FB'

export function buildMangoAiAd({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/saas-ad/${name}.png`
  const lang: 'en' | 'tr' = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.mango-ai-ad.${key}`)

  const move = (from: number, to: number, p: { dx?: number; dy?: number; rotate?: number; rotX?: number; rotY?: number; scaleBy?: number }, easing: string | Bezier = 'ease-in-out') => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, rotY: p.rotY ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', s(from), s(to - from), { params, easing }) : b('move', s(from), s(to - from), { params, easing: 'custom', bezier: easing })
  }
  const cut = (from: number, to: number) => [b('fade-in', s(from), 0), b('fade-out', s(to), 0)]
  const fadeIn = (from: number, frames: number) => b('fade-in', s(from), s(frames), { easing: 'ease-out' })
  const text = (name: string, value: string, x: number, y: number, size: number, color: string, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    // troika metni satır kutusunun ortasına hizalar: mürekkep ortası için 0.15 em aşağı
    layer({ name, kind: 'text', text: value, fontFamily: FONT, fontWeight: 400, fontSize: size * U, textWidth: 40, align: 'left', color, position: P(x, y + 0.15 * size, 0.02), blocks, ...extra })
  const image = (name: string, file: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: P(x, y, z), scale: sc(widthPx), blocks, ...extra })
  /**
   * Oluştur düğmesi + yıldızı: her sahnede aynı orantı (referanstan ölçüldü: yıldız boyu düğme yüksekliğinin %42'si,
   * merkezi genişliğin %25'inde ve dikeyde ortada). Yıldız görselinde şekil karenin %87.5'i.
   */
  const genButton = (x: number, y: number, widthPx: number, blocks: BlockSpec[], sparkBlocks: BlockSpec[] = [], z = 0.01) => {
    const h = widthPx / 3.2
    // yıldız listede önde (z'si de büyük): saydam pikselleri derinliğe yazdığı için arkadaki önce çizilmeli
    return [
      image(t('layerNames.spark'), 'spark', x - 0.25 * widthPx, y + 0.007 * h, z + 0.01, (0.42 * h) / 0.875, [...blocks, ...sparkBlocks]),
      image(t('layerNames.button'), `generate-bare-${lang}`, x, y, z, widthPx, blocks),
    ]
  }
  const backdrop = (name: string, color: string, from: number, to: number) =>
    layer({ name, kind: 'shape', shape: 'rect', shapeWidth: 60, shapeHeight: 40, color, position: [0, 0, -4], blocks: cut(from, to) })
  /** Kelimeleri ortalı dizer: her kelimenin sol kenarı (px) */
  const lineLefts = (words: string[], size: number, cx = 960) => {
    const widths = words.map((w) => (EM[w] ?? w.length * 0.55) * size)
    const total = widths.reduce((a, w) => a + w, 0) + SPACE * size * (words.length - 1)
    let x = cx - total / 2
    return widths.map((w) => { const left = x; x += w + SPACE * size; return left })
  }

  // --- kamera: mutlak hedef (px, ölçek); kesmelerde ortaya ve 1 kata döner
  const cam = { x: 960, y: 540, s: 1 }
  const camBlocks: BlockSpec[] = []
  const camTo = (from: number, to: number, target: { x?: number; y?: number; s?: number }, easing: string | Bezier = 'linear') => {
    const dx = (target.x ?? cam.x) - cam.x
    const dy = (target.y ?? cam.y) - cam.y
    const zoom = (target.s ?? cam.s) / cam.s
    Object.assign(cam, target)
    const params = { dx: dx * U, dy: -dy * U, zoom }
    camBlocks.push(typeof easing === 'string' ? b('camera-move', s(from), s(to - from), { params, easing }) : b('camera-move', s(from), s(to - from), { params, easing: 'custom', bezier: easing }))
  }
  const reset = (at: number) => camTo(at, at, { x: 960, y: 540, s: 1 })
  /** Büyük yakınlaşmalar: ölçek logaritmik (görünen hız eşit), konum doğrusal ilerler; tek eğri kısa doğrusal parçalara bölünür */
  const camPath = (from: number, to: number, target: { x?: number; y?: number; s?: number }, bezier: Bezier, steps = 24) => {
    const a = { ...cam }
    const z = { x: target.x ?? a.x, y: target.y ?? a.y, s: target.s ?? a.s }
    const ease = preciseCubicBezier(...bezier)
    for (let i = 1; i <= steps; i++) {
      const p = ease(i / steps)
      camTo(from + ((to - from) * (i - 1)) / steps, from + ((to - from) * i) / steps, { x: a.x + (z.x - a.x) * p, y: a.y + (z.y - a.y) * p, s: a.s * (z.s / a.s) ** p })
    }
  }

  const layers: Layer[] = []
  const add = (...ls: Layer[]) => layers.unshift(...ls) // sonra eklenen önde

  // ===== 1) 0–38: renk lekeleri + "Turn your words"
  add(backdrop(`${k('scene')} 1`, '#6A1B3F', 0, 38))
  const blob = (id: string, x: number, y: number, size: number, dx: number, dy: number) =>
    image(`${t('layerNames.glow')} ${id}`, `blob-${id}`, x, y, -0.1, size, [...cut(0, 38), move(0, 38, { dx, dy }, 'linear')])
  add(blob('plum', 700, 600, 2100, 200, -120), blob('ember', 1500, 250, 1900, -220, 90), blob('orange', 1750, 650, 1800, -160, -60), blob('red', 200, 850, 1700, 170, -80), blob('gold', 1150, 1050, 1300, -130, -140))
  const w1 = k('line1').split(' ')
  const S1 = 106
  lineLefts(w1, S1).forEach((x, i) => {
    const d = [2, 3, 5, 6][i] ?? 6
    add(text(`${k('title')} 1.${i + 1}`, w1[i], x, 520 + 60, S1, '#ffffff', [
      ...cut(0, 38), fadeIn(d, 5), move(d, d + 8, { dy: -60, rotX: -55 }, 'ease-out'), move(31, 38, { dy: 137 }, [0.798, 0.156, 0.693, 0.477]),
    ], { rotation: [55, 0, 0], fontWeight: 700 }))
  })
  // kamera baştan 1.33 katta: kelimeler büyük girer, 7–31 arası 1 kata iner (7. karede sıçrama olmasın)
  camTo(0, 0, { s: 1.33 })
  camTo(7, 31, { s: 1 }, [0.085, -0.074, 0, 0.869])
  reset(38)

  // ===== 2) 38–88: parlak turuncu yüzey + "into videos"
  add(image(`${k('scene')} 2`, 'gloss', 960, 540 - 25, -0.1, 2200, [...cut(38, 88), move(38, 88, { dy: 53 }, 'linear')]))
  const w2 = k('line2').split(' ')
  lineLefts(w2, S1).forEach((x, i) => {
    const d = 40 + i * 6
    add(text(`${k('title')} 2.${i + 1}`, w2[i], x, 418 + 50, S1, '#ffffff', [
      ...cut(d, 88), fadeIn(d, 4), move(d, d + 6, { dy: -50 }, 'ease-out'), move(48, 88, { dy: 70 }, [0.053, 0.018, 0, 0.799]), move(81, 88, { dx: -95 }, EASE_IN),
    ], { fontWeight: 700 }))
  })

  // ===== 3) 88–143: beyazda degrade "with intelligence", soldan belirir; yıldız
  add(backdrop(`${k('scene')} 3`, '#ffffff', 88, 143))
  const ink = INTEL_INK[lang]
  const intelW = 1200 * (1001 / (INTEL_INK.en.x1 - INTEL_INK.en.x0)) // EN mürekkep genişliği referansla aynı (1001 px)
  const f3 = intelW / 1200
  const intelX = 960 - 30
  add(image(k('intel'), `intel-${lang}`, intelX, 495, 0, intelW, [...cut(88, 143), move(96, 143, { dx: -61 }, 'ease-out')]))
  // beyaz silme plakası: sol kenarı yumuşak, sağa kayarak yazıyı açar
  const inkLeft = intelX - intelW / 2 + ink.x0 * f3
  add(image(t('layerNames.eraser'), 'eraser-white', inkLeft + 1000, 495, 0.01, 2000, [...cut(88, 100), move(87, 95, { dx: (ink.x1 - ink.x0) * f3 + 200 }, 'ease-out')]))
  add(image(t('layerNames.spark'), 'spark-grad', intelX - intelW / 2 + ink.x1 * f3 + 36, 495 - 60, 0.02, 70, [...cut(106, 143), b('pop', s(106), s(10)), move(106, 118, { rotate: -90 }, 'ease-out'), move(96, 143, { dx: -61 }, 'ease-out')], { rotation: [0, 0, 90] }))

  // ===== 4–6) 143–251: istem kartı açılır, imleç gelir; kamera yazının başına dalar, istem yakın planda yazılmaya
  // başlar ve kamera geri çekilip kartı gösterir. Referansta 177 ve 206'da sert kesme vardı; burada tek kesintisiz
  // hareket (yakın plan referanstaki gibi 7 kat, yazı aynı katman).
  const CARD = { x: 993, y: 435, w: 1240, h: 500 }
  const cardLeft = CARD.x - CARD.w / 2
  const cardTop = CARD.y - CARD.h / 2
  const lift = () => move(245, 251, { dy: -30 }, EASE_IN)
  add(backdrop(`${k('scene')} 4`, PAGE, 143, 251))
  // kart en arkada, dosya ekle düğmesi önünde (saydam kenarları kartın üstünde karışsın)
  add(image(t('layerNames.card'), 'card', CARD.x, CARD.y + 10, 0, 1360, [...cut(143, 251), b('scale-in', s(143), s(8)), lift()]))
  // Dosya ekle düğmesi (görsel 206×62 css, düğme 8 px içeride → sol kenarı yazıyla hizalı)
  add(image(t('layerNames.chip'), `chip-${lang}`, cardLeft + 108 - 16 + 206, cardTop + 378, 0.01, 412, [...cut(146, 251), fadeIn(146, 6), lift()]))
  add(...genButton(CARD.x, 843, 522, [...cut(143, 251), b('scale-in', s(143), s(10)), lift()]))
  add(text(k('placeholder'), k('placeholder'), cardLeft + 108, cardTop + 114, 52, '#9AA3B2', [...cut(146, 178), fadeIn(146, 6), b('fade-out', s(169), s(8))]))
  // imleç görseli 120 css → 144 px; ucu css (14, 10) → görsel merkezi uçtan (55, 60) px uzakta
  add(image(t('layerNames.cursor'), 'cursor', cardLeft + 60 + 55 - 360, cardTop + 100 + 60 + 60, 0.03, 144, [...cut(149, 172), move(149, 157, { dx: 360, dy: -60 }, 'ease-out'), b('fade-out', s(163), s(7))]))
  const prompt = k('prompt')
  const typeDur = 1.4 * prompt.length
  add(text(k('prompt'), prompt, cardLeft + 108, cardTop + 114, 52, INK, [...cut(177, 251), b('typewriter', s(179), s(typeDur)), lift()]))
  // İmleç: marka turuncusu, düzenlenebilir (katman rengi). Her harf göründüğü an (typewriter: harf c, ilerleme
  // (c − 0.5)/n'de belirir) o harfin genişliği kadar sağa geçer. Genişlikler PROMPT_ADV (Inter 500). Yazı bitince yanıp söner.
  const FS = 52
  const adv = PROMPT_ADV[lang].length === prompt.length + 1 ? PROMPT_ADV[lang] : Array.from({ length: prompt.length + 1 }, (_, c) => c * 0.55)
  const caretSteps = adv.slice(1).map((a, c) => move(179 + (typeDur * (c + 0.5)) / prompt.length, 179 + (typeDur * (c + 0.5)) / prompt.length, { dx: (a - adv[c]) * FS }, 'linear'))
  const typed = 179 + typeDur
  const blink = [typed + 8, typed + 16, typed + 24].filter((f) => f < 245).map((f, i) => move(f, f, { scaleBy: i % 2 === 0 ? 1e-3 : 1e3 }, 'linear'))
  add(layer({ name: t('layerNames.caret'), kind: 'shape', shape: 'rounded', shapeWidth: (34 / 364) * FS * U, shapeHeight: (413 / 364) * FS * U, color: '#D9711C', position: P(cardLeft + 108 + 0.05 * FS + (17 / 364) * FS, cardTop + 114 + 0.3, 0.03), blocks: [...cut(177, 251), ...caretSteps, ...blink, lift()] }))
  // kamera: 0.4 → 1 (referans eğrisi), yazının başına 7 kat dalış (yazı solda ~180 px), sonra geri çekilme
  camTo(143, 143, { x: 993, y: 600, s: 0.398 })
  camTo(143, 165, { s: 1 }, [0.01, 0.002, 0.192, 1.022])
  camPath(165, 181, { x: cardLeft + 108 + 780 / 7, y: cardTop + 114, s: 7 }, [0.55, 0, 0.25, 1])
  camPath(183, 226, { x: 993, y: 560, s: 0.915 }, [0.33, 0, 0.25, 1])
  reset(251)

  // ===== 7) 251–289: Oluştur düğmesine yakın plan, imleç tıklar, yıldız döner
  add(backdrop(`${k('scene')} 7`, PAGE, 251, 289))
  const btnW = 1450
  add(...genButton(959, 557, btnW, [...cut(251, 289), move(249, 264, { dy: -21 }, [0.121, -0.404, 0, 0.962])], [move(281, 289, { rotate: -45, scaleBy: 1.1 }, 'ease-in-out')], 0))
  // imleç 120 css → 400 px; ucu css (14, 10) → merkez uçtan (153, 167) px uzakta. Uç (218, 1150) → (541, 707)
  add(image(t('layerNames.cursor'), 'cursor', 218 + 153, 1150 + 167, 0.03, 400, [
    ...cut(251, 289),
    move(251, 268, { dx: 541 - 218, dy: 707 - 1150 }, [0.146, 0.085, 0.087, 0.909]),
    move(269, 271, { scaleBy: 0.62 }, 'ease-out'),
    move(275, 279, { scaleBy: 1 / 0.62 }, 'ease-out'),
    move(279, 288, { dx: 1480, dy: -60 }, EASE_IN),
  ]))

  // ===== 8) 289–326: "Motion" satırları arasında "Meet Mango Studio"
  add(backdrop(`${k('scene')} 8`, '#EEF2F8', 289, 326))
  const ROW = 150
  const grey = k('word')
  const rowText = Array.from({ length: 7 }, () => grey).join('  ')
  ;[130, 335, 745, 950].forEach((y, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    add(text(`${k('rows')} ${i + 1}`, rowText, -500 - (i % 2) * 330, y, ROW, '#C9CED8', [...cut(289, 326), move(289, 326, { dx: dir * 260 }, 'linear')], { textWidth: 90 }))
  })
  const meetW = 1400 * (ROW / 118)
  const gap = MEET_INK[lang] * (ROW / 118) + 700
  ;[-1, 0, 1].forEach((i) => {
    add(image(`${k('meet')} ${i + 2}`, `meet-${lang}`, 960 + i * gap, 540, 0.01, meetW, [...cut(289, 326), move(297, 326, { dx: -260 }, [0.4, 0, 0.9, 0.6])]))
    add(text(`${k('rows')} ·${i + 2}`, grey, 960 + i * gap + gap / 2 - (grey.length * 0.55 * ROW) / 2, 540, ROW, '#C9CED8', [...cut(289, 326), move(297, 326, { dx: -260 }, [0.4, 0, 0.9, 0.6])]))
  })
  camTo(289, 289, { s: 1.9 })
  camTo(289, 298, { s: 1 }, 'ease-out')
  reset(326)

  // ===== 9) 326–371: projenin JSON'u yukarı akar
  add(backdrop(`${k('scene')} 9`, '#ffffff', 326, 371))
  add(image(t('layerNames.glow'), 'glow-pink', 960, 1080, -0.1, 2400, [...cut(326, 371), fadeIn(326, 8)]))
  add(image(k('code'), 'code', 60 + 1200, 520 + 520, 0, 2400, [...cut(326, 371), fadeIn(326, 4), move(326, 330, { dy: -520 }, 'ease-out'), move(330, 371, { dy: -140 }, 'linear')]))

  // ===== 10) 371–464: kontrol listesi → "Your video is ready!"
  add(backdrop(`${k('scene')} 10`, PAGE, 371, 464))
  const LX = 956 - 410 // kart sol kenarı (kart 820 px)
  const PITCH = 158
  const rowsY = (n: number) => Array.from({ length: n }, (_, i) => 536 - (n * PITCH + 20) / 2 + 10 + PITCH / 2 + i * PITCH)
  // kart görseli: kart üstten 50 px içeride, görselin ortası kartın ortasından 10 px aşağıda
  const listCard = (id: string, from: number, to: number) => image(t('layerNames.card'), `list-${id}`, 956, 536 + 10, 0, 940, [...cut(from, to), fadeIn(from, 3)])
  add(listCard('row1', 371, 375), listCard('row2', 375, 387), listCard('row3', 387, 424))
  const steps = [k('step1'), k('step2'), k('step3')]
  const done = [371, 403, 415]
  steps.forEach((label, i) => {
    const appear = [371, 375, 387][i]
    // satır yeni satır eklendikçe yukarı kayar (kart ortada büyür)
    const shifts = [375, 387].filter((f) => f > appear).map((f) => move(f, f + 4, { dy: -PITCH / 2 }, 'ease-out'))
    const y0 = rowsY(i + 1)[i]
    add(text(`${k('step')} ${i + 1}`, label, LX + 110, y0, 48, INK, [...cut(appear, 424), fadeIn(appear, 4), ...shifts]))
    if (i > 0) add(image(`${k('spinner')} ${i + 1}`, 'spinner', LX + 58, y0, 0.01, 56, [...cut(appear, done[i]), move(appear, done[i], { rotate: -360 * ((done[i] - appear) / 20) }, 'linear'), ...shifts]))
    add(image(`${k('check')} ${i + 1}`, 'check', LX + 58, y0, 0.01, 56, [...cut(done[i], 424), b('pop', s(done[i]), s(8)), ...shifts]))
  })
  const readyLeft = 956 - 500
  add(image(t('layerNames.card'), 'list-ready', 956, 536 + 10, 0, 1120, [...cut(424, 464), b('scale-in', s(423), s(6)), move(427, 447, { scaleBy: 1.02 }, 'ease-out')]))
  add(image(`${k('check')} ·`, 'check', readyLeft + 80, 536, 0.01, 76, [...cut(424, 464), b('pop', s(424), s(8))]))
  add(text(k('ready'), k('ready'), readyLeft + 142, 536, 60, INK, [...cut(425, 464), b('typewriter', s(426), s(14))]))

  // ===== 11) 464–534: şablon kartları silindirde döner (kamera etrafında döner, açı birikir)
  // 8 kart 45° arayla (5 şablon, ilk üçü tekrar), geniş yarıçap: yan kartlar referanstaki gibi az eğik ve aralıklı.
  // Ön kart ~740 px: yarıçap 4.2, kart 2.4 birim. Kamera 6.5 kart (294°) ilerler (hızlı → yavaş → hızlı).
  const R = 4.2
  const cards = ['fintech', 'wallet', 'ai', 'words', 'meadow', 'fintech', 'wallet', 'ai']
  cards.forEach((id, i) => {
    const a = (i * 45 * Math.PI) / 180
    add(layer({ name: `${k('templateCard')} ${i + 1}`, kind: 'image', color: '#ffffff', image: img(`tpl-${id}`), position: [R * Math.sin(a), 0.05, R * Math.cos(a)], rotation: [0, i * 45, 0], scale: 2.4 / 3, blocks: cut(464, 534) }))
  })
  camBlocks.push(b('camera-spin', s(464), s(534 - 464), { params: { angle: 294 }, easing: 'custom', bezier: [0.209, 0.547, 0.827, 0.492] }))
  camBlocks.push(b('camera-spin', s(534), 0, { params: { angle: -294 } }))

  // ===== 12) 534–630: koyu fon, ışık huzmeleri, Mango logosu + mangostudio.design
  // Renkler şablonda düzenlenebilir: fon (şekil rengi), huzmeler / kutu / çerçeve ışıkları beyaz çizildi ve katman
  // rengiyle boyanıyor (`tint`).
  const WARM = '#FFB45A'
  add(backdrop(`${k('scene')} 12`, '#2A140A', 534, 630))
  add(image(t('layerNames.glow'), 'rays', 960, 500, -0.1, 2200, [...cut(534, 630), fadeIn(534, 10), move(534, 630, { dx: 90 }, 'linear')], { tint: true, color: WARM }))
  const PILL = [0.38, 0.378, 0.157, 1.058] as Bezier
  const PILL_PX = 1140 // görsel 1060 css; kutu 1020×160 css → 1097×172 px
  const pw = (1020 / 1060) * PILL_PX
  const grow = (from = 0.12) => move(533, 558, { scaleBy: 1 / from }, PILL)
  add(image(t('layerNames.inputBox'), 'end-pill-fill', 960, 532, 0, PILL_PX, [...cut(534, 630), grow()], { scale: sc(PILL_PX) * 0.12, tint: true, color: '#FFE4C8' }))
  add(image(`${t('layerNames.inputBox')} ·`, 'end-pill-ring', 960, 532, 0.005, PILL_PX, [...cut(534, 630), grow()], { scale: sc(PILL_PX) * 0.12, tint: true, color: '#FFD4A6' }))
  // kutu açılınca çerçeve bir kez parlar; sönerken neon ışıklar çerçevenin kendisinde dolaşmaya başlar
  add(image(`${t('layerNames.inputBox')} ✦`, 'end-pill-ring', 960, 532, 0.006, PILL_PX, [...cut(550, 580), fadeIn(550, 6), b('fade-out', s(562), s(16), { easing: 'ease-in' })], { tint: true, color: '#FFF1DE' }))
  // Neon: çerçeve çizgisi + ışıması; light-sweep yalnızca karşılıklı iki ışığın olduğu yeri gösterir. Referanstan
  // ölçüldü: saat yönünde ~0.18 tur/sn (556–630 arası 0.45 tur), 580'de üstteki ışık sol uçta.
  const NEON_PX = PILL_PX * (1100 / 1060) // görsel 1100×240 css, kutu 40 px içeride
  add(image(`${t('layerNames.glow')} ✦`, 'end-pill-neon', 960, 532, 0.007, NEON_PX, [
    ...cut(550, 630), fadeIn(552, 14),
    b('light-sweep', s(550), s(630 - 550), { easing: 'linear', params: { turns: 0.49, count: 2, width: 0.09, floor: 0, phase: 0.8, radius: 0.5, inset: 40 / 240 } }),
  ], { tint: true, color: '#FFE6C7' }))
  // Logo ve alan adı kutunun sol kenarıyla birlikte açılır (kutu ortadan büyürken sol kenar sola kayar);
  // yazı aynı hızla harf harf gelir. Yazı tipi Inter Medium (referans gibi).
  const BRAND = [{ text: 'mangostudio', color: '#ffffff', em: 6.2358 }, { text: '.design', color: '#D9711C', em: 3.5205 }]
  const BS = 64
  // logo yüksekliği yazının büyük harf + inen payı kadar (~1.2 em): 54 px genişlik → 80 px yükseklik
  const LOGO_W = 54
  const LOGO_GAP = 22
  const contentW = LOGO_W + LOGO_GAP + (BRAND[0].em + BRAND[1].em) * BS
  const cx0 = 960 - contentW / 2
  const ride = move(533, 558, { dx: -(1 - 0.12) * (pw / 2) }, PILL)
  const startX = (1 - 0.12) * (pw / 2)
  const typeEnd = 551
  const split = 537 + ((typeEnd - 537) * BRAND[0].text.length) / (BRAND[0].text.length + BRAND[1].text.length)
  // Mango logosu tek parça (mango-logo-2048.png: logo 660×976, merkezi (1024, 907))
  // logonun mürekkep kutusu (660×976, merkezi görselde 117 px yukarıda) yazının ortasına (532) oturur
  const logoW = LOGO_W * (2048 / 660)
  add(layer({ name: t('layerNames.logo'), kind: 'image', color: '#ffffff', image: `${base}brand/mango-logo-2048.png`, position: P(cx0 + LOGO_W / 2 + startX, 532 + ((1024 - 907) / 2048) * logoW, 0.01), scale: sc(logoW), blocks: [...cut(535, 630), fadeIn(535, 3), ride] }))
  add(text(`${t('layerNames.wordmark')} 1`, BRAND[0].text, cx0 + LOGO_W + LOGO_GAP + startX, 532, BS, BRAND[0].color, [...cut(537, 630), b('typewriter', s(536.5), s(split - 536.5)), ride]))
  add(text(`${t('layerNames.wordmark')} 2`, BRAND[1].text, cx0 + LOGO_W + LOGO_GAP + BRAND[0].em * BS + startX, 532, BS, BRAND[1].color, [...cut(split, 630), b('typewriter', s(split), s(typeEnd - split)), ride]))

  return {
    ...project(k('name'), END, '#F0642A', layers, camera(camBlocks)),
    fps: 60,
    // 11. sahnenin fonu (kamera dönerken sabit kalmalı): proje degradesi
    backgroundStyle: 'linear',
    background2: '#7A1E4F',
    lighting: 'soft',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
