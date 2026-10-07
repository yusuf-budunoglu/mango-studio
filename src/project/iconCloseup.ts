import { DESIGN_DURATION } from '../engine/design'
import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Icon close-up": kare (1080×1080, 60 kare/sn, 8 sn) makro çekim. Yatık duran 3D telefonun dock'u boyunca kayan
// kadraj, alan derinliğiyle ilk ikonda (senin uygulaman) netleşir; ikona dokunulur, bildirim rozeti çıkar, sağ altta
// "Made in Mango Studio" etiketi belirir. Siyahtan açılır, siyaha kapanır (döngü dikişsiz).
// Referansı hareketsiz bir görseldi (başkasının işi; piksel/asset kopyalanmadı): sahne kendi telefon modelimiz,
// kendi ekranımız ve kendi ikonlarımızla kuruldu.
// Kamera sabit: telefon ve üstündeki katmanlar (ikonlar, rozet) aynı `move` bloklarıyla birlikte kayar. Böylece
// netlik düzlemi sahnede sabit kalır (kayarken netlik ikondan ikona geçer) ve etiket kadrajda yerinde durur.
// İkonlar ekran görseline gömülü değil: her biri telefonun ekran düzlemine oturtulmuş ayrı görsel katmanı.
// Aynı sahnenin tek karelik görsel (tasarım) şablonu da burada: `buildIconCloseupImage`.
// Görseller: node scripts/build-icon-closeup-assets.mjs (ölçüler o dosyayla aynı olmalı).

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

const f = (frame: number) => frame / 60
const END = f(480)
const DEG = Math.PI / 180

// Kadraj: kamera z=9, görüş 40°; z=0'da 1080 px = 6.55 birim.
const U = (2 * 9 * Math.tan(20 * DEG)) / 1080
/** Kadrajdaki piksel (1080×1080, sol üstten) → z=0 düzlemindeki sahne konumu. */
const P = (px: number, py: number, z = 0): Vec3 => [(px - 540) * U, (540 - py) * U, z]

// Telefon modelinin (public/models/phone.glb) ekranı, katman biriminde (ölçek 1): merkez, boyut, ön yüzün z'si.
const MODEL = { cx: 0.0026, w: 1.572, h: 3.3793, z: 0.1349 }
// Ekran görselinin CSS ölçüsü ve dock'taki ikonlar (scripts/build-icon-closeup-assets.mjs)
const CSS = { w: 1080, h: 2348 }
const ICON = { size: 176, drawn: 192, canvas: 256, y: 2194, xs: [184.8, 421.6, 658.4, 895.2] }

/** three.js Euler XYZ: önce z, sonra y, sonra x etrafında döner */
function rotateBy(rot: Vec3, [x, y, z]: Vec3): Vec3 {
  const [rx, ry, rz] = rot.map((d) => d * DEG)
  const x1 = x * Math.cos(rz) - y * Math.sin(rz)
  const y1 = x * Math.sin(rz) + y * Math.cos(rz)
  const x2 = x1 * Math.cos(ry) + z * Math.sin(ry)
  const z2 = -x1 * Math.sin(ry) + z * Math.cos(ry)
  return [x2, y1 * Math.cos(rx) - z2 * Math.sin(rx), y1 * Math.sin(rx) + z2 * Math.cos(rx)]
}
/** Ekranın CSS pikseli → telefonun kendi biriminde konum; `lift` ekrandan öne (cam üstü) yükseklik */
const local = (cx: number, cy: number, lift = 0): Vec3 => [MODEL.cx + (cx - CSS.w / 2) * (MODEL.w / CSS.w), (CSS.h / 2 - cy) * (MODEL.h / CSS.h), MODEL.z + lift]

/**
 * Telefonun duruşu ve ekranına oturan katmanların yeri. `rot` telefonun dönüşü, `scale` ölçeği; `hero` dock'taki
 * asıl ikonun sırası (0–3) ve kadrajda duracağı piksel: o ikon netlik düzlemine (z=0) oturur.
 */
