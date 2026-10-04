import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Words to motion": yatay (1920×1080, 60 kare/sn) marka tanıtımı. 60 kare/sn'lik bir referans videodan kare kare
// ölçüldü (kare numaraları referansın kareleri, ölçüler 1920×1080 pikseli; kamera z=9, fov 40 iken 1 birim = 164.87 px).
// Akış: "Create anything" düşer (0–11), harfleri imlece sıkışır (33–40) → kamera yazı kutusuna 9.4 kattan 3.04 kata
// uzaklaşır (40–56), harfler griden beyaza yazılır → kutu gerçek boyutuna iner (90–100) → kutu soldan silinir, yazı
// ortalanır (150–172) → yazının üstünden parlaklık dalgası geçer (160–223) → Mango logosu TEK PARÇA dönerek büyür
// (228–276) → "Made in Mango Studio" (340) → mangostudio.design harf harf yazılır (512–574).
// Görseller: node scripts/build-words-motion-assets.mjs; logo public/brand/mango-logo-2048.png.

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
// troika metni satır kutusunun ortasına hizalar; referanstaki yazılar bu kadar aşağıda (ölçüldü)
const TEXT_Y = 553
/** görselin kadrajdaki genişliği (px) → katman ölçeği (görsel 3 birim genişliğinde çizilir) */
const sc = (widthPx: number) => (widthPx * U) / 3
const f = (frame: number) => frame / 60

const SIZE = 86.4 // yazı boyu (px): Inter 700, referansın mürekkep genişliğiyle ölçüldü
// Inter 700 / Space Grotesk 700 ilerleme genişlikleri (em, fontTools ile ölçüldü); yeni metin eklenirse tabloya ekle
const EM: Record<string, number> = {
  'Create anything': 7.8413,
  'Her şeyi yarat': 6.7891,
  'From words to motion.': 11.0039,
  'Kelimelerden harekete.': 11.4023,
}
const BRAND = [
  { text: 'mangostudio', color: '#ffffff', em: 6.41 },
  { text: '.design', color: '#D9711C', em: 3.557 },
]
// Mango logosu (mango-logo-2048.png pikselleri): gövde + yaprak birlikte
const LOGO = { h: 976, cy: 907 }
const LOGO_PX = 190 // kadrajdaki logo yüksekliği (referanstaki logo 188 px)

