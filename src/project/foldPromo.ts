import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Fold promo": yatay (1920×1080, 60 kare/sn, 20 sn) katlanır telefon tanıtımı; Mango Studio'nun kendi reklamı.
// 60 kare/sn'lik bir oyun tanıtımından (2880×2160, 4:3, 1200 kare) kare kare incelendi: beş çekim, her biri 240 kare
// (kesmeler 241, 481, 721; 961'de kesme yok, telefon bir tur döner). Kare numaraları referansın, ölçüler referansın
// 1440×1080'e indirilmiş pikseli; yatay yerleşim 16:9'a uyarlandı (yazı sütunu ve telefon aynı yükseklikte, daha aralıklı).
// Birebir kopya değil: metinler Mango Studio'ya göre yazıldı, referanstaki kare desenli ve ızgaralı fon yerine koyu,
// sıcak tonlarda düz fon + yumuşak ışık var, telefon ekranlarında bizim editör ve ana sayfa videoları oynuyor.
// Referansta telefon 2. çekimde dikeye, 4. çekimde yataya çeyrek tur döner; bizde ekrandaki editör yan yatmasın diye
// 2. çekimde tam tur atar, 4. çekim yatay başlar
// (node scripts/build-fold-promo-screens.mjs).
// Akış: kapalı telefon dönerek gelir, "FOLDED." (1–120) → açılır, "UN / FOLDED." (131–200) │ açık telefon yatay,
// kelimeler tek tek + eğik etiket (241–360) → kendi düzleminde bir tur döner, "TURN IT." (361–412) │ koyu fon, kapalı telefon düşer,
// kelimeler + etiket, telefon takla atar (481–624) │ açık telefon eğik gelip düzelir, katlanır (721–838), bir tur
// döner, "KEEP / CREATING." (846–960) │ bir tur daha, marka adı ve alan adı (964–1200).

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

/** kamera z=9, fov 40 iken z=0 düzleminde 1 piksel (1080 yükseklikte) */
const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / 1080
const P = (x: number, y: number, z = 0): Vec3 => [(x - 960) * U, (540 - y) * U, z]
/** kare → saniye (mikro saniyeye yuvarlı: `fitClip` kesme anlarını kaçırmasın) */
const f = (frame: number) => Math.round((frame / 60) * 1e6) / 1e6

// Renkler (hepsi ayrı katman ya da katman rengi: editörden değişir)
// Koyu ve sıcak tonlar (kullanıcı kararı: düz turuncu/sarı fonlar fazla açık ve sertti). Marka turuncusunun koyu
// akrabaları: espresso fon + konyak ışık, fildişi yazı, kehribar vurgu; açık çekimde fildişi fon + grafit yazı.
const ESPRESSO = '#1b0e06'
const COGNAC = '#b05a1e'
const OBSIDIAN = '#09090a'
const IVORY = '#f3efe8'
const GRAPHITE = '#1d1d1f'
const AMBER = '#f0a25a'
const CHAMPAGNE = '#c9b596'

// Katlanır telefon: açıkken 4.9 × 3.5 birim; kapalıyken (menteşe etrafında katlanınca) 2.45 genişliğinde ve gövdenin
// ortası menteşeden 1.22 birim yanda. Kapalıyken kapak ekranı kameraya baksın diye katman y'de ~90° döner.
const HALF = 1.22
/** kapalı telefonun görünen ortası `cx` pikselinde olsun diye menteşenin (katman konumunun) pikseli */
const closedHinge = (cx: number, scale: number) => cx - (HALF * scale) / U
const SOFT: Bezier = [0.16, 1, 0.3, 1]
const SWING: Bezier = [0.65, 0, 0.35, 1]
/** büyük harfli Inter 700 başlığın yaklaşık genişliği (em); etiket kutuları buna göre boyanır */
const CAPS_EM = 0.69