function pose(rot: Vec3, scale: number, hero: number, heroPx: [number, number]) {
  const rotate = (v: Vec3) => rotateBy(rot, v)
  const anchor = P(heroPx[0], heroPx[1])
  const h = rotate(local(ICON.xs[hero], ICON.y))
  const phoneAt: Vec3 = [anchor[0] - h[0] * scale, anchor[1] - h[1] * scale, anchor[2] - h[2] * scale]
  /** telefonun ekranındaki nokta → sahne konumu */
  const onScreen = (cx: number, cy: number, lift = 0): Vec3 => {
    const p = rotate(local(cx, cy, lift))
    return [phoneAt[0] + p[0] * scale, phoneAt[1] + p[1] * scale, phoneAt[2] + p[2] * scale]
  }
  /** ekrandaki CSS uzunluğu → sahne birimi */
  const len = (css: number) => (css / CSS.w) * MODEL.w * scale
  return { rot, scale, rotate, phoneAt, onScreen, len }
}

// "Made in Mango Studio" etiketi: beyaz kutu görsel katmanı (katman rengiyle boyanır), logo koyu ikonun içinde
// (logo kuralı), yazı düz metin (Inter 600). Kutu görselindeki saydam pay `margin` (betikle aynı); `edge` kadraj
// kenarına uzaklık.
const FONT = 22
const PILL = { h: 58, pad: 15, mark: 36, gap: 11, tail: 24, margin: 48, edge: 56 }
const TEXT_EM = { en: 10.794, tr: 11.511 }
/**
 * Etiketin üç katmanı; `side` kadrajın hangi alt köşesinde duracağı.
 * Alan derinliği netliği kameraya uzaklıkla ölçer (düzlem değil küre: yarıçapı kamera–hedef mesafesi, 9 birim).
 * Kadrajın köşesinde z=0 kameraya ortadakinden uzak kalır ve etiket bulanıklaşır; bu yüzden etiket bakış ışını
 * üzerinde kameraya `near` oranında yaklaştırılır (tam 9 birim uzağa) ve aynı oranda küçültülür: kadrajdaki yeri
 * ve boyu değişmez, yazı net kalır.
 */
function labelLayers({ layer }: Kit, k: (key: string) => string, img: (name: string) => string, lang: 'en' | 'tr', side: 'left' | 'right', blocks: (near: number) => BlockSpec[]): Layer[] {
  const w = Math.round(PILL.pad + PILL.mark + PILL.gap + TEXT_EM[lang] * FONT + PILL.tail)
  const x = side === 'right' ? 1080 - PILL.edge - w : PILL.edge
  const y = 1080 - PILL.edge - PILL.h / 2
  const [cx, cy] = P(x + w / 2, y)
  const near = 9 / Math.hypot(cx, cy, 9)
  const L = (px: number, py: number, lift = 0): Vec3 => [(px - 540) * U * near, (540 - py) * U * near, 9 - 9 * near + lift]
  return [
    layer({ name: k('layers.label'), kind: 'text', text: k('madeIn'), color: '#131109', fontFamily: 'inter-medium', fontWeight: 700, fontSize: FONT * U * near, textWidth: 12, align: 'left', position: L(x + PILL.pad + PILL.mark + PILL.gap, y + 0.5, 0.02), blocks: blocks(near) }),
    layer({ name: k('layers.labelLogo'), kind: 'image', color: '#ffffff', image: img('icon-mango'), position: L(x + PILL.pad + PILL.mark / 2, y + 1.5, 0.01), scale: (((PILL.mark * ICON.canvas) / ICON.drawn) * U * near) / 3, blocks: blocks(near) }),
    layer({ name: k('layers.labelBox'), kind: 'image', image: img(`label-box-${lang}`), tint: true, color: '#ffffff', position: L(x + w / 2, y), scale: ((w + 2 * PILL.margin) * U * near) / 3, blocks: blocks(near) }),
  ]
}

/** Koyu zemin (ortası hafif aydınlık, kenarlara doğru siyah), stüdyo ışığı: video ve görsel şablonda aynı */
const LOOK = { width: 1080, height: 1080, backgroundStyle: 'radial', background2: '#26262a', lighting: 'studio', accentLight: '#ffb21e' } as const
/** sığ alan derinliği; kromatik sapma kapalı (köşedeki etiketi çiftliyordu) */
const EFFECTS = {
  dof: { enabled: true, bokeh: 10, range: 3 },
  bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
  vignette: { enabled: true, darkness: 0.4 },
}

