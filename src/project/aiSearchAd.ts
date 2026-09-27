import i18n from '../i18n'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'

// "AI search ad": dikey (1080×1920, 60 kare/sn) SaaS reklamı. 30 kare/sn'lik bir referans videodan kare kare
// ölçüldü (tüm kare numaraları 60 kare/sn'ye göre). Ölçüler referansın piksellerinde (720×1280): kamera
// z=9, fov 40 iken 1 birim = 195.4 px. Marka Mango Studio'nun kendisi (mangostudio.design, Mango logosu: gövde +
// sonradan pop-up ile gelen yaprak). ChatGPT/OpenAI adı ve logosu gerçek; rakip adları ve dashboard verileri hayali.
// Görseller: scripts/build-ai-visibility-assets.mjs (+ logo parçaları public/brand/mango-logo-2048.png'den).

type BlockSpec = Omit<Block, 'id'>
type Bezier = [number, number, number, number]
interface Kit {
  t: (key: string, options?: Record<string, unknown>) => string
  b: (preset: string, start: number, duration: number, extra?: Partial<BlockSpec>) => BlockSpec
  layer: (spec: Omit<Layer, 'id' | 'blocks' | 'rotation' | 'scale' | 'opacity' | 'start' | 'duration'> & Partial<Pick<Layer, 'rotation' | 'scale' | 'opacity'>> & { blocks: BlockSpec[] }) => Layer
  camera: (blocks: BlockSpec[], position?: CameraTrack['position']) => CameraTrack
  project: (name: string, duration: number, background: string, layers: Layer[], cam: CameraTrack) => Project
}

const U = 1 / 195.4
const P = (x: number, y: number, z = 0): Vec3 => [(x - 360) * U, (640 - y) * U, z]
/** görselin referanstaki genişliği (px) → katman ölçeği (görsel 3 birim genişliğinde çizilir) */
const sc = (widthPx: number) => (widthPx * U) / 3
const f = (frame: number) => frame / 60

// Inter 700 kelime genişlikleri (em), başlıkları kelime kelime dizmek için (scripts: fontTools ile ölçüldü)
const WORD_EM: Record<string, number> = {
  ChatGPT: 4.375, just: 1.8198, picked: 3.2959, the: 1.5845, winners: 3.9292, in: 0.8936, your: 2.2451, industry: 4.082,
  You: 1.9668, "weren't": 3.7764, on: 1.2358, list: 1.4683, We: 1.6333, get: 1.5938, you: 1.8379, back: 2.3794, it: 0.6372,
  az: 1.1533, önce: 2.4199, kazananları: 5.6694, seçti: 2.3813, senin: 2.6719, sektöründe: 5.5938, Sen: 1.873, listede: 3.29,
  yoktun: 3.4067, Seni: 2.144, listeye: 3.2617, geri: 1.9058, sokuyoruz: 5.1938,
}
const SPACE_EM = 0.2368
// Mango Studio logosunun parçaları (public/brand/mango-logo-2048.png pikselleri): gövde ve yaprak ayrı PNG
const LOGO = {
  full: { w: 660, h: 976, cx: 1024, cy: 907 },
  body: { w: 660, h: 731, cx: 1024, cy: 1029.5 },
  leaf: { w: 314, h: 209, cx: 1089, cy: 523.5 },
}
const HEAD = { size: 73, spacing: -0.078 }
const INK = '#111111'
const ORANGE = '#E65324'

