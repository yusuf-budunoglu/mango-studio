import type { CameraState, LayerKind, LayerState } from './types'

/**
 * Her animasyon bloğu küçük bir formül: e = eğriden geçmiş ilerleme (0..1),
 * p = ham ilerleme. Blok başlamadan önce e=0, bittikten sonra e=1 ile çağrılır;
 * böylece giriş animasyonları başlamadan önce katmanı gizli tutar.
 */
/** Bloğun ayarlanabilir bir sayısı. Adı çeviri dosyasında: `params.<key>`. */
export interface ParamSpec {
  key: string
  default: number
  min?: number
  max?: number
  step: number
}

interface PresetBase {
  /** adı ve kategori adı çeviri dosyalarında: `presets.<id>`, `categories.<category>` */
  category: 'in' | 'out' | 'emphasis' | 'move' | 'text' | 'camera' | 'transition' | 'lens'
  defaultEasing: string
  defaultDuration: number
  /** paneldeki ayarlar; `apply` bunların varsayılanlarla birleşmiş halini alır */
  params?: ParamSpec[]
  /** yalnızca bu türdeki katmanlarda anlamlı (panelde yalnızca onlara önerilir); boşsa hepsinde */
  kinds?: LayerKind[]
}

/** `duration`: bloğun süresi (sn); zamana bağlı titreşim gibi bloklar için. */
export interface LayerPreset extends PresetBase {
  target: 'layer'
  apply: (s: LayerState, e: number, p: number, params: Record<string, number>, duration: number) => void
}

export interface CameraPreset extends PresetBase {
  target: 'camera'
  apply: (s: CameraState, e: number, p: number, params: Record<string, number>, duration: number) => void
}

export type Preset = LayerPreset | CameraPreset

const DEG = Math.PI / 180

/** Yumuşak, tekrarlanabilir titreşim (-1..1): farklı frekanslı sinüslerin toplamı, rastgelelik yok. */
export function wobble(t: number, seed: number) {
  const w = 2 * Math.PI
  return 0.5 * Math.sin(t * w * 1.3 + seed * 1.7) + 0.3 * Math.sin(t * w * 2.9 + seed * 4.1) + 0.2 * Math.sin(t * w * 5.3 + seed * 2.3)
}

/** Blok içinde 0'dan 1'e ve geri: bloğun dışında 0. */
const bell = (p: number) => (p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p))
const distance = (d: number): ParamSpec => ({ key: 'distance', default: d, min: -20, max: 20, step: 0.1 })