export function buildFoldPromo({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const k = (key: string) => t(`templates.fold-promo.${key}`)
  const cut = (from: number, to: number) => [b('fade-in', f(from), 0), b('fade-out', f(to), 0)]
  type Move = { dx?: number; dy?: number; rotate?: number; rotX?: number; rotY?: number; scaleBy?: number }
  /** `from`–`to` kareleri arasında hareket (piksel); süre 0 ise o karede anında */
  const move = (from: number, to: number, p: Move, easing: string | Bezier = SWING): BlockSpec => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, rotY: p.rotY ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', f(from), f(to - from), { params, easing }) : b('move', f(from), f(to - from), { params, easing: 'custom', bezier: easing })
  }
  /** çekimin başındaki poz farkı ve oradan asıl poza giriş */
  const enter = (from: number, to: number, p: Move): BlockSpec[] => [
    move(from, from, p, 'linear'),
    move(from, to, { dx: -(p.dx ?? 0), dy: -(p.dy ?? 0), rotate: -(p.rotate ?? 0), rotX: -(p.rotX ?? 0), rotY: -(p.rotY ?? 0), scaleBy: 1 / (p.scaleBy ?? 1) }, SOFT),
  ]
  const fold = (from: number, to: number, angle: number) => b('fold', f(from), f(to - from), { params: { angle }, easing: 'custom', bezier: SWING })

  const phone = (name: string, shot: [number, number], hingeX: number, scale: number, rotation: Vec3, foldAngle: number, blocks: BlockSpec[]) =>
    layer({
      name,
      kind: 'foldable',
      deviceFinish: 'titanium',
      color: GRAPHITE,
      // ekran videoları 20 sn'lik tek kayıt: her çekim kendi anından devam eder
      media: `${base}templates/fold-promo/inner.mp4`,
      coverMedia: `${base}templates/fold-promo/cover.mp4`,
      mediaOffset: f(shot[0]),
      foldAngle,
      position: P(hingeX, 540, 0),
      rotation,
      scale,
      blocks: [...cut(shot[0], shot[1]), ...blocks],
    })

  type TextOptions = { size: number; color?: string; weight?: 400 | 700; font?: string; spacing?: number; align?: 'left' | 'center'; rotate?: number; z?: number }
  const text = (name: string, value: string, x: number, y: number, o: TextOptions, blocks: BlockSpec[]) =>
    layer({
      name,
      kind: 'text',
      text: value,
      fontFamily: o.font ?? 'inter',
      fontWeight: o.weight ?? 700,
      fontSize: o.size * U,
      letterSpacing: o.spacing ?? -0.03,
      textWidth: 20,
      align: o.align ?? 'left',
      color: o.color ?? IVORY,
      position: P(x, y, o.z ?? 0.3),
      rotation: [0, 0, o.rotate ?? 0],
      blocks,
    })
  /** küçük başlık satırı: nokta + aralıklı büyük harf */
  const eyebrow = (value: string, x: number, y: number, color: string, shot: [number, number], at: number) =>
    text(k('layers.eyebrow'), `●  ${value}`, x, y, { size: 28, spacing: 0.2, color }, [...cut(shot[0], shot[1]), b('fade-in', f(at), f(10))])
  /** başlık kelimesi: `at` karesinde zıplayarak gelir, `until` karesinden önce söner */
  const word = (value: string, x: number, y: number, size: number, color: string, at: number, until: number, fadeOut = true) =>
    text(value, value, x, y, { size, color }, [...cut(at, until), b('pop', f(at), f(22)), ...(fadeOut ? [b('fade-out', f(until - 8), f(8))] : [])])
  /** eğik etiket: yuvarlak köşeli kutu + içinde yazı (ikisi birlikte zıplar; kutunun ve yazının rengi ayrı düzenlenir) */
  const pill = (value: string, x: number, y: number, size: number, box: string, ink: string, at: number, until: number, fadeOut = true): Layer[] => {
    const width = value.length * CAPS_EM * size + size * 0.9
    const height = size * 1.5
    const blocks = [...cut(at, until), b('pop', f(at), f(24)), ...(fadeOut ? [b('fade-out', f(until - 8), f(8))] : [])]
    return [
      text(value, value, x + width / 2, y, { size, color: ink, align: 'center', rotate: -3.5, z: 0.32 }, blocks),
      layer({ name: `${value} ${k('layers.label')}`, kind: 'shape', shape: 'rounded', shapeWidth: width * U, shapeHeight: height * U, color: box, position: P(x + width / 2, y, 0.3), rotation: [0, 0, -3.5], blocks }),
    ]
  }
  /** çekimin fonu: düz renk + telefonun arkasında yumuşak ışık (ikisinin rengi de düzenlenir) */
  const backdrop = (name: string, color: string, glow: string, glowX: number, glowOpacity: number, shot: [number, number]): Layer[] => [
    layer({ name: `${name} ${k('layers.glow')}`, kind: 'image', image: `${base}templates/fold-promo/glow.png`, tint: true, color: glow, position: P(glowX, 540, -1.5), scale: 3.4, opacity: glowOpacity, blocks: cut(shot[0], shot[1]) }),
    layer({ name, kind: 'shape', shape: 'rect', shapeWidth: 19, shapeHeight: 11, color, position: [0, 0, -2], blocks: cut(shot[0], shot[1]) }),
  ]

  // Çekimler (kare aralıkları) ve yerleşim (piksel): yazı sütunu solda, telefon sağda; 2. çekimde tersi.
  const A: [number, number] = [0, 240]
  const B: [number, number] = [240, 480]
  const C: [number, number] = [480, 720]
  const D: [number, number] = [720, 1200]
  const LEFT = 150
  const RIGHT = 1150
  const PHONE = 1340

  const layers: Layer[] = [
    // --- 1. çekim: kapalı → açık ---
    eyebrow(k('brand'), LEFT, 236, CHAMPAGNE, A, 6),
    word(k('folded'), LEFT, 500, 156, IVORY, 8, 120),
    text(k('layers.subline'), k('foldedSub'), LEFT + 4, 660, { size: 42, weight: 400, font: 'inter-medium', spacing: -0.01, color: CHAMPAGNE }, [...cut(10, 120), b('typewriter', f(10), f(32)), b('fade-out', f(112), f(8))]),
    word(k('un'), LEFT, 444, 144, IVORY, 126, 240, false),
    word(k('unfolded'), LEFT, 584, 114, IVORY, 158, 240, false),
    phone(k('layers.phone'), A, closedHinge(PHONE, 1.4), 1.4, [0, 80, 0], 0, [
      // küçükten büyüyerek, y ekseninde bir tur dönerek gelir (1–30)
      ...enter(0, 30, { rotY: -360, scaleBy: 0.3 }),
      move(30, 132, { rotY: 8 }, 'linear'),
      // açılır: yarılar ayrılırken telefon kameraya döner ve küçülür (136–200)
      fold(138, 196, 180),
      move(134, 200, { rotY: -94, rotX: 4, scaleBy: 0.908 / 1.4, dx: 1300 - closedHinge(PHONE, 1.4) }),
      move(200, 240, { rotY: 3 }, 'linear'),
    ]),
    ...backdrop(k('layers.background'), ESPRESSO, COGNAC, PHONE, 0.7, A),

    // --- 2. çekim: açık telefon solda, kelimeler sağda; sonra 90° döner ---
    eyebrow(k('brand'), RIGHT, 205, GRAPHITE, B, 248),
    word(k('wide1'), RIGHT, 335, 102, GRAPHITE, 250, 360),
    word(k('wide2'), RIGHT, 466, 102, GRAPHITE, 280, 360),
    word(k('wide3'), RIGHT, 597, 102, GRAPHITE, 310, 360),
    ...pill(k('wide4'), RIGHT, 748, 84, GRAPHITE, IVORY, 340, 360),
    word(k('turn'), RIGHT, 453, 144, GRAPHITE, 368, 480, false),
    word(k('turnIt'), RIGHT, 627, 144, GRAPHITE, 398, 480, false),
    phone(k('layers.phone'), B, 590, 0.846, [3, 8, -2], 180, [
      ...enter(240, 268, { rotY: -200, scaleBy: 0.55 }),
      move(268, 360, { rotY: -5, rotate: 2 }, 'linear'),
      // kendi düzleminde saat yönünün tersine bir tur (361–412); ekrandaki editör yan yatmasın diye çeyrek tur değil
      move(361, 412, { rotate: 360, scaleBy: 0.94 / 0.846 }),
      move(412, 480, { rotY: 4 }, 'linear'),
    ]),
    ...backdrop(k('layers.background'), '#e9e3d9', '#ffffff', 590, 0.9, B),

    // --- 3. çekim: koyu fon, kapalı telefon ---
    eyebrow(k('export'), LEFT, 236, AMBER, C, 488),
    word(k('tweak1'), LEFT, 344, 114, IVORY, 488, 720, false),
    word(k('tweak2'), LEFT, 479, 114, IVORY, 518, 720, false),
    word(k('tweak3'), LEFT, 614, 114, IVORY, 548, 720, false),
    ...pill(k('tweak4'), LEFT, 762, 72, AMBER, GRAPHITE, 608, 720, false),
    phone(k('layers.phone'), C, closedHinge(PHONE, 1.34), 1.34, [0, 82, 0], 0, [
      // yatık halde yukarıdan düşer (481–506)
      ...enter(480, 506, { rotX: -88, scaleBy: 0.45, dy: -200 }),
      move(506, 604, { rotY: 6 }, 'linear'),
      // etiket gelirken bir takla (604–626)
      move(604, 626, { rotX: 360 }),
      move(626, 720, { rotY: -5 }, 'linear'),
    ]),
    ...backdrop(k('layers.background'), OBSIDIAN, COGNAC, PHONE, 0.38, C),

    // --- 4. ve 5. çekim: dikey açık → yatay → katlanır → döner; kapanış ---
    eyebrow(k('brand'), LEFT, 236, CHAMPAGNE, [720, 960], 728),
    word(k('foldIt'), LEFT, 466, 114, IVORY, 730, 842),
    ...pill(k('midEdit'), LEFT, 622, 84, IVORY, GRAPHITE, 756, 842),
    word(k('keep'), LEFT, 453, 144, IVORY, 848, 960),
    word(k('creating'), LEFT, 614, 120, IVORY, 876, 960),
    text(k('layers.wordmark'), k('brand'), LEFT, 487, { size: 86, spacing: 0.08 }, [...cut(968, 1200), b('fade-in', f(968), f(14)), b('slide-up', f(968), f(26), { params: { distance: 0.25 } })]),
    text(k('layers.subline'), k('tagline'), LEFT + 4, 606, { size: 44, weight: 400, font: 'inter-medium', spacing: -0.01, color: CHAMPAGNE }, [...cut(994, 1200), b('fade-in', f(994), f(14))]),
    text(k('layers.domain'), 'mangostudio.design', LEFT + 4, 672, { size: 44, weight: 700, font: 'inter-medium', spacing: -0.01, color: AMBER }, [...cut(1004, 1200), b('fade-in', f(1004), f(14))]),
    phone(k('layers.phone'), D, 1300, 0.91, [0, -6, 0], 180, [
      // eğik ve küçük gelip düzelir (720–762)
      ...enter(720, 762, { rotate: 26, scaleBy: 0.86 }),
      // katlanır: yarılar kapanırken kapak ekranı kameraya döner ve büyür (776–838)
      fold(780, 834, 0),
      move(776, 838, { rotY: 88, scaleBy: 1.38 / 0.91, dx: closedHinge(PHONE, 1.38) - 1300 }),
      move(846, 872, { rotY: 360 }),
      move(872, 964, { rotY: -6 }, 'linear'),
      move(964, 990, { rotY: 360 }),
      move(990, 1200, { rotY: 8 }, 'linear'),
    ]),
    ...backdrop(k('layers.background'), ESPRESSO, COGNAC, PHONE, 0.7, D),
  ]

  return {
    ...project(t('templates.fold-promo.name'), 20, '#000000', layers, camera([])),
    fps: 60,
    lighting: 'studio',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      // referansta hızlı dönüşlerde hareket bulanıklığı var
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
