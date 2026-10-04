import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Crystal": dikey (1080×1920, 60 kare/sn, 1659 kare) karanlık, sinematik uygulama tanıtımı. 60 kare/sn'lik bir
// referans videodan kare kare ölçüldü (kare numaraları referansın 1'den başlayan kareleri, ölçüler 1080×1920 pikseli).
// Akış: 4 yakın çekim (kesmeler 216, 412, 626; her biri ölçülen sabit hızlı kayma + dönme) → 841'de karanlık,
// telefon uzaktan yan dönmüş halde yükselip öne döner, duvarda spot ışığı ve gölge (872–1062) → 1066–1108 ışık söner →
// "Crystal" bulanıktan netleşir (1124–1166), harf harf nane ışık dalgası (1172–1220) → sola kayarken "See the future."
// açılır (kayma 1222–1308, açılma 1245–1290), ikinci ışık dalgası (1266–1312) → 1420'de "Made in Mango Studio", 1598–1659 söner.
// Yakın çekimlerin hareketi ORB öznitelik takibiyle ölçüldü (ölçek, dönme, kadraj merkezinin kayması); telefon eğik
// durduğu için hedefler bizim render'ımız aynı yöntemle ölçülüp referansla oranlanarak düzeltildi.
// Görseller: python scripts/build-crystal-assets.py, node scripts/build-crystal-screens.mjs (hepsi kodla çizildi).

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

/** Referansın n. karesi (1'den başlar) → saniye; mikro saniyeye yuvarlanır (fitClip kesmeleri kaydırmasın). */
const F = (n: number) => Math.round(((n - 1) / 60) * 1e6) / 1e6
const END = F(1660)
// Kamera z=9, dikey görüş 40°: z derinliğinde 1 piksel kaç birim
const CAM_Z = 9
const unit = (z: number) => (2 * (CAM_Z - z) * Math.tan((20 * Math.PI) / 180)) / 1920
const U = unit(0)
/** Kadrajdaki piksel (1080×1920, sol üstten) → z derinliğindeki sahne konumu. */
const at = (px: number, py: number, z = 0): Vec3 => [(px - 540) * unit(z), (960 - py) * unit(z), z]
/** Görsel katmanı 3 birim genişliğinde çizilir: kadrajda kaplayacağı genişlik (px) → ölçek. */
const widthPx = (px: number, z: number) => (px * unit(z)) / 3
/** Telefon 1.7 birim genişliğinde: kadrajdaki gövde genişliği (px) → ölçek. */
const phoneScale = (px: number) => (px * U) / 1.7

// Kapanış yazısı: Inter 600 (`inter-medium` kalın), boyu referansın mürekkep genişliğinden (77.5 px).
const SIZE = 77.5
// Inter 600 ilerleme genişlikleri (em, fontTools ile ölçüldü); yeni metin eklenirse tabloya ekle
const EM: Record<string, number> = {
  Crystal: 3.4604,
  Kristal: 3.1001,
  '.': 0.3188,
  ' See the future.': 7.4189,
  ' Geleceği gör.': 6.7085,
}
const TEXT_Y = 962 // satır kutusunun ortası (referansta büyük harfler 929–985)
const GREY = '#919193' // ilk "Crystal" (referansla aynı ölçüyle: yazının en parlak %5'i)
const LIGHT = '#b8b8ba' // tam satır ve imza (1350'de referans 186)
const DOT = '#6b6b6e'
const MINT = '#56eeba' // parlama halesi (1196'da yazının içi 86,238,186)
const GLOW_HUE = 160 // MINT'in tonu (glow-sweep)