export function buildAiSearchAd({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const img = (name: string) => `${base}templates/ai-visibility/${name}.png`
  const lang = i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const k = (key: string) => t(`templates.ai-search-ad.${key}`)

  /** Özel hareket; dx/dy referans pikseli (dy > 0 aşağı). */
  const move = (from: number, to: number, p: { dx?: number; dy?: number; rotate?: number; rotX?: number; rotY?: number; scaleBy?: number }, easing: string | Bezier = 'ease-in-out') => {
    const params = { dx: (p.dx ?? 0) * U, dy: -(p.dy ?? 0) * U, rotate: p.rotate ?? 0, rotX: p.rotX ?? 0, rotY: p.rotY ?? 0, scaleBy: p.scaleBy ?? 1 }
    return typeof easing === 'string' ? b('move', f(from), f(to - from), { params, easing }) : b('move', f(from), f(to - from), { params, easing: 'custom', bezier: easing })
  }
  const cut = (from: number, to: number) => [b('fade-in', f(from), 0), b('fade-out', f(to), 0)]
  const fadeIn = (from: number, frames: number, easing = 'ease-out') => b('fade-in', f(from), f(frames), { easing })
  const fadeOut = (from: number, frames: number, easing = 'ease-in') => b('fade-out', f(from), f(frames), { easing })

  type Spec = Parameters<Kit['layer']>[0]
  const text = (name: string, spec: Omit<Spec, 'name' | 'kind'>) => layer({ name, kind: 'text', fontFamily: 'inter', ...spec })
  const image = (name: string, file: string, spec: Omit<Spec, 'name' | 'kind' | 'color' | 'image'>) =>
    layer({ name, kind: 'image', color: '#ffffff', image: img(file), ...spec })

  /**
   * Başlık satırı: her kelime ayrı katman, satır ortalanır. `enter` kelimenin girişini (bloklar) verir;
   * kelimenin referans pikselindeki sol kenarı ve y'si ile çağrılır.
   */
  const headline = (words: string[], y: number, color: string, enter: (i: number, word: string) => BlockSpec[], extra: (i: number) => BlockSpec[] = () => []) => {
    const { size, spacing } = HEAD
    const widths = words.map((w) => (WORD_EM[w] ?? w.length * 0.55) + spacing * w.length)
    const gap = (SPACE_EM + spacing) * size
    const total = widths.reduce((s, w) => s + w * size, 0) + gap * (words.length - 1)
    let x = 360 - total / 2
    return words.map((word, i) => {
      const left = x
      x += widths[i] * size + gap
      return text(word, {
        text: word,
        color,
        fontWeight: 700,
        fontSize: size * U,
        letterSpacing: spacing,
        align: 'left',
        textWidth: 20,
        position: P(left, y),
        blocks: [...enter(i, word), ...extra(i)],
      })
    })
  }
  const split = (key: string) => k(key).split(' ')

  // ── Sahne 1: ChatGPT sohbeti (0–408) ───────────────────────────
  const RISE = 700 // arayüz alttan yükselir (0–56): konum +700 px aşağıda, hareket yukarı
  const rise = move(0, 56, { dy: -RISE }, [0.136, 0.87, 0.604, 1])
  // Gönder'e basınca giriş satırı en alta iner (128–170)
  const down = move(128, 170, { dy: 388 }, [0.45, 0, 0.2, 1])
  const push = move(290, 302, { dy: 56 }, 'ease-in-out')
  const S1 = 408

  // "ChatGPT just / picked the winners": kelimeler 8 karede bir, 16 px aşağıdan belirir; 104'te sağa kayıp söner
  const hA = (words: string[], y: number, first: number) =>
    headline(words, y + 30, INK, (i) => [
      ...cut(0, 118),
      fadeIn(first + i * 8, 16),
      move(first + i * 8, first + i * 8 + 18, { dy: -30 }, 'ease-out'),
      move(104, 116, { dx: 24, dy: 10 }, 'ease-in'),
      fadeOut(104, 12),
    ])
  const line1A = split('h1a')
  const headA = [...hA(line1A, 234, 2), ...hA(split('h1b'), 321, 2 + line1A.length * 8)]

  // "in your industry": soldan harf harf yazılır; son harfler turuncu belirir
  const industryText = k('h2')
  const industryW = industryText.split(' ').reduce((s, w) => s + ((WORD_EM[w] ?? w.length * 0.55) + HEAD.spacing * w.length) * HEAD.size, 0) + (SPACE_EM + HEAD.spacing) * HEAD.size * (industryText.split(' ').length - 1)
  const headB = text(k('layers.headline2'), {
    text: industryText,
    color: INK,
    fontWeight: 700,
    fontSize: HEAD.size * U,
    letterSpacing: HEAD.spacing,
    align: 'left',
    textWidth: 20,
    position: P(360 - industryW / 2, 271),
    // yazım yavaşlayarak biter (referans: 108'de 2, 112'de 7, 116'da 11, 120'de 14 harf)
    blocks: [...cut(106, 194), b('typewriter', f(106), f(22), { easing: 'custom', bezier: [0.25, 0.46, 0.45, 0.94], params: { trail: 3, trailHue: 15 } }), move(186, 194, { dy: -40 }, 'ease-in'), fadeOut(186, 8)],
  })

  const ui = (extra: BlockSpec[]) => [rise, ...extra]
  const inputBar = image(k('layers.input'), 'input-bar', { position: P(323, 721 + RISE, -0.01), scale: sc(584), blocks: ui([...cut(0, S1), down, push]) })
  const sendDark = image(k('layers.send'), 'send-dark', { position: P(657, 723 + RISE), scale: sc(54), blocks: ui([...cut(0, 142), down]) })
  const sendIdle = image(k('layers.sendIdle'), 'send-idle', { position: P(657, 723 + RISE), scale: sc(54), blocks: ui([...cut(142, S1), down, push]) })
  const ring = image(k('layers.ring'), 'ring', {
    position: P(657, 723 + RISE, -0.005),
    scale: sc(54.8),
    blocks: ui([...cut(128, 192), down, move(128, 180, { scaleBy: 4.5 }, 'ease-out'), fadeOut(146, 40, 'linear')]),
  })
  const typed = text(k('layers.prompt'), {
    text: k('prompt'),
    color: '#0d0d0d',
    fontSize: 27 * U,
    align: 'left',
    textWidth: 20,
    position: P(140, 721 + RISE, 0.01),
    blocks: ui([...cut(0, 142), down, b('typewriter', f(6), f(86), { easing: 'linear' }), b('caret', f(4), f(88), { params: { blink: 0 } }), b('caret', f(92), f(36), { params: { blink: 1.5 } })]),
  })
  const placeholder = text(k('layers.placeholder'), {
    text: k('placeholder'),
    color: '#b3b3b3',
    fontSize: 27 * U,
    align: 'left',
    textWidth: 20,
    position: P(140, 721 + RISE, 0.01),
    blocks: ui([...cut(142, S1), down, push]),
  })
  // ChatGPT logosu: ortada durur, cevap gelirken küçülüp sohbetteki avatar yerine kayar (138–172)
  const gptLogo = image('ChatGPT', 'chatgpt-logo', {
    position: P(362, 577 + RISE, 0.01),
    scale: sc(90),
    blocks: ui([...cut(0, S1), move(138, 172, { dx: -308, dy: 29, scaleBy: 50 / 90 }, [0.672, 0.089, 0.316, 0.826])]),
  })

  // Sohbet: "You" mesajı 142'de, ChatGPT cevabı 160'ta, liste maddeleri 4–6 karede bir aşağıdan yükselir
  const appear = (from: number, lift: number, frames = 24) => [fadeIn(from, 10), move(from, from + frames, { dy: -lift }, 'ease-out')]
  const convo = (name: string, spec: Omit<Spec, 'name' | 'kind' | 'position'> & { at: [number, number]; from: number; lift: number; kind?: 'text' | 'image' }) => {
    const { at, from, lift, kind = 'text', blocks, ...rest } = spec
    return layer({ name, kind, fontFamily: 'inter', position: P(at[0], at[1] + lift), ...rest, blocks: [...cut(0, S1), ...appear(from, lift), ...blocks] })
  }
  const you = [
    convo(k('layers.avatar'), { kind: 'image', image: img('avatar'), color: '#ffffff', scale: sc(48), at: [52, 475], from: 142, lift: 34, blocks: [] }),
    convo(k('you'), { text: k('you'), color: INK, fontWeight: 700, fontSize: 31 * U, align: 'left', textWidth: 20, at: [104, 476], from: 142, lift: 34, blocks: [] }),
    convo(k('layers.question'), { text: k('prompt'), color: INK, fontSize: 27 * U, align: 'left', textWidth: 20, at: [104, 521], from: 142, lift: 34, blocks: [] }),
    convo('ChatGPT', { text: 'ChatGPT', color: INK, fontWeight: 700, fontSize: 31 * U, align: 'left', textWidth: 20, at: [104, 604], from: 160, lift: 40, blocks: [] }),
    convo(k('layers.answer'), { text: k('answer'), color: INK, fontWeight: 700, fontSize: 31 * U, align: 'left', textWidth: 20, at: [104, 652], from: 162, lift: 40, blocks: [] }),
  ]
  // Hayali rakipler; alan adı rozeti girince (290–302) 113 px aşağı kayarlar
  const RIVALS = ['Mailora', 'Sendlyne', 'Inboxa', 'Postwave', 'Letterly']
  const listY = [712, 776, 840, 902, 967]
  const listStart = [166, 170, 174, 180, 184]
  const rivals = RIVALS.map((name, i) =>
    convo(name, { text: `•  ${name}`, color: INK, fontSize: 30 * U, align: 'left', textWidth: 20, at: [113, listY[i]], from: listStart[i], lift: 60, blocks: [move(290, 302, { dy: 113 }, 'ease-in-out')] }),
  )
  // "You weren't on the list" sırasında listenin üstünde yanıp sönen pembe kutu (ölçülen açık kareler)
  const flashes = ([[202, 206], [210, 216], [218, 230], [234, 240]] as const).map(([a, z], i) =>
    layer({ name: `${k('layers.highlight')} ${i + 1}`, kind: 'shape', shape: 'rect', shapeWidth: 580 * U, shapeHeight: 320 * U, color: '#FAD9CE', position: P(360, 840, -0.01), blocks: cut(a, z) }),
  )
  // Alan adı rozeti sağdan dönerek girip listenin başına oturur (282–302)
  const domain = image(k('layers.domain'), 'domain-pill', {
    position: P(260 + 600, 740 - 40, 0.01),
    rotation: [0, 0, -20],
    scale: sc(360) * 1.2,
    blocks: [...cut(286, S1), move(286, 306, { dx: -600, dy: 40, rotate: 20, scaleBy: 1 / 1.2 }, [0.33, 0.45, 0.4, 1])],
  })

  // "You weren't / on the list": kelimeler yukarıdan düşer (190–212); 294'te küçülüp söner
  const drop = (start: number, frames = 10, easing: string | Bezier = 'ease-out') => [fadeIn(start, 4, 'linear'), move(start, start + frames, { dy: 70 }, easing)]
  const hC = (words: string[], y: number, color: string, first: number, step: number) =>
    headline(words, y - 70, color, (i) => [...cut(0, 302), ...drop(first + i * step)], () => [fadeOut(292, 7), move(286, 299, { scaleBy: 0.7 }, 'ease-in')])
  const line1C = split('h3a')
  const headC = [...hC(line1C, 232, INK, 190, 4), ...hC(split('h3b'), 316, ORANGE, 190 + line1C.length * 4, 2)]
  // "We get you / back on it": turuncu, kelimeler hafif sekerek düşer (302–338)
  const hD = (words: string[], y: number, starts: number[]) =>
    headline(words, y - 70, ORANGE, (i) => [...cut(0, S1), ...drop(starts[i] ?? starts[starts.length - 1] + 4, 12, [0.3, 1.35, 0.5, 1])])
  const line1D = split('h4a')
  const DSTARTS = [298, 302, 306, 314, 320, 328]
  const headD = [...hD(line1D, 226, DSTARTS.slice(0, line1D.length)), ...hD(split('h4b'), 312, DSTARTS.slice(line1D.length))]

  // ── Sahne 2: logo (408–550) ─────────────────────────────────────
  // Mango Studio logosu ortada büyük çizilir: gövde 408'de fırlayıp oturur, yeşil yaprak 420'de pop-up ile
  // gelir (referanstaki turuncu dalgaların yerine); 443–461 küçülüp sola kayar, mangostudio.design açılır;
  // 470'ten itibaren yukarı kaçar (dashboard gelir).
  const WORD = { size: 52, spacing: -0.02, text: 'mangostudio.design' }
  const wordW = (9.967 + WORD.spacing * WORD.text.length) * WORD.size
  const MANGO = 74 // küçük logonun yüksekliği (px)
  const mangoW = (MANGO * LOGO.full.w) / LOGO.full.h
  const lockLeft = 360 - (mangoW + 12 + wordW) / 2
  const markX = lockLeft + mangoW / 2
  const textX = lockLeft + mangoW + 12
  /** Logo parçasının (gövde/yaprak) yüksekliği `height` olan logodaki merkezi ve genişliği. */
  const part = (id: 'body' | 'leaf', height: number, cx: number, cy: number) => {
    const k0 = height / LOGO.full.h
    const p = LOGO[id]
    return { x: cx + (p.cx - LOGO.full.cx) * k0, y: cy + (p.cy - LOGO.full.cy) * k0, w: p.w * k0 }
  }
  const file = { body: 'mango-body', leaf: 'mango-leaf' } as const
  const partName = (id: 'body' | 'leaf', scene = k('layers.mark')) => `${scene} · ${k(`layers.${id}`)}`
  // kalkış: 482 civarında en hızlı, uzun kuyrukla yavaşlar (referanstan uydurulmuş, hata 3.7 px), 520'den sonra hızlanıp çıkar
  const logoExit = [move(470, 520, { dy: -217 }, [0.388, 0.137, 0, 0.511]), move(520, 546, { dy: -330 }, [0.55, 0.085, 0.68, 0.53])]
  const BIG = 140
  const bigMango = (id: 'body' | 'leaf') => {
    const from = part(id, BIG, 360, 620)
    const to = part(id, MANGO, markX, 637)
    const intro =
      id === 'body'
        ? [move(408, 416, { scaleBy: 2.6 }, 'ease-out'), move(416, 430, { scaleBy: 1 / 1.3 }, 'ease-out')]
        : [b('pop', f(420), f(22), { easing: 'ease-out-back' })]
    return image(partName(id), file[id], {
      position: P(from.x, from.y, id === 'leaf' ? 0.01 : 0),
      scale: sc(from.w) * (id === 'body' ? 0.5 : 1),
      blocks: [...cut(id === 'body' ? 408 : 420, 548), ...intro, move(443, 461, { dx: to.x - from.x, dy: to.y - from.y, scaleBy: MANGO / BIG }, 'ease-in-out'), ...logoExit],
    })
  }
  /**
   * mangostudio.design: "mangostudio" koyu, ".design" mango turuncusu (dashboard'daki gibi). Soldan sağa yumuşak
   * açılır: önce "mangostudio", ardından ".design" (süre harf sayısına göre bölünür).
   */
  const wordmark = (y: number, start: number, frames: number, extra: BlockSpec[], from: number, to: number, scene = k('layers.wordmark')) => {
    const parts = [
      { text: 'mangostudio', color: '#1a1718', em: 6.41 },
      { text: '.design', color: '#D9711C', em: 3.557 },
    ]
    const total = parts.reduce((n, p) => n + p.text.length, 0)
    let x = textX
    let t0 = start
    return parts.map((p) => {
      const left = x
      const t = t0
      const dur = (frames * p.text.length) / total
      x += (p.em + WORD.spacing * p.text.length) * WORD.size
      t0 += dur
      return text(`${scene} · ${p.text}`, {
        text: p.text,
        color: p.color,
        fontFamily: 'space-grotesk',
        fontWeight: 700,
        fontSize: WORD.size * U,
        letterSpacing: WORD.spacing,
        align: 'left',
        textWidth: 20,
        position: P(left, y),
        blocks: [...cut(Math.max(from, Math.floor(t)), to), b('soft-reveal', f(t), f(dur), { easing: t === start ? 'linear' : 'ease-out', params: { softness: 0.25 } }), ...extra],
      })
    })
  }
  const logoScene = [
    ...wordmark(652, 459, 22, logoExit, 459, 548),
    bigMango('leaf'),
    bigMango('body'),
  ]

  // ── Sahne 3: dashboard (476–698) ────────────────────────────────
  const dashboard = image(k('layers.dashboard'), 'dashboard', {
    position: P(360, 838 + 725),
    scale: sc(600),
    blocks: [
      ...cut(476, 698),
      move(476, 530, { dy: -725 }, [0.134, 0.211, 0.106, 0.967]),
      // öne eğilip büyür: üst kenar kameraya yaklaşır, hafifçe döner (528–600)
      move(528, 600, { dx: -110, dy: -80, rotX: 30, rotate: 9, rotY: -14, scaleBy: 1.62 }, 'ease-in-out'),
      move(600, 690, { dy: -200, rotX: 6, scaleBy: 0.92 }, 'ease-out'),
      move(690, 698, { dy: 40, scaleBy: 0.95 }, 'ease-in'),
    ],
  })

  // ── Sahne 4: uygulama ikonu + özellik kartları (698–930), gri fon ──
  const iconMoves = [move(698, 766, { scaleBy: 1 / 1.572 }, [0.088, 0.323, 0, 1]), move(768, 786, { dy: 95, scaleBy: 0.83 }, 'ease-in-out'), move(918, 928, { scaleBy: 0.94 }, 'ease-in')]
  const ICON = 441 // ikon tuvali: daire 229 px olacak şekilde
  const ICON_MANGO = 150 // dairedeki logonun yüksekliği
  /** Logo parçası ikonun merkezine göre durur; ikon küçülürken merkeze olan uzaklığı da aynı oranda küçülür. */
  const iconMango = (id: 'body' | 'leaf', popAt: number) => {
    const p = part(id, ICON_MANGO, 363, 637)
    const ox = p.x - 363
    const oy = p.y - 637
    const K = 1.572
    return image(partName(id, k('layers.icon')), file[id], {
      position: P(363 + ox * K, 637 + oy * K, id === 'leaf' ? 0.015 : 0.01),
      scale: sc(p.w) * K,
      blocks: [
        ...cut(popAt, 930),
        b('pop', f(popAt), f(18), { easing: 'ease-out-back' }),
        move(698, 766, { dx: ox * (1 - K), dy: oy * (1 - K), scaleBy: 1 / K }, [0.088, 0.323, 0, 1]),
        move(768, 786, { dx: ox * (0.83 - 1), dy: 95 + oy * (0.83 - 1), scaleBy: 0.83 }, 'ease-in-out'),
        move(918, 928, { dx: ox * 0.83 * (0.94 - 1), dy: oy * 0.83 * (0.94 - 1), scaleBy: 0.94 }, 'ease-in'),
      ],
    })
  }
  const PIVOT: [number, number] = [363, 731]
  const card = (id: string, angle: number, at: number) => {
    const r = 222
    const a = (angle * Math.PI) / 180
    const dx = -r * Math.sin(a)
    const dy = -r * Math.cos(a)
    return image(k(`cards.${id}`), `card-${id}-${lang}`, {
      position: P(PIVOT[0], PIVOT[1], -0.02),
      scale: sc(160) * 0.7,
      blocks: [...cut(at, 930), move(at, at + 18, { dx, dy, rotate: angle, scaleBy: 1 / 0.7 }, [0.3, 1.3, 0.5, 1]), move(918, 928, { scaleBy: 0.94 }, 'ease-in')],
    })
  }
  const greyBg = layer({ name: `${k('layers.background')} · ${k('layers.grey')}`, kind: 'shape', shape: 'rect', shapeWidth: 14, shapeHeight: 16, color: '#F1F2F5', position: P(360, 640, -1), blocks: cut(698, 1064) })
  const iconScene = [
    iconMango('leaf', 708),
    iconMango('body', 698),
    image(k('layers.icon'), 'app-icon', { position: P(363, 637), scale: sc(ICON) * 1.572, blocks: [...cut(698, 930), ...iconMoves] }),
    card('content', 32, 775),
    card('backlinks', 0, 822),
    card('tracking', -32, 862),
  ]

  // ── Sahne 5: sayaç (928–1064) ───────────────────────────────────
  // Çerçeve büyük gelir ve yavaşlayarak oturur, sayı 17'den 100'e sayar; 988'de hepsi sola kayar, "automated" alttan sekerek gelir.
  // çerçeve: sol kenar 54 px, yükseklik 85 px (597–682), sağ ucu solarak açık; kaymadan önce 184 px sağda
  const PILL = { x: 372.6, y: 640, w: 299 }
  const K0 = 1.62
  /** Katmanı çerçevenin merkezine göre K0 katından 1'e küçültür (konumu da merkeze göre). */
  const settle = (x: number, y: number, z = 0.01) => ({
    position: P(PILL.x + (x - PILL.x) * K0, y, z),
    blocks: [move(928, 986, { dx: (x - PILL.x) * (1 - K0), scaleBy: 1 / K0 }, [0.25, 0.7, 0.4, 1]), move(990, 1002, { dx: -184 }, 'ease-in-out'), move(1056, 1064, { scaleBy: 0.92 }, 'ease-in'), fadeOut(1058, 6)],
  })
  // Referanstan: "100%" 92–275 px (sağ ucu çerçevenin solan ucunda), büyük harf yüksekliği 52 px, taban çizgisi 667;
  // kaymadan önce her şey 184 px sağda. Yazı tipi Plus Jakarta Sans 700, sıkı aralık.
  const NUM = { size: 70, spacing: -0.06, font: 'plus-jakarta-sans' }
  const pctW = (1.046 + NUM.spacing) * NUM.size
  const numY = 667 - 0.22 * NUM.size
  const pctFirst = lang === 'tr'
  const numText = (name: string, spec: { text: string; x: number; align: 'left' | 'right'; blocks: BlockSpec[] }) => {
    const st = settle(spec.x + 184, numY)
    return text(name, {
      text: spec.text,
      color: ORANGE,
      fontFamily: NUM.font,
      fontWeight: 700,
      fontSize: NUM.size * U * K0,
      letterSpacing: NUM.spacing,
      align: spec.align,
      textWidth: 20,
      position: st.position,
      blocks: [...cut(930, 1064), ...spec.blocks, ...st.blocks],
    })
  }
  const countUp = b('count-up', f(928), f(20), { easing: 'custom', bezier: [0.35, 0.35, 0.45, 1], params: { from: 17, to: 100 } })
  // EN: sayı sağa yaslı, "%" sabit (iki basamakta arada boşluk kalır, referanstaki gibi); TR: "%" solda, sayı ardından
  const numberLayer = pctFirst
    ? numText(k('layers.counter'), { text: '100', x: 92 + pctW, align: 'left', blocks: [countUp] })
    : numText(k('layers.counter'), { text: '100', x: 275 - pctW + 3, align: 'right', blocks: [countUp] })
  const pctLayer = numText('%', { text: '%', x: pctFirst ? 92 : 275 - pctW, align: 'left', blocks: [] })
  const pillLayer = (() => {
    const s = settle(PILL.x, PILL.y, -0.01)
    return image(k('layers.frame'), 'counter-pill', { position: s.position, scale: sc(PILL.w) * K0, blocks: [...cut(928, 1064), ...s.blocks] })
  })()
  const automated = text(k('automated'), {
    text: k('automated'),
    color: INK,
    fontFamily: NUM.font,
    fontWeight: 700,
    fontSize: 68 * U,
    letterSpacing: -0.05,
    align: 'left',
    textWidth: 20,
    position: P(287, 668 - 0.22 * 68 + 31, 0.01),
    blocks: [...cut(997, 1064), fadeIn(997, 3), move(997, 1020, { dy: -31 }, [0.25, 1.8, 0.45, 1]), move(1056, 1064, { dx: -20, scaleBy: 0.92 }, 'ease-in'), fadeOut(1058, 6)],
  })

  // ── Sahne 6: kapanış (1064–1306), pembe fon ─────────────────────
  // İşaret ortada küçük çizilir, sola kayar ve yazı açılır; logo yukarı kalkar, düğme belirir,
  // imleç sağ alttan gelip tıklar.
  const endY = 630
  const lift = move(1128, 1146, { dy: -47 }, 'ease-out')
  // logo ortada küçük çizilir (gövde 1068, yaprak 1080 pop-up), 1100–1122 sola kayar
  const endMango = (id: 'body' | 'leaf', popAt: number) => {
    const from = part(id, MANGO, 360, 626)
    const to = part(id, MANGO, markX, endY)
    return image(partName(id, k('layers.closing')), file[id], {
      position: P(from.x, from.y, id === 'leaf' ? 0.01 : 0),
      scale: sc(from.w),
      blocks: [...cut(popAt, 1306), b('pop', f(popAt), f(22), { easing: 'ease-out-back' }), move(1100, 1122, { dx: to.x - from.x, dy: to.y - from.y }, 'ease-in-out'), lift],
    })
  }
  const press = [move(1190, 1197, { scaleBy: 0.94 }, 'ease-out'), move(1197, 1210, { scaleBy: 1 / 0.94 }, 'ease-out')]
  const TIP: [number, number] = [457, 731]
  const CURSOR = 56 // imleç tuvali (ok ≈ 60 px)
  const tipToCenter = (x: number, y: number): [number, number] => [x + 22.4, y + 32.2]
  const [cx, cy] = tipToCenter(...TIP)
  const endScene = [
    image(k('layers.cursor'), 'cursor', {
      position: P(cx + 263, cy + 259, 0.02),
      scale: sc(CURSOR),
      blocks: [...cut(1120, 1306), move(1124, 1186, { dx: -263, dy: -259 }, [0.2, 0.62, 0.35, 1])],
    }),
    image(k('layers.click'), 'click-ring', {
      position: P(TIP[0], TIP[1], 0.01),
      scale: sc(22),
      blocks: [...cut(1190, 1216), move(1190, 1214, { scaleBy: 3 }, 'ease-out'), fadeOut(1194, 20, 'linear')],
    }),
    text(k('layers.cta'), {
      text: k('cta'),
      color: '#ffffff',
      fontFamily: 'poppins',
      fontSize: 22 * U,
      position: P(362, 688, 0.01),
      blocks: [...cut(1144, 1306), b('word-reveal', f(1144), f(16), { easing: 'linear' }), ...press],
    }),
    image(k('layers.button'), 'button', { position: P(362, 690), scale: sc(300), blocks: [...cut(1138, 1306), b('pop', f(1138), f(14), { easing: 'ease-out-back' }), ...press] }),
    ...wordmark(endY + 15, 1114, 26, [lift], 1114, 1306, `${k('layers.closing')} · ${k('layers.wordmark')}`),
    endMango('leaf', 1080),
    endMango('body', 1068),
    image(`${k('layers.background')} · ${k('layers.pink')}`, 'end-bg', { position: P(360, 640, -1), scale: sc(820), blocks: cut(1064, 1306) }),
  ]

  // ── Kamera ──────────────────────────────────────────────────────
  // Referanstan kare kare ölçüldü (benzerlik dönüşümü): hafif yatay salınım, "You weren't" ile ×1.22
  // yakınlaşma, "We get you" ile ×0.89 uzaklaşma, sahne sonunda ×0.60'a küçülüp kesme.
  const cam = { x: 360, y: 640, s: 1 }
  const camBlocks: BlockSpec[] = []
  const camTo = (from: number, to: number, target: { x?: number; y?: number; s?: number }, easing: string | Bezier = 'ease-in-out') => {
    const dx = (target.x ?? cam.x) - cam.x
    const dy = (target.y ?? cam.y) - cam.y
    const zoom = (target.s ?? cam.s) / cam.s
    Object.assign(cam, target)
    const params = { dx: dx * U, dy: -dy * U, zoom }
    camBlocks.push(typeof easing === 'string' ? b('camera-move', f(from), f(to - from), { params, easing }) : b('camera-move', f(from), f(to - from), { params, easing: 'custom', bezier: easing }))
  }
  const camStart: Vec3 = [0, 0, 9]
  // kamera ve baktığı nokta birlikte kaymalı: başlangıç kayması da bir blokla verilir
  camTo(0, 0, { x: 351.2 }, 'linear')
  camTo(0, 48, { x: 366.2 })
  camTo(48, 94, { x: 354.7 })
  camTo(94, 130, { x: 360.6 })
  camTo(130, 186, { x: 357.3, y: 635.6 })
  camTo(186, 220, { s: 1.2199 }, [0.534, 0.027, 0, 1.031])
  camTo(186, 220, { x: 349.8, y: 767.7 }, [0.551, 0.217, 0, 1.014])
  camTo(220, 262, { s: 1 }, [0.765, -0.011, 0.046, 0.956])
  camTo(220, 262, { x: 358.7, y: 641.2 }, [0.764, -0.032, 0.055, 0.912])
  camTo(288, 304, { s: 0.89, x: 354.5 }, [0.791, 0.119, 0.016, 0.96])
  camTo(318, 342, { s: 1, x: 355.6 }, [0.947, -0.036, 0.131, 0.96])
  camTo(376, 406, { s: 0.604 }, [0.99, -0.025, 0.996, 1.18])
  // kesmede kamera tam ortaya ve 1 kata döner
  camTo(S1, S1, { x: 360, y: 640, s: 1 }, 'linear')

  return {
    ...project(
      k('name'),
      f(1306),
      '#ffffff',
      [
        // Timeline'da sahneler zaman sırasıyla (ilk sahne üstte). Liste sırası çizim sırası da olduğu için her sahnenin
        // içinde öndeki katman üstte; sahneler zamanda üst üste binmediğinden aralarındaki sıra görüntüyü değiştirmez.
        // Fonlar opak/en arkada (z = -1), derinlik testiyle her zaman arkada kalır.
        ...headA,
        headB,
        ...headC,
        ...headD,
        gptLogo,
        typed,
        placeholder,
        sendDark,
        sendIdle,
        ring,
        inputBar,
        domain,
        ...you,
        ...rivals,
        ...flashes,
        ...logoScene,
        dashboard,
        ...iconScene,
        numberLayer,
        pctLayer,
        pillLayer,
        automated,
        greyBg,
        ...endScene,
      ],
      camera(camBlocks, camStart),
    ),
    width: 1080,
    height: 1920,
    fps: 60,
    effects: {
      dof: { enabled: false, bokeh: 3, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      motionBlur: { enabled: true, samples: 6, shutter: 0.5 },
    },
  }
}
