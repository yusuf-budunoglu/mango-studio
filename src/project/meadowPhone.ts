import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Meadow phone": dikey (1080×1920, 60 kare/sn) uygulama tanıtımı. Güneşli bir çayırın ortasında 3D telefon;
// gökyüzü (proje degradesi), bulutlar, uzak çayır, çimen öbekleri ve çiçekler ayrı katmanlar: hepsi
// taşınabilir, bulutlar `move` ile süzülür, çiçekler ve çimenler `sway` ile rüzgârda sallanır.
// Hareketler 8 sn'de dikişsiz döner (salınımlar tam tur). Telefon ekranı Mango Studio karşılama ekranı.
// Görseller: python scripts/build-meadow-assets.py, node scripts/build-meadow-screens.mjs (hepsi kodla çizildi).

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
// Kamera z=9, dikey görüş 40°: d uzaklıkta kadraj yüksekliği 2·d·tan20°, genişliği bunun 9/16'sı.
const CAM_Z = 9
const frameH = (z: number) => 2 * (CAM_Z - z) * Math.tan((20 * Math.PI) / 180)
const frameW = (z: number) => (frameH(z) * 1080) / 1920
/** Kadrajdaki piksel (1080×1920, sol üstten) → z derinliğindeki sahne konumu. */
const at = (px: number, py: number, z: number): Vec3 => [(px / 1080 - 0.5) * frameW(z), (0.5 - py / 1920) * frameH(z), z]
/** Görselin kadrajda kaplayacağı genişlik (px) → katman ölçeği (görsel katmanı 3 birim genişliğinde çizilir). */
const widthPx = (px: number, z: number) => ((px / 1080) * frameW(z)) / 3