export function buildIconCloseup(kit: Kit): Project {
  const { t, b, layer, camera, project } = kit
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/icon-closeup/${name}.png`
  const k = (key: string) => t(`templates.icon-closeup.${key}`)
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const move = (start: number, duration: number, params: Record<string, number>, easing: string | Bezier = 'linear') =>
    typeof easing === 'string' ? b('move', start, duration, { params: { dx: 0, ...params }, easing }) : b('move', start, duration, { params: { dx: 0, ...params }, easing: 'custom', bezier: easing })

  // Telefonun sol alt köşesi kameraya dönük, ekran geriye yatık; dock sağ yukarı doğru uzaklaşır. Asıl ikon
  // (dock'un ilki) çekimin sonunda kadrajın (500, 468) noktasında, netlik düzleminde durur.
  const { rot: ROT, scale: SCALE, rotate, phoneAt, onScreen, len } = pose([-50, 25, 38], 6.5, 0, [500, 468])

  // Ortak hareket: dock boyunca iki ikon aralığı kayar (netlik üçüncü ikondan ilkine geçer), uzun bir kuyrukla
  // yavaşlar; altında tüm video boyunca çok yavaş, hiç durmayan bir süzülme (kameraya doğru hafif yaklaşma).
  const along = rotate([1, 0, 0])
  const SLIDE = len(ICON.xs[2] - ICON.xs[0])
  const DRIFT = len(56)
  const SETTLE = f(234)
  const start = (p: Vec3): Vec3 => [p[0] - along[0] * (SLIDE + DRIFT * 0.55), p[1] - along[1] * (SLIDE + DRIFT * 0.55), p[2] - along[2] * (SLIDE + DRIFT * 0.55) - 0.19]
  const rig = (): BlockSpec[] => [
    move(0, SETTLE, { dx: along[0] * SLIDE, dy: along[1] * SLIDE, dz: along[2] * SLIDE }, [0.3, 0.5, 0.3, 1]),
    move(0, END, { dx: along[0] * DRIFT, dy: along[1] * DRIFT, dz: along[2] * DRIFT + 0.34 }),
  ]

  // İkon görseli 256 px tuvalde 192 px çizili (gölge payı); ekranda 176 px görünsün.
  const iconScale = len((ICON.canvas * ICON.size) / ICON.drawn) / 3
  const icon = (n: number, file: string, blocks: BlockSpec[] = []) =>
    layer({ name: `${k('layers.icon')} ${n}`, kind: 'image', color: '#ffffff', image: img(file), position: start(onScreen(ICON.xs[n - 1], ICON.y, 0.004)), rotation: ROT, scale: iconScale, blocks: [...rig(), ...blocks] })

  // Dokunuş: ikon kısa bir an küçülür, yaylanarak geri gelir; ardından rozet çıkar.
  const TAP = f(246)
  const press = [move(TAP, f(7), { scaleBy: 0.9 }, 'ease-out'), move(TAP + f(7), f(30), { scaleBy: 1 / 0.9 }, 'spring-bouncy')]
  const BADGE = f(272)
  const badgeSize = len(64)
  const badgeAt = (lift: number) => start(onScreen(ICON.xs[0] + ICON.size / 2 - 12, ICON.y - ICON.size / 2 + 12, lift))

  // etiket kadrajın sağ altında, rozetten sonra belirir
  const LABEL = f(304)
  const label = (near: number): BlockSpec[] => [b('fade-in', LABEL, 0.5, { easing: 'ease-out' }), b('slide-up', LABEL, 0.7, { params: { distance: 14 * U * near }, easing: 'ease-out-expo' })]

  return {
    ...project(
      k('name'),
      END,
      '#000000',
      [
        // --- etiket (en önde)
        ...labelLayers(kit, k, img, lang, 'right', label),
        // --- bildirim rozeti (ikonun sağ üst köşesinde)
        layer({ name: k('layers.badgeCount'), kind: 'text', text: '1', color: '#ffffff', fontFamily: 'inter-medium', fontWeight: 700, fontSize: 0.6, textWidth: 4, position: badgeAt(0.012), rotation: ROT, scale: badgeSize, blocks: [...rig(), b('pop', BADGE, 0.5)] }),
        layer({ name: k('layers.badge'), kind: 'shape', shape: 'circle', color: '#e2361b', shapeWidth: 1, shapeHeight: 1, position: badgeAt(0.008), rotation: ROT, scale: badgeSize, blocks: [...rig(), b('pop', BADGE, 0.5)] }),
        // --- dock ikonları: ilki asıl ikon (kullanıcının uygulaması)
        icon(1, 'icon-mango', press),
        icon(2, 'icon-play'),
        icon(3, 'icon-spark'),
        icon(4, 'icon-timeline'),
        // --- telefon
        layer({ name: t('layerNames.phone'), kind: 'phone', color: '#FF7A00', image: `${base}templates/icon-closeup/screen.jpg`, deviceFinish: 'space', position: start(phoneAt), rotation: ROT, scale: SCALE, blocks: rig() }),
      ],
      camera([
        // siyahtan açılır (örtünün ikinci yarısı), sonda siyaha kapanır
        b('fade-black', -0.55, 1.1),
        // açılışta her şey bulanık; netlik uzaktan dock'a gelir
        b('focus-pull', 0, 1.5, { params: { from: -7, to: 0, blur: 1 }, easing: 'ease-out' }),
        b('fade-to-black', END - 0.62, 0.58, { easing: 'ease-in-out' }),
      ]),
    ),
    ...LOOK,
    fps: 60,
    effects: { ...EFFECTS, motionBlur: { enabled: true, samples: 8, shutter: 0.5 } },
  }
}

/**
 * "Icon close-up (image)": aynı sahnenin tek karelik tasarım şablonu (PNG/JPG çıktısı), ayna görüntüsü: telefon
 * kadrajın sağında, sağ alt köşesi kameraya dönük, dock sol yukarı doğru uzaklaşır; asıl ikon dock'un SONUNCUSU
 * (Mango), solunda YouTube, Google ve X (gerçek marka ikonları kullanıcı kararı; her biri ayrı katman, değiştirilir).
 * Etiket sol altta. Blok yok: katmanlar son duruşlarında, kamera varsayılan (netlik z=0).
 */
export function buildIconCloseupImage(kit: Kit): Project {
  const { t, layer, camera, project } = kit
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/icon-closeup/${name}.png`
  const k = (key: string) => t(`templates.icon-closeup.${key}`)
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const { rot, scale, phoneAt, onScreen, len } = pose([-50, -25, -38], 5.5, 3, [675, 475])
  const iconScale = len((ICON.canvas * ICON.size) / ICON.drawn) / 3
  const icon = (n: number, name: string, file: string) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: onScreen(ICON.xs[n - 1], ICON.y, 0.004), rotation: rot, scale: iconScale, blocks: [] })
  const badgeSize = len(64)
  const badgeAt = (lift: number) => onScreen(ICON.xs[3] + ICON.size / 2 - 12, ICON.y - ICON.size / 2 + 12, lift)

  return {
    ...project(
      t('templates.icon-closeup-image.name'),
      DESIGN_DURATION,
      '#000000',
      [
        ...labelLayers(kit, k, img, lang, 'left', () => []),
        layer({ name: k('layers.badgeCount'), kind: 'text', text: '1', color: '#ffffff', fontFamily: 'inter-medium', fontWeight: 700, fontSize: 0.6, textWidth: 4, position: badgeAt(0.012), rotation: rot, scale: badgeSize, blocks: [] }),
        layer({ name: k('layers.badge'), kind: 'shape', shape: 'circle', color: '#e2361b', shapeWidth: 1, shapeHeight: 1, position: badgeAt(0.008), rotation: rot, scale: badgeSize, blocks: [] }),
        // --- dock ikonları: sonuncusu asıl ikon (netlikte), diğerleri uzaklaştıkça bulanıklaşır
        icon(4, 'Mango Studio', 'icon-mango'),
        icon(3, 'YouTube', 'icon-youtube'),
        icon(2, 'Google', 'icon-google'),
        icon(1, 'X', 'icon-x'),
        layer({ name: t('layerNames.phone'), kind: 'phone', color: '#FF7A00', image: `${base}templates/icon-closeup/screen.jpg`, deviceFinish: 'space', position: phoneAt, rotation: rot, scale, blocks: [] }),
      ],
      camera([]),
    ),
    ...LOOK,
    mode: 'design',
    // komşu ikonlar tanınır kalsın diye bulanıklık videodakinden az
    effects: { ...EFFECTS, dof: { enabled: true, bokeh: 5, range: 4 } },
  }
}