export function buildCrystal({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/crystal/${name}`
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const screen = img(`screen-${lang}.jpg`)
  const k = (key: string) => t(`templates.crystal.${key}`)

  const move = (from: number, to: number, params: Record<string, number>, easing: string | Bezier = 'linear') =>
    typeof easing === 'string'
      ? b('move', F(from), F(to) - F(from), { params: { dx: 0, ...params }, easing })
      : b('move', F(from), F(to) - F(from), { params: { dx: 0, ...params }, easing: 'custom', bezier: easing })
  const cut = (from: number, to: number) => [b('fade-in', F(from), 0), b('fade-out', F(to), 0)]
  const fadeIn = (from: number, to: number, easing = 'ease-in-out') => b('fade-in', F(from), F(to) - F(from), { easing })
  const fadeOut = (from: number, to: number, easing = 'ease-in-out') => b('fade-out', F(from), F(to) - F(from), { easing })
  const focus = (n: number, z: number, blur = 1) => b('focus-pull', F(n), 0, { params: { from: z, to: z, blur } })

  /**
   * Yakın çekim hareketi: referansta kadraj merkezi (540, 960) çekim boyunca `to` noktasına gider, görüntü `rot`
   * derece (ekranda saat yönü +) döner ve `s` kat büyür. Telefon kendi merkezi `c` (px) etrafında döndüğü için
   * kayma bu dönüşün götürdüğü yere göre düzeltilir.
   */
  const shotMove = (from: number, to: number, c: [number, number], end: [number, number], rot: number, s: number, easing: string | Bezier = 'linear') => {
    const a = (rot * Math.PI) / 180
    const vx = 540 - c[0]
    const vy = 960 - c[1]
    const rx = c[0] + s * (vx * Math.cos(a) - vy * Math.sin(a))
    const ry = c[1] + s * (vx * Math.sin(a) + vy * Math.cos(a))
    return move(from, to, { dx: (end[0] - rx) * U, dy: -(end[1] - ry) * U, rotate: -rot, scaleBy: s }, easing)
  }
  const phone = (n: number, c: [number, number], widthPx: number, rotation: Vec3, blocks: BlockSpec[]) =>
    layer({ name: `${t('layerNames.phone')} ${n}`, kind: 'phone', color: MINT, image: screen, deviceFinish: 'space', position: at(c[0], c[1]), rotation, scale: phoneScale(widthPx), blocks })
  const glow = (name: string, color: string, px: number, py: number, z: number, w: number, opacity: number, blocks: BlockSpec[], file = 'glow.png') =>
    layer({ name, kind: 'image', color, tint: true, image: img(file), position: at(px, py, z), scale: widthPx(w, z), opacity, blocks })
  const text = (name: string, value: string, x: number, color: string, z: number, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'text', text: value, fontFamily: 'inter-medium', fontWeight: 700, fontSize: SIZE * U, textWidth: 20, align: 'left', color, position: at(x, TEXT_Y, z), blocks, ...extra })

  // --- kapanış yazısı yerleşimi: önce kelime tek başına ortada, sonra tam satır ortada
  const word = k('word')
  const rest = k('rest')
  const wordW = (EM[word] ?? 3.4) * SIZE
  const dotW = EM['.'] * SIZE
  const restW = (EM[rest] ?? 7.4) * SIZE
  const aloneLeft = 540 - wordW / 2
  const finalLeft = 535 - (wordW + dotW + restW) / 2
  // 1222–1308: satır sola kayar; yavaş başlar, en hızlı ~1261 (23 px/kare), uzun yavaşlamayla oturur
  // (eğri referansın her 2 karedeki sol kenarına uyduruldu)
  const slide = move(1222, 1308, { dx: (finalLeft - aloneLeft) * U }, [0.8, 0.05, 0.1, 1])
  /** harf harf ilerleyen ışık dalgası (referans: ön kenar ~17 karede kelimeyi geçer) */
  const sweep = (from: number, to: number, glowWidth: number, halo = 1.2) =>
    b('glow-sweep', F(from), F(to) - F(from), { easing: 'linear', params: { glowHue: GLOW_HUE, glowWidth, softness: 0.3, halo } })
  const lineCut = (from: number) => [...cut(from, 1420), slide]

  return {
    ...project(
      k('name'),
      END,
      '#000000',
      [
        // ---------------------------------------------------------------- 1420–1659: imza
        layer({
          name: t('layerNames.tagline'),
          kind: 'text',
          text: k('madeIn'),
          fontFamily: 'inter-medium',
          fontWeight: 700,
          fontSize: SIZE * U,
          textWidth: 20,
          color: LIGHT,
          position: at(542, TEXT_Y, 0.03),
          blocks: [...cut(1420, 1660), fadeOut(1598, 1660, 'ease-in')],
        }),
        // ---------------------------------------------------------------- 1124–1420: "Crystal. See the future."
        // Işık dalgası (glow-sweep): harf harf soldan sağa; önde beyaza yakın kenar, ardından nane harfler ve
        // harflerin etrafında ışıma, dalga geçince harfler yumuşakça griye döner. Rengi bloğun "Işıma tonu" ayarı.
        // " See the future.": 1246–1302 açılır (eğri referansın görünür kenarına uyduruldu: hızlı başlar, uzun yavaşlar); dalga 1268–1306 (ön ve arka kenar referanstaki gibi ~21 karede metni geçer)
        text(`${t('layerNames.title')} 3`, rest, aloneLeft + wordW + dotW, LIGHT, 0.05, [
          ...lineCut(1244),
          b('soft-reveal', F(1246), F(1302) - F(1246), { easing: 'custom', bezier: [0.34, 1, 0.8, 0.7], params: { softness: 0.35 } }),
          sweep(1268, 1306, 0.7),
        ]),
        // nokta "See" ile birlikte parlar
        text(`${t('layerNames.title')} .`, '.', aloneLeft + wordW, DOT, 0.05, [...lineCut(1244), fadeIn(1244, 1248), sweep(1262, 1298, 1.6, 0.5)]),
        // "Crystal": gri taban (bulanıktan netleşir, dalga 1168–1218), üstte beyaz (netleşirken) ve açık gri (satır) kopyaları
        text(`${t('layerNames.title')} 2`, word, aloneLeft, LIGHT, 0.06, [...lineCut(1222), fadeIn(1222, 1246)]),
        text(`${t('layerNames.title')} 0`, word, aloneLeft, '#ffffff', 0.04, [...cut(1124, 1170), fadeIn(1120, 1146, 'ease-in'), fadeOut(1148, 1162)]),
        text(t('layerNames.title'), word, aloneLeft, GREY, 0.03, [...lineCut(1140), fadeIn(1140, 1150), move(1124, 1226, { scaleBy: 1 / 1.08 }, 'ease-out'), sweep(1168, 1218, 2.1)], { scale: 1.08 }),
        // parlama haleleri (nane, düzenlenebilir renk)
        glow(`${t('layerNames.glow')} 2`, MINT, 450, 962, -0.5, 1500, 0.2, [...cut(1270, 1310), fadeIn(1270, 1286), fadeOut(1290, 1310), move(1270, 1310, { dx: 380 * unit(-0.5) })], 'glow-wide.png'),
        glow(`${t('layerNames.glow')} 1`, MINT, 540, 962, -0.5, 1500, 0.22, [...cut(1176, 1218), fadeIn(1176, 1192), fadeOut(1196, 1216)], 'glow-wide.png'),
        // kapanış fonu: ortası çok hafif açık, kenarları siyah dikey oval
        glow(t('layerNames.background'), '#0b0a0e', 540, 960, -2, 2780, 1, cut(1108, 1660), 'glow-oval.png'),

        // ---------------------------------------------------------------- 841–1108: telefon karanlıktan yükselir
        // uzaktan, yan dönmüş halde (gövdesi görünür) yükselir; yaklaşırken öne döner; 1062'de oturur
        layer({
          name: `${t('layerNames.phone')} 5`,
          kind: 'phone',
          color: MINT,
          image: screen,
          deviceFinish: 'space',
          position: [0, 0.1 - 5, -16],
          rotation: [-4, 85, 0],
          scale: phoneScale(653),
          blocks: [
            ...cut(872, 1108),
            // referanstan: görünen boy 903'te %49, 927'de %76, 951'de %92 (uzaklık); dönüş 919'da ~45°, 931'de ~27°, 943'te ~10°
            move(872, 975, { dz: 16 }, [0.4, 0.2, 0.2, 1]),
            move(886, 966, { rotY: -85 }, [0.3, 0, 0.4, 1]),
            // yükselme uzun kuyruklu: kalan yol 903'te %61, 931'de %25, 1000'de %4
            move(872, 1062, { dy: 5 }, [0.2, 0.6, 0.2, 1]),
            fadeOut(1066, 1106, 'ease-in-out'),
            // sönerken hafifçe geri çekilip alçalır (referansta üst kenar 1063→1095'te 60 px iner)
            move(1066, 1106, { dy: -0.15, dz: -1.2 }, 'ease-in'),
          ],
        }),
        // telefonun arkasındaki nane ışığı (ekranın duvara vurduğu ışık)
        glow(`${t('layerNames.glow')} 3`, MINT, 540, 960, -1.5, 1700, 0.1, [...cut(900, 1108), fadeIn(900, 990), fadeOut(1066, 1104)]),
        // duvar: üstte spot ışığı ve telefonun solundaki gölge
        glow(`${t('layerNames.shadow')}`, '#000000', 300, 820, -3, 720, 0.9, [...cut(890, 1108), move(890, 1062, { dy: 1.2 }, [0.2, 0.6, 0.2, 1]), fadeIn(890, 940)], 'shadow.png'),
        glow(`${t('layerNames.light')}`, '#3a3a3a', 680, 250, -3, 2400, 1, [...cut(845, 1108), fadeIn(845, 960, 'ease-in'), fadeOut(1066, 1106)]),
        glow(`${t('layerNames.light')} 2`, '#1e1e1e', 540, 700, -3.2, 4200, 1, [...cut(845, 1108), fadeIn(845, 960, 'ease-in'), fadeOut(1066, 1106)]),

        // ---------------------------------------------------------------- 1–840: yakın çekimler
        // 4) 626–840: kristale yakın plan; kamera itilir (1.26 kat, yavaşlayarak) ve yukarı kayar
        phone(4, [815, 1845], 1500, [-28, 12, 32], [...cut(626, 841), shotMove(626, 841, [815, 1845], [320, 347], 2.8, 1.46, [0.2, 0.25, 0.55, 1])]),
        // 3) 412–625: kart ve sekme çubuğu, telefonun sol alt köşesi; sola kayar
        phone(3, [940, 500], 1450, [-35, 15, 4], [...cut(412, 626), shotMove(412, 626, [940, 500], [322, 994], 4.2, 1.005)]),
        // 2) 216–411: skor ve halkalar, çok sığ alan derinliği; sağa kayar, hafifçe uzaklaşır
        phone(2, [400, 674], 1750, [-18, -10, -6], [...cut(216, 412), shotMove(216, 412, [400, 674], [724, 910], 8.7, 0.96)]),
        // 1) 1–215: üst sol köşe, yan düğmeler görünür; ışık yavaşça açılır
        phone(1, [900, 1780], 1550, [-8, 30, -3], [...cut(1, 216), shotMove(1, 216, [900, 1780], [281, 1104], -14.6, 0.985)]),
        // stüdyo fonu (yakın çekimler): sol üstten gelen yumuşak gri ışık
        glow(`${t('layerNames.light')} 0`, '#5a5a5a', 150, 500, -6, 3600, 1, cut(1, 841)),
      ],
      camera([
        // 1–200: ışık yavaşça açılır (geçiş örtüsünün ikinci yarısı: %60 karanlıktan aydınlığa)
        b('fade-black', -F(200) * (0.7 / 0.3), F(200) / 0.3, { easing: 'linear' }),
        focus(1, 0.2, 0.9),
        focus(216, 0.4, 1.4),
        focus(412, 0.8, 0.6),
        focus(626, 0.6, 1.2),
        focus(841, 0, 0.5),
        // yazı bulanıktan netleşir: netlik düzlemi uzaktan yazıya gelir
        b('focus-pull', F(1110), F(1150) - F(1110), { params: { from: -20, to: 0, blur: 3 }, easing: 'custom', bezier: [0.6, 0, 0.4, 1] }),
        // netleşince bulanıklık kapanır (açık kalırsa harf kenarlarında bokeh lekesi kalıyordu)
        focus(1152, 0, 0),
      ]),
    ),
    width: 1080,
    height: 1920,
    fps: 60,
    lighting: 'studio',
    accentLight: '#7fbfa8',
    effects: {
      dof: { enabled: true, bokeh: 6, range: 1.4 },
      // ekran ışıması görsele işlendi; parlama (bloom) kapanış yazılarına hale yapıyordu
      bloom: { enabled: false, intensity: 0.4, threshold: 0.75 },
      vignette: { enabled: true, darkness: 0.45 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
