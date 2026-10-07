import { DESIGN_DURATION } from '../engine/design'
import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "Fold rock": dikey (1080×1620, 2:3) tek karelik görsel şablon (PNG/JPG çıktısı). Koyu bir stüdyoda, kaya sırtının
// arkasında duran yarı açık katlanır telefon; ekranında Netflix yazı logosu. Telefon yarı açık olduğu için ekranın
// sol yarısı (dış ekranın arkasındaki yarı) hâlâ bulanık ve koyu: bu, cihazın menteşe açısına bağlı kendi geçişi
// (`DeviceLayer` `addFoldTransition`), görsele gömülü değil. Açıklık değişince bulanıklık da değişir.
// Referansı hareketsiz bir görseldi (başkasının işi; piksel/asset kopyalanmadı): kaya kodla üretildi, telefon kendi
// modelimiz. Netflix logosu gerçek marka logosu (kullanıcı kararı); telefonun ekran görseli olduğu için panelden
// değiştirilir. Blok yok: katmanlar son duruşlarında, kamera varsayılan.
// Görseller: node scripts/build-fold-rock-assets.mjs

type BlockSpec = Omit<Block, 'id'>
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
const H = 1620
/** kamera z=9, görüş 40° iken z=0 düzleminde 1 kadraj pikseli */
const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / H
/** `z` derinliğindeki düzlemde bir kadraj pikselinin sahnedeki boyu (kameraya yaklaştıkça küçülür) */
const px = (z = 0) => (U * (9 - z)) / 9
/** Kadrajdaki piksel (sol üstten) → `z` derinliğinde aynı piksele düşen sahne konumu. */
const at = (x: number, y: number, z = 0): Vec3 => [(x - W / 2) * px(z), (H / 2 - y) * px(z), z]

// Telefon: menteşesi (katmanın konumu) kadrajın ortasının biraz üstünde. Açıklık 125°: sol yarı kenara doğru tamamen
// bulanık ve koyu, menteşeye doğru netleşir. Y dönüşüyle sağ (net) yarı kameraya döner, sol yarı öne doğru açılır;
// X dönüşü üstü geriye yatırır (alttan bakış).
const PHONE = { x: 508, y: 772, scale: 0.76, rotation: [-9, 15, 0] as Vec3, fold: 125 }

// Kaya (rock.webp, 2048×1080; sırtın tepesi görselin %37'sinde, üstten %27 aşağıda): telefonun önünde, kadrajdan
// taşacak kadar geniş; tepesi telefonun alt kenarını örter. Telefonun öne açılan yarısından da önde durmalı.
const ROCK = { z: 2.3, width: 1470, left: -74, top: 818, aspect: 2048 / 1080 }

// Etiket (sağ altta): beyaz kutu + koyu karede logo + yazı. Kayanın önünde (kaya saydam pikselleriyle de arkasını keser).
const LABEL = { z: 2.7, h: 58, pad: 15, mark: 36, gap: 11, tail: 24, edge: 46, font: 22 }
/** etiket yazısının genişliği (em, Inter Medium 700; diğer görsel şablondaki ölçümle aynı yazılar) */
const TEXT_EM = { en: 10.794, tr: 11.511 }

export function buildFoldRock({ t, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/fold-rock/${name}`
  const k = (key: string) => t(`templates.fold-rock.${key}`)
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'

  const labelW = Math.round(LABEL.pad + LABEL.mark + LABEL.gap + TEXT_EM[lang] * LABEL.font + LABEL.tail)
  const labelX = W - LABEL.edge - labelW
  const labelY = H - LABEL.edge - LABEL.h / 2
  const lp = px(LABEL.z)
  const rockW = ROCK.width * px(ROCK.z)

  return {
    ...project(
      k('name'),
      DESIGN_DURATION,
      '#040507',
      [
        // --- etiket (en önde)
        layer({ name: k('layers.label'), kind: 'text', text: k('madeIn'), color: '#131109', fontFamily: 'inter-medium', fontWeight: 700, fontSize: LABEL.font * lp, textWidth: 12, align: 'left', position: at(labelX + LABEL.pad + LABEL.mark + LABEL.gap, labelY + 0.5, LABEL.z + 0.02), blocks: [] }),
        layer({ name: k('layers.labelLogo'), kind: 'image', color: '#ffffff', image: img('label-logo.png'), position: at(labelX + LABEL.pad + LABEL.mark / 2, labelY, LABEL.z + 0.01), scale: (LABEL.mark * lp) / 3, blocks: [] }),
        layer({ name: k('layers.labelBox'), kind: 'shape', shape: 'rounded', color: '#ffffff', shapeWidth: labelW * lp, shapeHeight: LABEL.h * lp, position: at(labelX + labelW / 2, labelY, LABEL.z), blocks: [] }),
        // --- kaya: telefonun önünde
        layer({ name: k('layers.rock'), kind: 'image', color: '#ffffff', image: img('rock.webp'), position: at(ROCK.left + ROCK.width / 2, ROCK.top + ROCK.width / ROCK.aspect / 2, ROCK.z), scale: rockW / 3, blocks: [] }),
        // --- katlanır telefon, yarı açık
        layer({ name: k('layers.phone'), kind: 'foldable', color: '#000000', image: img('screen.jpg'), deviceFinish: 'titanium', foldAngle: PHONE.fold, position: at(PHONE.x, PHONE.y), rotation: PHONE.rotation, scale: PHONE.scale, blocks: [] }),
        // --- telefonun arkasında soğuk, yumuşak ışık (rengi düzenlenir)
        layer({ name: k('layers.backGlow'), kind: 'image', image: img('glow.png'), tint: true, color: '#2f3442', position: at(610, 700, -1.6), scale: 3.3, opacity: 0.5, blocks: [] }),
      ],
      camera([]),
    ),
    width: W,
    height: H,
    mode: 'design',
    backgroundStyle: 'radial',
    background2: '#171a21',
    lighting: 'studio',
    accentLight: '#9db2ff',
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: true, darkness: 0.5 },
    },
  }
}