export function buildMeadowPhone({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/meadow/${name}.png`
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const move = (start: number, duration: number, params: Record<string, number>, easing: string | Bezier = 'linear') =>
    typeof easing === 'string' ? b('move', start, duration, { params: { dx: 0, ...params }, easing }) : b('move', start, duration, { params: { dx: 0, ...params }, easing: 'custom', bezier: easing })
  /** tüm video boyunca rüzgârda salınım (tam tur: döngü dikişsiz) */
  const sway = (angle: number, cycles: number, phase: number) => b('sway', 0, END, { params: { angle, cycles, phase } })

  /** Sapın dibi (px, kadrajda) görselin ortasında; genişlik px olarak. */
  const plant = (name: string, file: string, px: number, py: number, z: number, w: number, blocks: BlockSpec[]) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), position: at(px, py, z), scale: widthPx(w, z), blocks })
  const flowerName = (n: number) => `${t('layerNames.flower')} ${n}`
  const grassName = (n: number) => `${t('layerNames.grass')} ${n}`
  const cloudName = (n: number) => `${t('layerNames.cloud')} ${n}`

  // Bulutlar uzakta (z=-8): yavaşça sağa süzülür; öndekiler biraz daha hızlı (paralaks).
  const cloud = (n: number, px: number, py: number, w: number, drift: number) =>
    layer({ name: cloudName(n), kind: 'image', color: '#ffffff', image: img(`cloud-${n}`), position: at(px, py, -8), scale: widthPx(w, -8), blocks: [move(0, END, { dx: drift })] })

  // Uzak çayır: ufuk çizgisi görselin üstünden 60/1500 aşağıda; kadrajda 860. piksele oturur.
  const farZ = -5
  const farW = 9.3
  const farH = (farW * 1500) / 2400
  const horizonY = at(0, 860, farZ)[1]

  return {
    ...project(
      t('templates.meadow-phone.name'),
      END,
      '#1b6fd6',
      [
        // --- en önde: bulanık, kadrajın köşesinden taşan yakın çiçekler
        plant(flowerName(1), 'daisy-near', 60, 2500, 3, 700, [sway(3, 2, 0.1)]),
        plant(flowerName(2), 'dandelion-near', 1060, 2480, 3, 600, [sway(3.5, 2, 0.6)]),
        // --- ön çimen tabanı (telefonun altını örter)
        layer({ name: grassName(1), kind: 'image', color: '#ffffff', image: img('grass-band'), position: [0, -2.62 + (3.4 * 900) / 2600 / 2 - 0.35, 2], scale: 3.4 / 3, blocks: [] }),
        // --- ön çiçekler (telefonun önünde)
        plant(flowerName(3), 'daisy', 130, 1880, 1.6, 300, [sway(5, 3, 0.25)]),
        plant(flowerName(4), 'dandelion', 880, 1900, 1.5, 250, [sway(4, 2, 0.8)]),
        plant(flowerName(5), 'daisy-2', 1000, 1800, 1.4, 280, [sway(5, 3, 0.45)]),
        plant(flowerName(6), 'pink', 700, 1950, 1.5, 200, [sway(6, 3, 0.05)]),
        plant(flowerName(7), 'daisy', 380, 1990, 1.5, 260, [sway(4, 2, 0.7)]),
        plant(flowerName(8), 'daisy-2', 570, 2010, 1.6, 220, [sway(5, 2, 0.3)]),
        plant(flowerName(9), 'dandelion', 250, 1960, 1.3, 220, [sway(4, 3, 0.95)]),
        // --- ön çimen öbekleri
        plant(grassName(2), 'grass-front-1', 560, 2010, 1.25, 900, [sway(1.5, 2, 0.4)]),
        plant(grassName(3), 'grass-front-1', 200, 1960, 1.2, 1100, [sway(1.8, 2, 0.15)]),
        plant(grassName(4), 'grass-front-2', 900, 1980, 1.1, 1000, [sway(2, 2, 0.55)]),
        // --- telefon: çimenlerin arasından yükselir, oturur, hafifçe süzülür
        layer({
          name: t('layerNames.phone'),
          kind: 'phone',
          color: '#D9711C',
          image: img(`screen-${lang}`),
          deviceFinish: 'space',
          position: [0, -0.2 - 6, 0],
          rotation: [-6, 22, -4],
          scale: 1.46,
          blocks: [
            move(0, 1.6, { dy: 6, rotY: -22, rotate: 4 }, [0.16, 1, 0.3, 1]),
            // hafif geriye yaslanma: alt kenar biraz öne gelir, ekran gökyüzüne bakar
            move(0.4, END - 0.4, { rotX: -4 }, 'ease-in-out'),
            b('float', f(96), END - f(96), { params: { amount: 0.04, cycles: 2 } }),
          ],
        }),
        // --- telefonun arkasındaki çiçekler ve çimenler
        plant(flowerName(10), 'daisy-2', 95, 1200, -1, 220, [sway(4, 2, 0.35)]),
        plant(flowerName(11), 'dandelion', 1000, 1190, -1, 210, [sway(5, 3, 0.9)]),
        plant(flowerName(12), 'pink', 200, 1260, -1.2, 170, [sway(6, 2, 0.5)]),
        plant(grassName(5), 'grass-back', 90, 1300, -1.5, 620, [sway(1.5, 2, 0.3)]),
        plant(grassName(6), 'grass-back', 1000, 1280, -1.5, 600, [sway(1.5, 2, 0.75)]),
        // --- uzak çayır ve bulutlar
        layer({ name: t('layerNames.meadow'), kind: 'image', color: '#ffffff', image: img('meadow-far'), position: [0, horizonY + (60 / 1500) * farH - farH / 2, farZ], scale: farW / 3, blocks: [] }),
        cloud(1, 250, 300, 760, 0.9),
        cloud(2, 930, 610, 560, 0.7),
        cloud(3, 820, 150, 900, 1.1),
        cloud(4, 60, 700, 520, 0.6),
      ],
      // yavaş itme: katmanlar arası derinlik (paralaks) hissedilsin
      camera([b('camera-push', 0, END, { params: { distance: 0.9 }, easing: 'ease-in-out' })]),
    ),
    width: 1080,
    height: 1920,
    fps: 60,
    // gökyüzü: üstte koyu mavi, ufka doğru açılır
    backgroundStyle: 'linear',
    background2: '#bfe2f7',
    lighting: 'studio',
    accentLight: '#fff2d6',
    effects: {
      // alan derinliği görsellere işlendi (saydam düzlemler derinliğe yazdığı için sahnede kapalı)
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: true, darkness: 0.25 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