export function buildWordsMotion({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/words-motion/${name}.png`
  const k = (key: string) => t(`templates.words-motion.${key}`)

  const move = (from: number, to: number, p: { dx?: number; dy?: number; rotate?: number; scaleBy?: number }, easing: string | Bezier = 'linear') => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, rotate: p.rotate ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', f(from), f(to - from), { params, easing }) : b('move', f(from), f(to - from), { params, easing: 'custom', bezier: easing })
  }
  const ZOOM_OUT: Bezier = [1, -0.118, 0.136, 1.149]
  const cut = (from: number, to: number) => [b('fade-in', f(from), 0), b('fade-out', f(to), 0)]
  const reveal = (from: number, to: number, softness: number) => b('soft-reveal', f(from), f(to - from), { easing: 'linear', params: { softness } })
  const text = (name: string, value: string, x: number, y: number, z: number, color: string, blocks: BlockSpec[], extra: Partial<LayerSpec> = {}) =>
    layer({ name, kind: 'text', text: value, fontFamily: 'inter', fontWeight: 700, fontSize: SIZE * U, textWidth: 20, align: 'left', color, position: P(x, y, z), blocks, ...extra })
  const image = (name: string, file: string, x: number, y: number, z: number, widthPx: number, blocks: BlockSpec[]) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: P(x, y, z), scale: sc(widthPx), blocks })

  // --- kamera: kadraj ortası (960, 540) ve ölçek; `camTo` mutlak hedef verir
  const cam = { x: 960, y: 540, s: 1 }
  const camBlocks: BlockSpec[] = []
  const camTo = (from: number, to: number, target: { x?: number; s?: number }, easing: string | Bezier = 'linear') => {
    const dx = (target.x ?? cam.x) - cam.x
    const zoom = (target.s ?? cam.s) / cam.s
    Object.assign(cam, target)
    const params = { dx: dx * U, dy: 0, zoom }
    camBlocks.push(typeof easing === 'string' ? b('camera-move', f(from), f(to - from), { params, easing }) : b('camera-move', f(from), f(to - from), { params, easing: 'custom', bezier: easing }))
  }
  // Kamera yazıya göre ölçüldü: yakın planda yazı 2.5 kat, kamera x=713.6'ya bakar.
  // 40: kesmeyle 7.74 kat yakın (imleç ekranda x≈584); üstel yavaşlamayla 2.5 kata uzaklaşır
  camTo(40, 40, { x: 598.4, s: 7.74 })
  camTo(40, 56, { s: 2.5 }, [0.064, 1.095, 0.483, 0.984])
  camTo(40, 56, { x: 713.6 }, [0.502, 1.07, 0.318, 1.006])
  // 88–100: gerçek boyuta çok hızlı iner (ortası neredeyse tek karede)
  camTo(88, 100, { s: 1 }, ZOOM_OUT)
  // yatay kayma ölçekten geç ve daha sert: 94'te kamera hâlâ x=713'te, 96'da ortada
  camTo(93.5, 96.5, { x: 960 }, [0.5, 0, 0.3, 1])

  // --- metinler
  const create = k('create')
  const prompt = k('prompt')
  const promptW = (EM[prompt] ?? 11) * SIZE
  const promptLeft = 542 // kutuda: artı ikonundan sonra
  const centeredLeft = 970 - promptW / 2
  const shift = move(150, 172, { dx: centeredLeft - promptLeft }, [0.427, 0.561, 0.223, 0.995])
  const GREY = '#d2d2d2'
  // parlaklık dalgası: önce hafif kararma, beyaz, arkasından kararma ve yeniden gri (soldan sağa)
  // zamanlamalar ve yumuşaklıklar referanstaki kelime parlaklıklarına (her 4 karede) uyduruldu
  const shimmer = (name: string, color: string, from: number, to: number, softness: number, z: number) =>
    text(name, prompt, promptLeft, TEXT_Y, z, color, [...cut(157, 228), shift, reveal(from, to, softness)])

  const brandLeft = 960 - (BRAND[0].em + BRAND[1].em) * SIZE / 2
  const logoScale = (LOGO_PX / LOGO.h) * 2048 * U / 3
  const logoOffset = ((1024 - LOGO.cy) / 2048) * 2048 * (LOGO_PX / LOGO.h) // görsel merkezinin logonun üstüne kayması (px)

  return {
    ...project(
      k('name'),
      f(676),
      '#0a0a0a',
      [
        // 512–574: alan adı harf harf (her ~3.3 karede bir harf), sonra videonun sonuna kadar kalır
        text(`${t('layerNames.wordmark')} 1`, BRAND[0].text, brandLeft, TEXT_Y, 0.03, BRAND[0].color, [b('fade-in', f(515), 0), b('typewriter', f(513), f(551 - 513))], { fontFamily: 'space-grotesk' }),
        text(`${t('layerNames.wordmark')} 2`, BRAND[1].text, brandLeft + BRAND[0].em * SIZE, TEXT_Y, 0.03, BRAND[1].color, [b('fade-in', f(551), 0), b('typewriter', f(551), f(574 - 551))], { fontFamily: 'space-grotesk' }),
        // 340–514: imza
        layer({ name: t('layerNames.tagline'), kind: 'text', text: k('madeIn'), fontFamily: 'space-grotesk', fontWeight: 400, fontSize: SIZE * U, textWidth: 20, color: '#ffffff', position: P(960, TEXT_Y, 0.03), blocks: cut(340, 515) }),
        // 228–340: Mango logosu tek parça: küçük ve eğik gelir, dönerek büyür (referansın parça birleşme eğrisi)
        layer({
          name: t('layerNames.logo'),
          kind: 'image',
          color: '#ffffff',
          image: `${base}brand/mango-logo-2048.png`,
          position: P(960, 540 + logoOffset, 0.02),
          rotation: [0, 0, 35],
          scale: logoScale * 0.6,
          // referansta logo 8. karede boyunun %92'sine ulaşır, parçaların dönüşü daha uzun sürer
          blocks: [...cut(228, 340), b('fade-in', f(227), f(4), { easing: 'ease-out' }), move(228, 276, { scaleBy: 1 / 0.6 }, [0.179, 0.899, 0.069, 0.989]), move(228, 276, { rotate: -35 }, [0, 0.006, 0.269, 1.023])],
        }),
        // 160–228: parlaklık dalgası (öndeki sonra gelir)
        shimmer(`${t('layerNames.title')} 5`, GREY, 197.85, 217.78, 0.17, 0.08),
        shimmer(`${t('layerNames.title')} 4`, '#a2a2a2', 186.03, 210.37, 0.11, 0.07),
        shimmer(`${t('layerNames.title')} 3`, '#ffffff', 167.75, 194.16, 0.08, 0.06),
        shimmer(`${t('layerNames.title')} 2`, '#a6a6a6', 160.32, 179.02, 0.02, 0.05),
        // 96–228: kutudaki gri yazı; kutu silinirken ortaya kayar
        text(`${t('layerNames.title')} 1`, prompt, promptLeft, TEXT_Y, 0.04, GREY, [...cut(96, 228), shift]),
        // 40–96: yakın planda beyaz yazı: harfler imlecin arkasından griden beyaza belirir
        text(t('layerNames.prompt'), prompt, promptLeft, TEXT_Y, 0.04, '#ffffff', [...cut(40, 96), reveal(52.8, 95.4, 0.49)]),
        // imleç (yakın plan): kesmede kısa, kamera uzaklaşırken uzar (27 → 185 px); yavaşça, sonra 26.6 px/kare sağa kayar
        layer({
          name: t('layerNames.caret'),
          kind: 'shape',
          shape: 'rounded',
          shapeWidth: 8.8 * U,
          shapeHeight: 185 * U,
          color: '#ffffff',
          position: P(549.5, 540, 0.05),
          scale: 27 / 185,
          blocks: [...cut(40, 72), move(40, 56, { scaleBy: 185 / 27 }, [0.2, 0.9, 0.4, 1]), move(44, 50, { dx: 45 }, 'ease-in'), move(50, 72, { dx: 26.6 * 22 })],
        }),
        // imleç (açılış): "Create anything" sıkışırken solunda belirip uzar
        layer({
          name: `${t('layerNames.caret')} 0`,
          kind: 'shape',
          shape: 'rounded',
          shapeWidth: 8.8 * U,
          shapeHeight: 185 * U,
          color: '#ffffff',
          position: P(588, 540, 0.05),
          scale: 0.3,
          blocks: [...cut(36, 40), move(36, 40, { scaleBy: 1.25 / 0.3 }, 'ease-out')],
        }),
        // 0–40: açılış yazısı: yukarıdan düşer, sonra harfleri sola sıkışıp imlece dönüşür
        text(t('layerNames.title'), create, 960 - (EM[create] ?? 7.8) * SIZE / 2, TEXT_Y - 186, 0.03, '#ffffff', [
          ...cut(0, 40),
          move(0, 11, { dy: 186 }, [0.169, 1.024, 0.414, 0.975]),
          b('tracking-out', f(33), f(10), { easing: 'custom', bezier: [0.233, 0.454, 0.242, 0.486], params: { amount: -669 / 14 / SIZE } }),
        ]),
        // yazı kutusu, artı ve kutuyu soldan silen zemin plakası. Yakın planda kutu yazıya göre 1.216 kat büyük ve
        // artı daha sağda/küçük; uzaklaşırken son hallerine dönüşür.
        image(`${t('layerNames.plus')}`, 'plus', 482.8, 540, 0.02, 56.4, [
          ...cut(40, 160),
          b('fade-in', f(44), f(10)),
          move(88, 100, { dx: 444.5 - 482.8, scaleBy: 65 / 56.4 }, ZOOM_OUT),
          b('fade-out', f(152), f(7)),
        ]),
        image(t('layerNames.eraser'), 'eraser', 330 - 900 + 60, 540, 0.01, 1800, [...cut(150, 176), move(156, 170, { dx: 1700 - 330 })]),
        image(t('layerNames.inputBox'), 'pill', 960, 539.5, 0, 1240, cut(100, 171)),
        image(`${t('layerNames.inputBox')} 0`, 'pill-tall', 387.6 + 754, 540, 0, 1508, [...cut(40, 100), move(88, 100, { dx: 960 - 1141.6, scaleBy: 1240 / 1508 }, ZOOM_OUT)]),
        // açılışta kadraj kutunun içi (kutu dolgusu #101010)
        layer({ name: t('layerNames.inputBox'), kind: 'shape', shape: 'rect', shapeWidth: 30, shapeHeight: 20, color: '#101010', position: [0, 0, -0.05], blocks: cut(0, 40) }),
      ],
      camera(camBlocks),
    ),
    fps: 60,
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      // referansta hızlı yakınlaşmalarda hareket bulanıklığı var
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
