import { evaluateLayer } from '../engine/evaluate'
import { newId } from '../engine/ids'
import { PRESETS } from '../engine/presets'
import i18n, { currentNumberLocale } from '../i18n'
import { PROJECT_VERSION, type Block, type CameraTrack, type Layer, type Project } from '../engine/types'

// Tüm şablonlar sıfırdan, sadece metin/şekil/telefon katmanlarıyla yapıldı; dış asset yok.
// Metinler ve katman adları, proje oluşturulduğu andaki arayüz dilinde üretilir.

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options)

type BlockSpec = Omit<Block, 'id'>
type LayerSpec = Omit<Layer, 'id' | 'blocks' | 'rotation' | 'scale' | 'opacity' | 'start' | 'duration'> &
  Partial<Pick<Layer, 'rotation' | 'scale' | 'opacity'>> & { blocks: BlockSpec[] }

const b = (preset: string, start: number, duration: number, extra: Partial<BlockSpec> = {}): BlockSpec => ({
  preset,
  start,
  duration,
  ...extra,
})

function layer(spec: LayerSpec): Layer {
  return {
    rotation: [0, 0, 0],
    scale: 1,
    opacity: 1,
    start: 0,
    duration: 0,
    ...spec,
    id: newId('l'),
    blocks: spec.blocks.map((block) => ({ ...block, id: newId('b') })),
  }
}

function camera(blocks: BlockSpec[], position: CameraTrack['position'] = [0, 0, 9]): CameraTrack {
  return { id: 'camera', name: t('layer.defaults.camera'), position, fov: 40, blocks: blocks.map((block) => ({ ...block, id: newId('b') })) }
}

// Testler şablonu klibe oturtulmadan önceki haliyle (tüm videoya yayılmış) karşılaştırabilsin diye.
let fitClips = true

function project(name: string, duration: number, background: string, layers: Layer[], cam: CameraTrack): Project {
  const fitted = fitClips ? layers.map((l) => fitClip(l, duration)) : layers.map((l) => ({ ...l, start: 0, duration }))
  return { version: PROJECT_VERSION, id: newId('p'), name, duration, fps: 30, width: 1920, height: 1080, background, numberLocale: currentNumberLocale(), layers: fitted, camera: cam }
}

/** Şablonun klibe oturtulmamış hali: her katman tüm video boyunca, bloklar videoya göre (test için). */
export function buildUnfitted(template: Template): Project {
  fitClips = false
  try {
    return template.build()
  } finally {
    fitClips = true
  }
}

/**
 * Şablon katmanları bloklarıyla (videoya göre) yazılır; klip, katmanın gerçekten göründüğü aralığa
 * oturtulur ve bloklar klibe göre kaydırılır. Görünmeye başlatan bir giriş bloğu varsa klip onun
 * başından başlar (giriş animasyonu klibin içinde kalsın).
 */
export function fitClip(layer: Layer, total: number): Layer {
  const step = 1 / 60
  const full = { ...layer, start: 0, duration: total }
  let first = -1
  let last = -1
  // Tam sayı adımlarla örnekle: art arda toplamak kayan nokta hatası biriktirip kesme anını kaçırıyordu.
  for (let i = 0; i < Math.round(total / step); i++) {
    const t = i * step
    if (evaluateLayer(full, t).opacity > 0.001) {
      if (first < 0) first = t
      last = t
    }
  }
  if (first < 0) return full
  const opening = layer.blocks.filter((b) => b.start <= first + 1e-6 && first - b.start < 1.5).map((b) => b.start)
  // Klip kenarları mikro saniyeye yuvarlanır: 0.01'e yuvarlamak kare hassasiyetindeki kesmeleri (181/60 sn)
  // bir kare kaydırıyordu.
  const start = first <= step ? 0 : Math.round((opening.length ? Math.max(...opening) : first) * 1e6) / 1e6
  // Son: katmanı kaybettiren çıkış bloğunun bittiği an (klip sonu hariç tutulur); yoksa görünür
  // son örnekten sonraki ilk an.
  const closing = layer.blocks.map((b) => b.start + b.duration).filter((e) => e >= last - 1e-9 && e <= last + 2 * step)
  const end = last >= total - step - 1e-9 ? total : Math.min(total, Math.round((closing.length ? Math.min(...closing) : last + step) * 1e6) / 1e6)
  const duration = Math.round((end - start) * 1e6) / 1e6
  const blocks = layer.blocks
    // kare hassasiyetindeki (1/60 sn) başlangıçlar bozulmasın diye mikro saniyeye yuvarlanır
    .map((b) => ({ ...b, start: Math.round((b.start - start) * 1e6) / 1e6 }))
    // Klibin kenarındaki anlık (0 sn) belirme/kaybolma blokları sert kesme içindi; artık klip yapıyor.
    .filter((b) => {
      if (b.duration > 0.001) return true
      const category = PRESETS[b.preset]?.category
      return !((category === 'in' && b.start <= 0.001) || (category === 'out' && b.start >= duration - 0.02))
    })
  return { ...layer, start, duration, blocks }
}