export const PRESETS: Record<string, Preset> = {
  // Katlanır telefonu `angle` açıklığına getirir ve orada bırakır (180 açık, 0 kapalı); art arda bloklar birikir:
  // önce 0'a kapat, sonra 180'e aç gibi.
  fold: {
    target: 'layer', category: 'move', defaultEasing: 'ease-in-out', defaultDuration: 1.2, kinds: ['foldable'],
    params: [{ key: 'angle', default: 0, min: 0, max: 180, step: 5 }],
    apply: (s, e, _p, { angle }) => { s.fold += (angle - s.fold) * e },
  },
  'fade-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out', defaultDuration: 0.6,
    apply: (s, e) => { s.opacity *= e },
  },
  'slide-up': {
    target: 'layer', category: 'in', defaultEasing: 'spring-gentle', defaultDuration: 0.9,
    params: [distance(1.2)],
    apply: (s, e, _p, { distance }) => { s.y -= (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'slide-down': {
    target: 'layer', category: 'in', defaultEasing: 'spring-gentle', defaultDuration: 0.9,
    params: [distance(1.2)],
    apply: (s, e, _p, { distance }) => { s.y += (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'slide-left': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 0.9,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.x += (1 - e) * distance; s.opacity *= Math.min(1, e * 1.4) },
  },
  'scale-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 0.8,
    apply: (s, e) => { s.scale *= 0.6 + 0.4 * e; s.opacity *= e },
  },
  pop: {
    target: 'layer', category: 'in', defaultEasing: 'spring-bouncy', defaultDuration: 0.7,
    apply: (s, e) => { s.scale *= Math.max(0, e) },
  },
  'rotate-in': {
    target: 'layer', category: 'in', defaultEasing: 'ease-out-expo', defaultDuration: 1.2,
    params: [{ key: 'angle', default: -70, min: -360, max: 360, step: 5 }],
    apply: (s, e, _p, { angle }) => { s.rotY += (1 - e) * angle * DEG; s.opacity *= Math.min(1, e * 2) },
  },
  'fade-out': {
    target: 'layer', category: 'out', defaultEasing: 'ease-in', defaultDuration: 0.5,
    apply: (s, e) => { s.opacity *= 1 - e },
  },
  'scale-out': {
    target: 'layer', category: 'out', defaultEasing: 'ease-in', defaultDuration: 0.5,
    apply: (s, e) => { s.scale *= 1 - 0.4 * e; s.opacity *= 1 - e },
  },
  float: {
    target: 'layer', category: 'emphasis', defaultEasing: 'linear', defaultDuration: 3,
    params: [{ key: 'amount', default: 0.12, min: 0, max: 3, step: 0.02 }, { key: 'cycles', default: 1, min: 0.5, max: 20, step: 0.5 }],
    apply: (s, _e, p, { amount, cycles }) => { s.y += Math.sin(p * Math.PI * 2 * cycles) * amount },
  },
  sway: {
    // Rüzgârda sallanma: katman kendi merkezi etrafında sağa sola eğilir (çiçek/çimen görsellerinde sapın dibi
    // görselin ortasında olduğundan dibinden sallanır). Blok dışında eğim yok; tam sayı tekrarda başı ve sonu aynı eğimde (döngü dikişsiz).
    target: 'layer', category: 'emphasis', defaultEasing: 'linear', defaultDuration: 4,
    // phase: salınımın başladığı an (0..1 tur); yan yana çiçekler aynı anda eğilmesin diye
    params: [
      { key: 'angle', default: 4, min: 0, max: 45, step: 0.5 },
      { key: 'cycles', default: 2, min: 0.5, max: 20, step: 0.5 },
      { key: 'phase', default: 0, min: 0, max: 1, step: 0.05 },
    ],
    apply: (s, _e, p, { angle, cycles, phase }) => {
      if (p <= 0 || p >= 1) return
      const w = (p * cycles + phase) * Math.PI * 2
      s.rotZ += (0.8 * Math.sin(w) + 0.2 * Math.sin(2 * w)) * angle * DEG
    },
  },
  spin: {
    target: 'layer', category: 'emphasis', defaultEasing: 'ease-in-out', defaultDuration: 1.5,
    apply: (s, e) => { s.rotY += e * Math.PI * 2 },
  },
  'light-sweep': {
    // Görsel katmanında (çerçeve, kutu kenarı) kenar yolu boyunca dönen ışıklar: görsel yalnızca ışıkların
    // olduğu yerlerde parlak görünür, ışıklar yuvarlatılmış kutunun çevresinde eşit hızla turlar (neon kenar).
    // Blok başlayınca açılır ve bitince son konumda kalır; başlamadan önce görsel olduğu gibi görünür.
    target: 'layer', category: 'emphasis', defaultEasing: 'linear', defaultDuration: 3,
    params: [
      { key: 'turns', default: 1, min: -10, max: 10, step: 0.05 },
      { key: 'count', default: 2, min: 1, max: 4, step: 1 },
      { key: 'width', default: 0.1, min: 0.01, max: 0.5, step: 0.01 },
      { key: 'floor', default: 0, min: 0, max: 1, step: 0.05 },
      { key: 'phase', default: 0, min: 0, max: 1, step: 0.05 },
      { key: 'radius', default: 0.5, min: 0, max: 0.5, step: 0.01 },
      { key: 'inset', default: 0, min: 0, max: 0.45, step: 0.01 },
    ],
    apply: (s, e, p, { turns, count, width, floor, phase, radius, inset }) => {
      if (p <= 0) return
      s.sweep = phase + e * turns
      s.sweepCount = Math.max(1, Math.round(count))
      s.sweepWidth = width
      s.sweepFloor = floor
      s.sweepRadius = radius
      s.sweepInset = inset
    },
  },
  typewriter: {
    target: 'layer', category: 'text', defaultEasing: 'linear', defaultDuration: 1.2,
    // trail: son yazılan harfler bu tonda belirip metnin rengine döner (0 = kapalı)
    params: [{ key: 'trail', default: 0, min: 0, max: 12, step: 1 }, { key: 'trailHue', default: 18, min: 0, max: 360, step: 1 }],
    apply: (s, e, p, { trail, trailHue }) => {
      s.textReveal = Math.min(s.textReveal, e)
      // iz yalnızca yazarken; bitince bütün metin kendi renginde
      if (trail > 0 && p > 0 && p < 1) {
        s.trail = trail
        s.trailHue = trailHue
      }
    },
  },
  caret: {
    // Yazı imleci: blok boyunca metnin sonunda "|" görünür; blink > 0 ise saniyede o kadar yanıp söner.
    target: 'layer', category: 'text', defaultEasing: 'linear', defaultDuration: 1.5,
    params: [{ key: 'blink', default: 1, min: 0, max: 4, step: 0.5 }],
    apply: (s, _e, p, { blink }, duration) => {
      if (p <= 0 || p >= 1) return
      s.caret = blink <= 0 || Math.floor(p * duration * blink * 2) % 2 === 0
    },
  },
  move: {
    // Anahtar kare gibi: bulunduğu yerden (öncekilerin bıraktığı yerden) hedefe gider ve orada kalır.
    target: 'layer', category: 'move', defaultEasing: 'ease-in-out', defaultDuration: 1,
    params: [
      { key: 'dx', default: 1, min: -20, max: 20, step: 0.1 },
      { key: 'dy', default: 0, min: -20, max: 20, step: 0.1 },
      { key: 'dz', default: 0, min: -20, max: 20, step: 0.1 },
      { key: 'rotate', default: 0, min: -720, max: 720, step: 5 },
      { key: 'rotX', default: 0, min: -720, max: 720, step: 5 },
      { key: 'rotY', default: 0, min: -720, max: 720, step: 5 },
      { key: 'scaleBy', default: 1, min: 0.05, max: 10, step: 0.05 },
      // rotY dönüşünün ekseni: katmanın merkezinden bu kadar yanda/önde (birim, ölçek 1 iken). Katman merkezinden değil
      // bu noktadan döner (ör. menteşesi merkezde olan kapalı katlanır telefon gövdesinin ortasından).
      { key: 'pivotX', default: 0, min: -10, max: 10, step: 0.05 },
      { key: 'pivotZ', default: 0, min: -10, max: 10, step: 0.05 },
    ],
    apply: (s, e, _p, { dx, dy, dz, rotate, rotX, rotY, scaleBy, pivotX, pivotZ }) => {
      s.x += dx * e
      s.y += dy * e
      s.z += dz * e
      s.rotZ += rotate * DEG * e
      s.rotX += rotX * DEG * e
      if (pivotX || pivotZ) {
        // eksen noktası yerinde kalsın: dönüşten önceki ve sonraki yeri arasındaki fark konuma eklenir
        const before = s.rotY
        const after = before + rotY * DEG * e
        const at = (angle: number) => [pivotX * Math.cos(angle) + pivotZ * Math.sin(angle), -pivotX * Math.sin(angle) + pivotZ * Math.cos(angle)]
        const [x0, z0] = at(before)
        const [x1, z1] = at(after)
        s.x += (x0 - x1) * s.scale
        s.z += (z0 - z1) * s.scale
      }
      s.rotY += rotY * DEG * e
      s.scale *= 1 + (scaleBy - 1) * e
    },
  },
  'word-reveal': {
    target: 'layer', category: 'text', defaultEasing: 'linear', defaultDuration: 1.2,
    apply: (s, e) => { s.wordReveal = Math.min(s.wordReveal, e) },
  },
  'wipe-in': {
    target: 'layer', category: 'text', defaultEasing: 'ease-out-expo', defaultDuration: 0.9,
    apply: (s, e) => { s.wipe = Math.min(s.wipe, e) },
  },
  'soft-reveal': {
    // Harfler soldan sağa, yumuşak bir kenarla belirir (sert kırpan wipe-in'in yumuşak hali).
    target: 'layer', category: 'text', defaultEasing: 'ease-out', defaultDuration: 0.6,
    params: [{ key: 'softness', default: 0.3, min: 0.02, max: 1, step: 0.02 }],
    apply: (s, e, _p, { softness }) => { s.softReveal = Math.min(s.softReveal, e); s.revealSoftness = softness },
  },
  'glow-sweep': {
    // Metnin üstünden soldan sağa geçen ışık dalgası: harfler önce beyaza yakın, sonra `glowHue` tonunda parlar ve
    // etraflarına yumuşak ışıma yayar; dalga geçince harfler yumuşakça kendi renklerine döner. Yalnızca blok sürerken.
    target: 'layer', category: 'text', defaultEasing: 'linear', defaultDuration: 0.8,
    params: [
      { key: 'glowHue', default: 160, min: 0, max: 360, step: 1 },
      { key: 'glowWidth', default: 1.9, min: 0, max: 4, step: 0.05 },
      { key: 'softness', default: 0.3, min: 0.02, max: 1, step: 0.02 },
      { key: 'halo', default: 1, min: 0, max: 2, step: 0.05 },
    ],
    apply: (s, e, p, { glowHue, glowWidth, softness, halo }) => {
      if (p <= 0 || p >= 1) return
      s.glow = e
      s.glowHue = glowHue
      s.glowWidth = glowWidth
      s.glowSoftness = softness
      s.glowHalo = halo
    },
  },
  'tracking-in': {
    target: 'layer', category: 'text', defaultEasing: 'ease-out-expo', defaultDuration: 1.2,
    params: [{ key: 'amount', default: 0.4, min: 0, max: 2, step: 0.05 }],
    apply: (s, e, _p, { amount }) => { s.letterSpacing += (1 - e) * amount; s.opacity *= Math.min(1, e * 1.5) },
  },
  'tracking-out': {
    // Harfler birbirinin içine sıkışarak kaybolur (tracking-in'in tersi); amount negatifse sola toplanır.
    // Son %15'te söner.
    target: 'layer', category: 'text', defaultEasing: 'ease-in', defaultDuration: 0.4,
    params: [{ key: 'amount', default: -0.5, min: -2, max: 2, step: 0.05 }],
    apply: (s, e, _p, { amount }) => { s.letterSpacing += e * amount; s.opacity *= Math.min(1, (1 - e) / 0.15) },
  },
  'count-up': {
    target: 'layer', category: 'text', defaultEasing: 'ease-out-expo', defaultDuration: 1.5,
    params: [{ key: 'from', default: 0, step: 1 }, { key: 'to', default: 100, step: 1 }, { key: 'decimals', default: 0, min: 0, max: 4, step: 1 }],
    apply: (s, e, _p, { from, to, decimals }) => {
      const f = 10 ** decimals
      s.numberValue = Math.round((from + (to - from) * e) * f) / f
    },
  },
  'camera-push': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.z -= e * distance },
  },
  'camera-pull': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [distance(2)],
    apply: (s, e, _p, { distance }) => { s.z += e * distance },
  },
  'camera-orbit': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 4,
    params: [{ key: 'angle', default: 25, min: -180, max: 180, step: 5 }],
    apply: (s, e, _p, { angle }) => {
      const a = e * angle * DEG
      const r = Math.hypot(s.x - s.targetX, s.z)
      s.x = s.targetX + Math.sin(a) * r
      s.z = Math.cos(a) * r
    },
  },
  'focus-pull': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 1.5,
    params: [
      { key: 'from', default: -3, min: -20, max: 10, step: 0.25 },
      { key: 'to', default: 0, min: -20, max: 10, step: 0.25 },
      { key: 'blur', default: 1, min: 0, max: 3, step: 0.1 },
    ],
    // blur: bu bloktan itibaren bulanıklık miktarı (0 = geniş planlarda her şey net)
    // Bloklar başlangıç sırasıyla çağrılır: başlamış bloklar sırayla uygulanır (sonuncusu geçerli).
    // Henüz başlamamış bir blok netliği değiştirmez; yalnızca hiçbir odak bloğu başlamadıysa ilk blok
    // başlangıç değerini tutar. (Eskiden sonraki blokların `from`'u her karede önceki çekimin odağını eziyordu.)
    apply: (s, e, p, { from, to, blur }) => {
      if (p > 0 || !s.focusSet) s.focusZ = from + (to - from) * e
      s.focusSet = true
      // bulanıklık blok başlayınca geçerli olur (öncesinde e=0 ile de çağrılıyoruz)
      if (p > 0) s.focusBlur = blur
    },
  },
  'fade-black': {
    // Geçiş: ortasında ekran tamamen kararır; iki sahnenin arasına koyulur.
    target: 'camera', category: 'transition', defaultEasing: 'ease-in-out', defaultDuration: 0.8,
    apply: (s, e) => {
      s.overlayOpacity = Math.max(s.overlayOpacity, 1 - Math.abs(2 * e - 1))
      s.overlayWhite = 0
    },
  },
  'fade-to-black': {
    // Kapanış: ekran blok boyunca kararır ve siyah kalır (videonun sonuna koyulur; fade-black ortasında kararıp
    // geri açıldığı için tam karanlık videonun dışında kalıyordu).
    target: 'camera', category: 'transition', defaultEasing: 'ease-in', defaultDuration: 0.6,
    apply: (s, e) => {
      if (e <= s.overlayOpacity) return
      s.overlayOpacity = Math.min(1, e)
      s.overlayWhite = 0
    },
  },
  'fade-white': {
    target: 'camera', category: 'transition', defaultEasing: 'ease-in-out', defaultDuration: 0.8,
    apply: (s, e) => {
      s.overlayOpacity = Math.max(s.overlayOpacity, 1 - Math.abs(2 * e - 1))
      s.overlayWhite = 1
    },
  },
  flash: {
    // Kısa beyaz parlama: hızla açılır, yavaşça söner.
    target: 'camera', category: 'transition', defaultEasing: 'linear', defaultDuration: 0.5,
    apply: (s, _e, p) => {
      if (p <= 0 || p >= 1) return
      const peak = 0.15
      s.overlayOpacity = Math.max(s.overlayOpacity, p < peak ? p / peak : 1 - (p - peak) / (1 - peak))
      s.overlayWhite = 1
    },
  },
  'camera-shake': {
    // El kamerası: kamera ve baktığı nokta küçük, düzensiz ama tekrarlanabilir biçimde sallanır.
    target: 'camera', category: 'camera', defaultEasing: 'linear', defaultDuration: 2,
    params: [
      { key: 'amount', default: 0.06, min: 0, max: 0.5, step: 0.01 },
      { key: 'speed', default: 1, min: 0.1, max: 4, step: 0.1 },
    ],
    apply: (s, _e, p, { amount, speed }, duration) => {
      if (p <= 0 || p >= 1) return
      const local = p * duration
      // baş ve sonda 0,2 sn'de yumuşakça başlayıp biter; kesme anında zıplama olmaz
      const a = amount * Math.min(1, local / 0.2, (duration - local) / 0.2)
      const dx = a * wobble(local * speed, 0)
      const dy = a * wobble(local * speed, 1)
      s.x += dx
      s.y += dy
      s.targetX += dx * 0.6
      s.targetY += dy * 0.6
    },
  },
  'lens-punch': {
    // Vuruş: kısa bir yakınlaşma ve kenarlarda renk kayması; kesme ya da ritim anına koyulur.
    target: 'camera', category: 'lens', defaultEasing: 'linear', defaultDuration: 0.4,
    params: [
      { key: 'amount', default: 1, min: 0, max: 3, step: 0.1 },
      { key: 'zoom', default: 0.06, min: 0, max: 0.3, step: 0.01 },
    ],
    apply: (s, _e, p, { amount, zoom }) => {
      if (p <= 0 || p >= 1) return
      const peak = 0.2
      const env = p < peak ? p / peak : (1 - (p - peak) / (1 - peak)) ** 2
      s.aberration += amount * env
      s.fov *= 1 - zoom * env
    },
  },
  'flare-sweep': {
    // Ekranı yatay geçen lens parlaması; ortasında en güçlü.
    target: 'camera', category: 'lens', defaultEasing: 'ease-in-out', defaultDuration: 1.5,
    params: [
      { key: 'from', default: -1.2, min: -2, max: 2, step: 0.05 },
      { key: 'to', default: 1.2, min: -2, max: 2, step: 0.05 },
      { key: 'y', default: 0.4, min: -1, max: 1, step: 0.05 },
      { key: 'intensity', default: 1.5, min: 0, max: 4, step: 0.1 },
    ],
    apply: (s, e, p, { from, to, y, intensity }) => {
      const k = bell(p)
      if (k <= 0) return
      s.flare = intensity * k
      s.flareX = from + (to - from) * e
      s.flareY = y
    },
  },
  'light-leak': {
    // Işık sızması patlaması: sıcak renkli ışık ekrana yayılıp söner; geçişlerde kullanılır.
    target: 'camera', category: 'lens', defaultEasing: 'linear', defaultDuration: 1.2,
    params: [{ key: 'intensity', default: 1.2, min: 0, max: 3, step: 0.1 }],
    apply: (s, _e, p, { intensity }) => { s.leak = Math.max(s.leak, intensity * bell(p)) },
  },
  'camera-move': {
    // Anahtar kare gibi: kamera (ve baktığı nokta) kayar, z=0 düzlemindeki görüntü `zoom` katına büyür.
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 1,
    params: [
      { key: 'dx', default: 0, min: -20, max: 20, step: 0.05 },
      { key: 'dy', default: 0, min: -20, max: 20, step: 0.05 },
      { key: 'zoom', default: 1, min: 0.1, max: 10, step: 0.01 },
    ],
    apply: (s, e, _p, { dx, dy, zoom }) => {
      s.x += dx * e
      s.y += dy * e
      s.targetX += dx * e
      s.targetY += dy * e
      s.z /= 1 + (zoom - 1) * e
    },
  },
  'camera-spin': {
    // camera-orbit gibi hedefin etrafında döner ama mevcut açının ÜSTÜNE ekler: art arda bloklar birikir
    // (silindir/atlıkarınca sahneleri için; camera-orbit her blokta açıyı sıfırdan verir).
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 3,
    params: [{ key: 'angle', default: 90, min: -720, max: 720, step: 5 }],
    apply: (s, e, _p, { angle }) => {
      const r = Math.hypot(s.x - s.targetX, s.z)
      const a = Math.atan2(s.x - s.targetX, s.z) + e * angle * DEG
      s.x = s.targetX + Math.sin(a) * r
      s.z = Math.cos(a) * r
    },
  },
  'camera-pan': {
    target: 'camera', category: 'camera', defaultEasing: 'ease-in-out', defaultDuration: 3,
    params: [distance(1.5)],
    apply: (s, e, _p, { distance }) => { s.x += e * distance; s.targetX += e * distance },
  },
}

/** Bloğun kayıtlı ayarlarını preset'in varsayılanlarıyla birleştirir. */
export function resolveParams(preset: Preset, params: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {}
  for (const spec of preset.params ?? []) out[spec.key] = params?.[spec.key] ?? spec.default
  return { ...out, ...params }
}

export function presetsFor(target: 'layer' | 'camera') {
  return Object.entries(PRESETS).filter(([, p]) => p.target === target)
}