export interface Template {
  id: string
  /** kütüphane kartında gösterilecek renk */
  accent: string
  build: () => Project
}

export const TEMPLATES: Template[] = [
  {
    id: 'app-launch',
    accent: '#6c5ce7',
    build: () =>
      project(
        t('templates.app-launch.name'),
        8,
        '#0d1117',
        [
          layer({ name: t('layerNames.logo'), kind: 'text', text: '◆ acme', color: '#8be9fd', fontSize: 0.35, position: [0, 1.9, 0], blocks: [b('fade-in', 0, 0.8), b('fade-out', 7.2, 0.6)] }),
          layer({ name: t('layerNames.title'), kind: 'text', align: 'left', text: t('templates.app-launch.title'), color: '#ffffff', fontSize: 0.42, position: [-4.6, 0.5, 0], blocks: [b('slide-up', 0.5, 1.1), b('typewriter', 0.5, 1.4)] }),
          layer({ name: t('layerNames.counter'), kind: 'text', align: 'left', text: '0', color: '#ffb86c', fontSize: 0.6, position: [-4.6, -0.9, 0], blocks: [b('fade-in', 2.2, 0.4), b('count-up', 2.2, 1.8, { params: { from: 0, to: 10000 } })] }),
          layer({ name: t('layerNames.phone'), kind: 'phone', color: '#6c5ce7', position: [2.8, -0.2, 0], rotation: [0, -18, 0], blocks: [b('rotate-in', 1.2, 1.4), b('float', 2.6, 5, { params: { amount: 0.1, cycles: 2 } })] }),
        ],
        camera([b('camera-push', 0, 8, { params: { distance: 2 } })]),
      ),
  },
  {
    id: 'feature-tour',
    accent: '#00b894',
    build: () =>
      project(
        t('templates.feature-tour.name'),
        9,
        '#0b1512',
        [
          layer({ name: t('layerNames.phone'), kind: 'phone', color: '#00b894', position: [2.2, 0, 0], rotation: [0, -12, 0], blocks: [b('scale-in', 0, 1), b('float', 1, 8, { params: { amount: 0.08, cycles: 3 } })] }),
          layer({ name: t('layerNames.feature', { n: 1 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature1'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 0.6, 0.8), b('fade-out', 2.8, 0.4)] }),
          layer({ name: t('layerNames.feature', { n: 2 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature2'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 3.2, 0.8), b('fade-out', 5.4, 0.4)] }),
          layer({ name: t('layerNames.feature', { n: 3 }), kind: 'text', align: 'left', text: t('templates.feature-tour.feature3'), color: '#ffffff', fontSize: 0.5, position: [-4.8, 0, 0], blocks: [b('slide-left', 5.8, 0.8), b('scale-out', 8.4, 0.5)] }),
          layer({ name: t('layerNames.steps'), kind: 'text', align: 'left', text: '01 · 02 · 03', color: '#55efc4', fontSize: 0.22, position: [-4.8, 0.8, 0], blocks: [b('fade-in', 0.4, 0.6), b('fade-out', 8.4, 0.5)] }),
        ],
        camera([b('camera-orbit', 0, 9, { params: { angle: 18 } })]),
      ),
  },
  {
    id: 'stats',
    accent: '#fdcb6e',
    build: () => {
      const columns = [
        { x: -3.4, value: 250000, decimals: 0, label: t('templates.stats.users'), start: 0.4 },
        { x: 0, value: 4.9, decimals: 1, label: t('templates.stats.rating'), start: 1.0 },
        { x: 3.4, value: 120, decimals: 0, label: t('templates.stats.countries'), start: 1.6 },
      ]
      return project(
        t('templates.stats.name'),
        7,
        '#15120b',
        [
          layer({ name: t('layerNames.heading'), kind: 'text', text: t('templates.stats.heading'), color: '#fdcb6e', fontSize: 0.34, position: [0, 1.8, 0], blocks: [b('slide-down', 0, 0.8)] }),
          ...columns.flatMap((c, i) => [
            layer({ name: t('layerNames.number', { n: i + 1 }), kind: 'text', text: '0', color: '#ffffff', fontSize: 0.66, position: [c.x, 0.2, 0], blocks: [b('pop', c.start, 0.6), b('count-up', c.start, 1.8, { params: { from: 0, to: c.value, decimals: c.decimals ?? 0 } })] }),
            layer({ name: t('layerNames.label', { n: i + 1 }), kind: 'text', text: c.label, color: '#b2a98f', fontSize: 0.26, position: [c.x, -0.6, 0], blocks: [b('fade-in', c.start + 0.4, 0.6)] }),
          ]),
          layer({ name: t('layerNames.closing'), kind: 'text', text: t('templates.stats.closing'), color: '#fdcb6e', fontSize: 0.3, position: [0, -1.8, 0], blocks: [b('typewriter', 4.2, 1.2), b('fade-in', 4.2, 0.2)] }),
        ],
        camera([b('camera-pan', 0, 7, { params: { distance: 0.6 } }), b('camera-push', 0, 7, { params: { distance: 0.6 } })], [-0.3, 0, 9.4]),
      )
    },
  },
  {
    id: 'logo-reveal',
    accent: '#e17055',
    build: () =>
      project(
        t('templates.logo-reveal.name'),
        5,
        '#120b0a',
        [
          layer({ name: t('layerNames.cubeLeft'), kind: 'shape', color: '#e17055', position: [-2.7, 1.2, -1], scale: 0.6, blocks: [b('pop', 0.1, 0.6), b('spin', 0.1, 2.5), b('scale-out', 3.8, 0.5)] }),
          layer({ name: t('layerNames.cubeRight'), kind: 'shape', color: '#fab1a0', position: [2.7, -1.1, -1], scale: 0.45, blocks: [b('pop', 0.3, 0.6), b('spin', 0.3, 2.5), b('scale-out', 3.9, 0.5)] }),
          layer({ name: t('layerNames.logo'), kind: 'text', text: '◆ nova', color: '#ffffff', fontSize: 0.9, position: [0, 0.2, 0], blocks: [b('pop', 0.6, 0.9, { easing: 'spring-bouncy' })] }),
          layer({ name: t('layerNames.tagline'), kind: 'text', text: t('templates.logo-reveal.tagline'), color: '#fab1a0', fontSize: 0.3, position: [0, -0.7, 0], blocks: [b('typewriter', 1.6, 1), b('fade-in', 1.6, 0.2)] }),
        ],
        camera([b('camera-pull', 0.4, 4.6, { params: { distance: 1.5 } })], [0, 0, 7]),
      ),
  },
  {
    id: 'fintech',
    accent: '#72e83f',
    build: () => {
      // Sinematik ürün tanıtımı: siyah fon, sert kesmelerle ayrılan yakın çekimler, alan derinliği.
      // Her çekim ayrı bir telefon katmanı; kesme = süresi 0 olan fade-in / fade-out.
      // Her çekimde tek uzun hareket: hızlı girer, çekim boyunca yavaşlayarak süzülmeye devam eder
      // (iki ayrı blok hızda kırılma yapıyor). Katmanın konumu çekimin başındaki poz.
      const screen = `${import.meta.env.BASE_URL}templates/screens/fintech.png`
      // Referans 60 kare/sn: kesmeler kare numarasıyla (f(181) = 181. kare).
      const f = (frame: number) => frame / 60
      // Çekim girişi: referanstan ölçüldü (yolun %31'i 0.25 sn'de, %62'si 0.5 sn'de, %85'i 1 sn'de).
      const ENTRY: [number, number, number, number] = [0.2, 0.6, 0.05, 1]
      // logo halkası ve iç kare birlikte büyür (%65 → %100)
      const logoGrow = b('move', f(838), 0.7, { params: { dx: 0, scaleBy: 1 / 0.65 }, easing: 'ease-out' })
      const cut = (from: number, to: number) => [b('fade-in', from, 0), b('fade-out', to, 0)]
      const glide = (start: number, duration: number, params: Record<string, number>, bezier: [number, number, number, number] = [0.03, 0.95, 0.12, 1]) =>
        b('move', start, duration, { params: { dx: 0, ...params }, easing: 'custom', bezier })
      const focus = (at: number, z: number, blur = 1) => b('focus-pull', at, 0, { params: { from: z, to: z, blur } })
      const phone = (n: number, spec: Omit<LayerSpec, 'name' | 'kind' | 'color'>) =>
        layer({ name: `${t('layerNames.phone')} ${n}`, kind: 'phone', color: '#72e83f', image: screen, deviceFinish: 'space', ...spec })
      const text = { kind: 'text' as const, color: '#ffffff', fontFamily: 'space-grotesk', fontSize: 0.7, textWidth: 10 }
      return {
        ...project(
          t('templates.fintech.name'),
          f(1157),
          '#000000',
          [
            // 1) Alt kenar yakın çekim: yukarıdan iner, çekim boyunca yavaşlayarak aşağı süzülür.
            phone(1, {
              position: [0.15, 6.4, -0.3],
              rotation: [-52, -15, -26],
              scale: 3.2,
              blocks: [...cut(0, f(181)), glide(0, f(181), { dx: 0.35, dy: -4.2, rotate: -3 }, ENTRY)],
            }),
            // 2) Üst kenar yakın çekim: sağ alttan girer, sola süzülür; sonda hızlanıp sola çıkar.
            phone(2, {
              position: [4.72, -6.29, 1],
              rotation: [10, -24, 13],
              scale: 3,
              blocks: [
                ...cut(f(181), f(473)),
                // dikey giriş: aşağıdan hızlı gelip yumuşakça oturur
                glide(f(181), 1, { dy: 1.8, rotate: -2 }, ENTRY),
                // yatay: çekim boyunca TEK hareket (hızlı → yavaş → hızlı); iki ayrı blokta aradaki hız
                // sıçraması duraksama gibi görünüyordu. Eğri referanstaki konumlara (her 2 karede bir) uyduruldu.
                b('move', f(181), f(473) - f(181), { params: { dx: -10.85, dy: 1.6 }, easing: 'custom', bezier: [0.2, 0.8, 0.85, 0.1] }),
              ],
            }),
            // 3) Kasa kenarı: alttan yan dönmüş halde yükselir, kapı gibi açılarak ekrana döner.
            phone(3, {
              position: [0.5, -5.13, 3.9],
              rotation: [0, 88, 45],
              scale: 2.3,
              blocks: [...cut(f(473), f(658)), glide(f(473), f(658) - f(473), { dy: 3.5, rotY: -63, rotate: -37, dz: 0.2 }, [0.25, 0.3, 0.15, 1])],
            }),
            // 4) Geniş plan: telefon yukarıdan düşer; metin harf harf yumuşakça belirir.
            phone(4, {
              position: [2.45, 7.3, -0.5],
              rotation: [30, -40, 6],
              scale: 1.45,
              blocks: [...cut(f(658), f(838)), glide(f(658), 2.6, { dy: -7.1, dz: 0.5, rotX: -26, rotY: 18, rotate: -6 }, [0.15, 0.9, 0.3, 1])],
            }),
            layer({ ...text, name: `${t('layerNames.title')} 1`, align: 'left', text: t('templates.fintech.line1'), position: [-4.5, 0.42, 0], blocks: [...cut(f(682), f(838)), b('soft-reveal', f(682), 0.45, { easing: 'linear', params: { softness: 0.35 } })] }),
            layer({ ...text, name: `${t('layerNames.title')} 2`, align: 'left', text: t('templates.fintech.line2'), position: [-4.5, -0.42, 0], blocks: [...cut(f(718), f(838)), b('soft-reveal', f(718), 0.45, { easing: 'linear', params: { softness: 0.35 } })] }),
            // 5) Logo: kesmeyle %65 boyutunda gelir, 0.7 sn'de büyür; içindeki elmas 1.1 sn'de dönüp düz kareye oturur.
            layer({ name: t('layerNames.logo'), kind: 'shape', shape: 'circle', color: '#ffffff', position: [0, 0, 0], scale: 0.91, blocks: [...cut(f(838), f(977)), logoGrow] }),
            layer({
              name: `${t('layerNames.logo')} ◆`,
              kind: 'shape',
              shape: 'rounded',
              color: '#000000',
              position: [0, 0, 0.01],
              rotation: [0, 0, 45],
              scale: 0.52,
              blocks: [...cut(f(838), f(977)), logoGrow, b('move', f(838), 1.1, { params: { dx: 0, rotate: -45 }, easing: 'ease-out' })],
            }),
            // 6) Kapanış: sert kesmeyle biraz büyük gelir, 0.25 sn'de yerine oturur
            layer({
              ...text,
              name: t('layerNames.closing'),
              text: t('templates.fintech.closing'),
              fontSize: 0.78,
              position: [0, 0, 0],
              scale: 1.12,
              blocks: [b('fade-in', f(977), 0), b('move', f(977), 0.25, { params: { dx: 0, scaleBy: 1 / 1.12 }, easing: 'ease-out' })],
            }),
          ],
          camera([
            focus(0, 3.0),
            focus(f(181), 2.1),
            focus(f(473), 4.3, 0.8),
            focus(f(658), 0, 0),
            // çekim sonunda kamera hızla içeri girer (metin ve telefon birlikte büyür), sonra logoya kesme
            b('camera-push', f(826), f(838) - f(826), { params: { distance: 0.7 }, easing: 'ease-in' }),
            b('camera-pull', f(838), 0, { params: { distance: 0.7 } }),
          ]),
        ),
        // referans gibi 60 kare/sn; ürün stüdyosu ışığı; yakın çekimlerde güçlü alan derinliği
        fps: 60,
        lighting: 'studio',
        accentLight: '#9aa4b5',
        effects: {
          dof: { enabled: true, bokeh: 6, range: 1.4 },
          // referansta parlama (bloom) yok: metin, logo ve telefon kenarları temiz
          bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
          vignette: { enabled: true, darkness: 0.35 },
          motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
        },
      }
    },
  },
  {
    id: 'wallet-promo',
    accent: '#f2553f',
    build: () => {
      // Dikey (9:16) cüzdan uygulaması tanıtımı. 60 kare/sn'lik bir referans videodan kare kare ölçüldü;
      // kesme yok: her çekim telefonun kadrajdan çıkıp beyaz fonda bir sonrakinin girmesiyle biter.
      // Fon beyaz, üzerinde bizim ürettiğimiz yumuşak turuncu ışık görselleri (kenarları beyaz, dikiş izi yok).
      const base = import.meta.env.BASE_URL
      const screen = `${base}templates/screens/wallet.png`
      // referansın kapanış karesinden ölçülen radyal profil (dikey yarıçap yatayın 1.6 katı)
      const glowOval = `${base}templates/glow/oval.png`
      const f = (frame: number) => frame / 60
      const brand = 'Pocketa'
      type Bezier = [number, number, number, number]
      const move = (start: number, duration: number, params: Record<string, number>, easing: string | Bezier = 'ease-in-out') =>
        b('move', start, duration, typeof easing === 'string' ? { params: { dx: 0, ...params }, easing } : { params: { dx: 0, ...params }, easing: 'custom', bezier: easing })
      const cut = (from: number, to: number) => [b('fade-in', from, 0), b('fade-out', to, 0)]
      const focus = (at: number, z: number, blur = 1) => b('focus-pull', at, 0, { params: { from: z, to: z, blur } })
      const phone = (n: number, spec: Omit<LayerSpec, 'name' | 'kind' | 'color'>) =>
        layer({ name: `${t('layerNames.phone')} ${n}`, kind: 'phone', color: '#f2553f', image: screen, deviceFinish: 'space', ...spec })
      const glow = (n: number, image: string, spec: Omit<LayerSpec, 'name' | 'kind' | 'color' | 'image'>) =>
        layer({ name: `${t('layerNames.glow')} ${n}`, kind: 'image', color: '#ffffff', image, ...spec })
      const heading = { kind: 'text' as const, fontFamily: 'open-sans', fontWeight: 700 as const, textWidth: 6 }
      // Özellik etiketi: tasarımı hazır, saydam PNG (buzlu cam kutu, ince kenar, yumuşak gölge, çizgi ikon);
      // her dil için ayrı dosya. Referanstaki gibi ~8 karede yumuşakça büyüyerek belirir, telefonla birlikte
      // süzülür ve çıkışta telefonla aynı eğriyle yukarı kayar.
      const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'
      // PNG genişlikleri (yükseklik 342 px); tüm kutular aynı yükseklikte görünsün diye ölçek buna göre
      const BADGE_WIDTH: Record<string, Record<string, number>> = {
        en: { fast: 564, secure: 651, reliable: 684 },
        tr: { fast: 567, secure: 675, reliable: 717 },
      }
      const badge = (id: 'fast' | 'secure' | 'reliable', x: number, y: number, inFrame: number, outFrame: number) =>
        layer({
          name: t(`templates.wallet-promo.${id}`),
          kind: 'image',
          color: '#ffffff',
          image: `${base}templates/wallet/badge-${id}-${lang}.png`,
          // görselin kapladığı yükseklik 0.92 birim (kutu 0.39 birim, referanstaki gibi); kutu merkezden biraz yukarıda
          scale: (0.92 * (BADGE_WIDTH[lang][id] / 342)) / 3,
          position: [x, y - 0.057, 0.8],
          blocks: [
            ...cut(f(inFrame), f(outFrame) + 0.14),
            b('pop', f(inFrame), 0.14, { easing: 'ease-out' }),
            move(f(inFrame), f(310) - f(inFrame), { dy: 0.08 }, 'linear'),
            move(f(310), f(360) - f(310), { dy: 5.5, dx: -2.5 }, [0.32, 0, 0.67, 0]),
            // referansta sırayla küçülerek kaybolur: Reliable ~310, Secure ~316, Fast ~324
            b('scale-out', f(outFrame), 0.14, { easing: 'ease-in' }),
          ],
        })
      return {
        ...project(
          t('templates.wallet-promo.name'),
          f(1145),
          '#ffffff',
          [
            // Etiketler (1. telefonun önünde): Fast solda, Secure sağda, Reliable üstte.
            badge('reliable', -0.2, 1.61, 253, 308),
            badge('secure', 0.91, 0.72, 245, 315),
            badge('fast', -0.71, -0.48, 219, 323),
            // 1) Açılış + özellikler: alttan dönerek yükselir (69–135), durur, geriye yatıp eğilir (190–235),
            //    yavaşça süzülür, sonra yatarak yukarı fırlar (310–360).
            phone(1, {
              position: [0, -5.8, 0],
              rotation: [0, 65, 0],
              scale: 1.42,
              blocks: [
                ...cut(f(69), f(362)),
                // giriş uzun bir kuyrukla yavaşlar (referansta üst kenar 132'de %16.5, 148'de %14.6; ~152'de oturur)
                move(f(69), f(152) - f(69), { dy: 5.6, rotY: -65 }, [0.2, 0, 0, 0.95]),
                // referansta telefon hiç tamamen durmaz: girişle eğilme arasında çok hafif bir süzülme
                move(f(130), f(232) - f(130), { dy: 0.05, rotY: -2 }, 'linear'),
                // eğilme 166'da çok yavaş başlar (telefon hiç tam durmaz), 200–220 arası hızlanır, 232'de biter;
                // eğilince geri çekilir (küçülür). Eğri referanstan ölçüldü: %8 190'da, %38 200'de, %70 210'da.
                move(f(166), f(232) - f(166), { rotX: -18, rotate: 18, dx: 0.15, dy: 0.17, scaleBy: 0.74 }, [0.75, 0, 0.35, 0.75]),
                move(f(232), f(310) - f(232), { dy: 0.12 }, 'linear'),
                // çıkış: kübik hızlanma (referansta yolun %3'ü 325'te, %20'si 340'ta, %55'i 352'de)
                move(f(310), f(360) - f(310), { dy: 5.5, dx: -2.5, rotate: 35, rotX: -40 }, [0.32, 0, 0.67, 0]),
              ],
            }),
            // Başlık: harf harf yazılırken soldan sağa kayıp ortalanır; telefon önünden geçip örter.
            layer({
              ...heading,
              name: t('layerNames.title'),
              text: brand,
              color: '#1f1a17',
              fontSize: 0.5,
              align: 'left',
              position: [-1.71, 0, -0.3],
              blocks: [...cut(0, f(112)), b('typewriter', 0, 0.65), move(f(6), 0.6, { dx: 0.57 }, 'ease-out')],
            }),
            // 2) Yakın çekim: dev telefon sağ alttan yükselir, yavaşça yakınlaşır, yukarı kayıp çıkar.
            phone(2, {
              position: [1.65, -7.65, 2],
              rotation: [-25, 15, 32],
              scale: 2.5,
              blocks: [
                ...cut(f(370), f(645)),
                // hızlı başlayan giriş: referansta yolun %18'i 372'de, %53'ü 384'te, %80'i 396'da
                move(f(370), 1.2, { dy: 6 }, [0, 0.1, 0.15, 1]),
                move(f(440), f(565) - f(440), { dy: 0.12, scaleBy: 1.05 }, 'linear'),
                // çıkış: 565'te yavaşça başlar, kadrajdan çıkana (642) kadar hızlanır (kübik); sola da kayar ki
                // telefonun altı (alt çubuk) kadrajın ortasından geçsin
                move(f(565), f(642) - f(565), { dy: 7.5, dx: -2.4, rotate: -6 }, [0.32, 0, 0.67, 0]),
              ],
            }),
            // 3) Yan çekim: arkası dönük telefon (kamera çıkıntısı) alttan yükselirken öne döner, yakınlaşıp çıkar.
            phone(3, {
              position: [0.29, -6.6, 1],
              rotation: [0, 200, 0],
              scale: 2.1,
              deviceFinish: 'silver',
              blocks: [
                ...cut(f(648), f(884)),
                // Referansta telefon hiç durmaz: yükselme ve dönüş tek uzun, yavaşlayan hareket (648–795; üst kenar
                // 680'de %31.5, 700'de %23, 760'ta %19.6), ardından çok yavaş başlayıp giderek hızlanan
                // yakınlaşma + çıkış (790–884). Eğriler referanstaki konumlara uyduruldu.
                move(f(648), f(795) - f(648), { dy: 4.6 }, [0.15, 1, 0.25, 1]),
                // dönüş başta çok hızlı: 660'ta neredeyse yandan, 665'te tam yandan görünür
                move(f(648), f(795) - f(648), { rotY: -175 }, [0.1, 0.9, 0.2, 1]),
                // çıkışta yukarı hareket yakınlaşmadan baskın olmalı: önceden büyüme alt kenarı yerinde tutuyor,
                // telefon sonda duraksıyor ve kesmede hâlâ görünüyordu. Referansta alt kenar ~883'te kadrajdan çıkar.
                move(f(790), f(884) - f(790), { dy: 11.5, scaleBy: 1.25 }, [0.6, 0, 0.85, 0.25]),
              ],
            }),
            // 4) Kapanış: ortada dikey oval ışık; yazı bulanıktan netleşir (odak kaydırma), 1013. karede
            //    markaya geçer, sonunda her şey beyaza söner.
            layer({
              ...heading,
              name: t('layerNames.closing'),
              text: t('templates.wallet-promo.closing'),
              color: '#ffffff',
              fontSize: 0.39,
              position: [0, 0, 0],
              blocks: [...cut(f(886), f(1013)), b('fade-in', f(886), 0.65, { easing: 'ease-out' })],
            }),
            layer({
              ...heading,
              name: t('layerNames.logo'),
              text: brand,
              color: '#ffffff',
              fontSize: 0.39,
              position: [0, 0, 0],
              blocks: [...cut(f(1013), f(1125)), b('fade-out', f(1076), f(1124) - f(1076), { easing: 'linear' })],
            }),
            glow(4, glowOval, {
              position: [0, 0, -2],
              scale: 2.6,
              blocks: [...cut(f(880), f(1125)), b('fade-in', f(880), 0.7, { easing: 'ease-out' }), b('fade-out', f(1076), f(1124) - f(1076), { easing: 'linear' })],
            }),
            glow(3, glowOval, { position: [0, 0.8, -2], scale: 1.91, blocks: [...cut(f(668), f(884)), b('fade-in', f(668), 0.5), b('fade-out', f(858), f(884) - f(858))] }),
            glow(2, glowOval, { position: [0, 0.8, -2], scale: 1.91, blocks: [...cut(f(385), f(645)), b('fade-in', f(385), 0.6), b('fade-out', f(600), f(645) - f(600))] }),
            // alttan yükselen geniş ışık (açılış ve özellikler çekimi)
            glow(1, glowOval, {
              position: [0, -4.6, -2],
              scale: 3.02,
              blocks: [...cut(f(2), f(362)), b('scale-in', f(2), 0.8), move(f(2), 0.8, { dy: 0.6 }, 'ease-out'), b('fade-out', f(312), f(356) - f(312), { easing: 'ease-out' })],
            }),
          ],
          camera([
            focus(0, 0, 0),
            focus(f(370), 2.6, 0.8),
            // ekran net kalsın: odak ekran düzleminde, bulanıklık hafif (yalnızca uzak kenar yumuşar)
            focus(f(648), 1.3, 0.6),
            // kapanış yazısı bulanıktan netleşir: netlik düzlemi uzaktan yazıya gelir
            b('focus-pull', f(886), 0.65, { params: { from: -6, to: 0, blur: 1 }, easing: 'ease-out' }),
          ]),
        ),
        width: 1080,
        height: 1920,
        fps: 60,
        lighting: 'studio',
        effects: {
          dof: { enabled: true, bokeh: 5, range: 1.4 },
          // referansta parlama ve vinyet yok: fon temiz beyaz
          bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
          vignette: { enabled: false, darkness: 0.35 },
          motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
        },
      }
    },
  },
]

export const DEFAULT_TEMPLATE = TEMPLATES[0]

export const templateName = (id: string) => t(`templates.${id}.name`)
export const templateDescription = (id: string) => t(`templates.${id}.description`)
