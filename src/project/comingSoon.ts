import { newId } from '../engine/ids'
import type { Block, CameraTrack, Layer, Project, Vec3 } from '../engine/types'
import { SOON_EM } from './comingSoonMetrics'

// "Coming soon": 4:5 (1080×1350, 60 kare/sn, 379 kare) yaylanan duyuru. Hareket dili ve zamanlaması 60 kare/sn'lik
// (2160×2972, 379 kare) bir referanstan kare kare ölçüldü: `F(n)` referansın 1'den başlayan karesini saniyeye çevirir
// (mikro saniye); ölçüler referansın 1080 px genişliğe indirilmiş karesinde (1080×1486, merkez y = 743), bizim kadrajda
// aynı yatay ölçüyle ortalanır. Kopya değil: metinler, simge, bildirim görseli ve renkler bizim.
// Sahneler (kesmeler 78, 167; 269'da kart çıkar):
//  1 nokta büyür, içinde mikrofon belirir, daire yaylanır (1–40) → hap biçimine açılır, genişliği ve eğimi yaylanır (41–77)
//  2 yakın plan (2.457 kat): kamera çubuğun solundan sağına savrulurken istem yazılır (78–166)
//  3 ince çizgi soldan gelir, bildirim kartına açılır; görsel ve yazılar yukarıdan düşüp yaylanır, kart hafifçe sallanır (173–268)
//  4 kart yukarı fırlar; iki kelime düşer ve tahterevalli gibi yaylanarak oturur (270–379)
// Motor yalnızca eşit ölçek bildiği için uzayıp kısalan biçimler parçalardan kurulur: hap = iki uç dairesi + üst üste
// kayan iki dikdörtgen (birleşimleri her uzunlukta kesintisiz), kart = dikey kayan iki yuvarlak köşeli levha (birleşimleri
// aynı köşeli, yüksekliği değişen kart). Parçaların konumu ölçülen eğrilerden kare kare `move` bloklarına çevrilir.
// Görseller ve yazı genişlikleri: node scripts/build-coming-soon-assets.mjs. Ses: dört efekt grubu
// (public/templates/coming-soon/sfx/*.mp3; Desktop/launch-ad-sfx projesindeki ComingSoon kompozisyonu). Konuşma ve müzik yok.

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
const H = 1350
/** referans karesinin (1080×1486) merkezi: ölçülen y değerleri buna göre ortalanır */
const CX = 540
const CY = 743
const U = (2 * 9 * Math.tan((20 * Math.PI) / 180)) / H
/** z derinliğindeki katmanın z = 0'daki gibi görünmesi için konum ve ölçek çarpanı (kamera z = 9) */
const depth = (z: number) => (9 - z) / 9
const P = (x: number, y: number, z = 0): Vec3 => [(x - CX) * U * depth(z), (CY - y) * U * depth(z), z]
/** referans karesi (60 kare/sn, 1'den başlar: 1. kare t = 0) → saniye; mikro saniyeye yuvarlanır */
const F = (n: number) => Math.round(((n - 1) / 60) * 1e6) / 1e6
/**
 * Tek anda olan değişikliklerin (belirme, kaybolma, kesmedeki sıçrama) zamanı: karenin bir kıl öncesi. `F` mikro saniyeye
 * yuvarlarken bazı kareleri (41, 167, 173, 176…) yukarı yuvarlar; tam o karede blok henüz başlamamış sayılıp katman bir kare
 * geç beliriyor, tek karelik katman hiç görünmüyordu.
 */
const AT = (n: number) => Math.max(0, F(n) - 2e-6)
/** kare sayısı → süre (sn) */
const DUR = (frames: number) => Math.round((frames / 60) * 1e6) / 1e6
const FRAMES = 379
const END = DUR(FRAMES)
const RAD = Math.PI / 180

// Renkler (hepsi katman rengi; editörden değişir)
const BG = '#FDFDFB'
const INK = '#000000'
const EDGE = '#6F6F6F'
const ICON = '#8E8E8E'
const TYPED = '#C2C2CB'
const CARET = '#D6D6D6'
const WHITE = '#FFFFFF'
const MUTED = '#B9B9C6'
const LEAF = '#46A83F'
const ORANGE = '#FF5A1F'
const GLOW = '#FF4530'
const TITLE_INK = '#0A0A0A'

type Key = [number, number]
/**
 * Ölçülen anahtar noktalardan (kare, değer) geçen düzgün eğri (Catmull-Rom). Seyrek noktalar arasında düz gitmek hız
 * sıçraması yaptığı için konumlar bu eğriden kare kare örneklenir. Uçların dışında ilk / son değerde kalır.
 */
function curve(keys: Key[]) {
  const slope = (j: number) => {
    const a = keys[Math.max(0, j - 1)]
    const c = keys[Math.min(keys.length - 1, j + 1)]
    return (c[1] - a[1]) / (c[0] - a[0])
  }
  return (f: number) => {
    if (f <= keys[0][0]) return keys[0][1]
    const last = keys[keys.length - 1]
    if (f >= last[0]) return last[1]
    let i = 0
    while (keys[i + 1][0] < f) i++
    const [f0, v0] = keys[i]
    const [f1, v1] = keys[i + 1]
    const h = f1 - f0
    const u = (f - f0) / h
    const m0 = slope(i) * h
    const m1 = slope(i + 1) * h
    return (2 * u ** 3 - 3 * u ** 2 + 1) * v0 + (u ** 3 - 2 * u ** 2 + u) * m0 + (-2 * u ** 3 + 3 * u ** 2) * v1 + (u ** 3 - u ** 2) * m1
  }
}

/** Katmanın o karedeki duruşu: konum (referans pikseli), dönüş (derece, saat yönü), ölçek çarpanı. */
interface Pose { x: number; y: number; rot?: number; s?: number }
/** Kesintisiz bir hareket parçası; parçalar arasında (kesmede) duruş tek anda değişir. */
interface Section { from: number; to: number; pose: (f: number) => Pose; step?: number }

// --- 1. sahne: nokta → daire → hap (ölçüler referans pikseli)
const BAR_H = 92
/** hapın gövdesini kuran iki dikdörtgenin boyu: en kısa gövdeden (358) kısa, iki katı en uzun gövdeden (667) uzun */
const BODY = 340
/** gri kenar çizgisinin kalınlığı */
const RIM = 2.3
const DOT = 89
const dotSize = curve([[1, 15], [3, 52], [5, 68], [6.5, 78], [8.5, 85], [10, 89], [11.5, 91], [13.5, 93], [15, 94], [16.5, 98], [18, 101], [19.5, 102], [21.5, 103], [23, 102.5], [24.5, 101], [26.5, 99], [28, 97], [29.5, 94.5], [31.5, 93], [33, 91], [34.5, 90], [36, 89.5], [37.5, 89], [41, 89]])
const dotX = curve([[1, 540], [20, 540.5], [30, 538.5], [37, 537.2], [41, 537.2]])
const dot = (f: number): Pose => ({ x: dotX(f), y: 737.2, s: dotSize(f) / DOT })
/** mikrofon dairenin içinde büyür (8–16) */
const micGrow = curve([[8, 0.1], [9, 0.2], [10, 0.5], [11, 0.78], [13, 0.93], [16, 1], [41, 1]])
const PILL = { x: 535, y: 736 }
const pillLength = curve([[42.5, 449.5], [44.5, 547], [46, 596], [47.5, 616.5], [49.5, 633.5], [51, 689], [52.5, 729], [54, 752], [55.5, 759], [57.5, 751], [59, 731], [60.5, 701], [62.5, 669.5], [64, 637.5], [65.5, 610.5], [67, 588], [68.5, 571], [70.5, 562], [72, 558.5], [73.5, 561], [75.5, 570], [77, 582]])
const pillTilt = curve([[42.5, -0.87], [44.5, -0.68], [46, -0.47], [47.5, -0.25], [49.5, -0.02], [51, 0.19], [52.5, 0.4], [54, 0.62], [55.5, 0.82], [57.5, 1.01], [59, 1.19], [60.5, 1.36], [62.5, 1.5], [64, 1.61], [65.5, 1.7], [67, 1.76], [68.5, 1.77], [70.5, 1.75], [72, 1.7], [73.5, 1.62], [75.5, 1.51], [77, 1.37]])
/** mikrofonun kadrajdaki x'i: ortada durur, sağ uca savrulur, daralan çubuğun ucundan taşar ve geri oturur */
const micX = curve([[42, 536], [46, 538], [47.5, 592], [49.5, 707], [51, 748], [52.5, 771], [54, 782], [55.5, 790], [57.5, 816], [59, 835], [60.5, 844], [62.5, 850], [64, 844], [65.5, 833], [67, 822], [68.5, 807], [70.5, 795], [72, 780], [73.5, 771], [75.5, 763], [77, 760]])
/** hapın ekseni üzerinde, merkezden `along` px ötedeki nokta (yakın planda çubuk düz ve 596 px: yaylanması bitmiş hali) */
const onPill = (f: number, along: (half: number) => number, close = false): Pose => {
  const tilt = close ? 0 : pillTilt(f)
  const half = ((close ? CLOSE_LENGTH : pillLength(f)) - BAR_H) / 2
  const d = along(half)
  return { x: PILL.x + d * Math.cos(tilt * RAD), y: PILL.y + d * Math.sin(tilt * RAD), rot: tilt }
}

// --- 2. sahne: yakın plan
const ZOOM = 2.457
const CLOSE_LENGTH = 596
const BAR_LEFT = PILL.x - CLOSE_LENGTH / 2
/** çubuğun sol ucunun yakın plandaki ekran x'i (ölçüldü; 104'ten sonra sağ uçtan, çubuk 1464 px): kamera bunu izler */
const barLeft = curve([[78, 204], [80, 187], [82, 172], [83.5, 159], [85, 149], [86.5, 142], [88.5, 138], [90.5, 136], [95, 136], [96.5, 134], [98.5, 129], [100, 118], [101.5, 100], [103, 69], [104.5, -110], [106.5, -268], [108, -311], [109.5, -343], [111.5, -360], [113, -374], [114.5, -381], [116.5, -388], [118, -390], [119.5, -393], [121, -397], [122.5, -400], [124.5, -403], [126, -405], [127.5, -407], [129.5, -409], [131, -410], [132.5, -411], [134, -412], [137.5, -413], [140, -412], [144, -411], [150, -409], [157, -409], [160, -410], [166, -410]])
/** kameranın baktığı x (referans pikseli) */
const camX = (f: number) => BAR_LEFT + (CX - barLeft(f)) / ZOOM
/** yakın planda çubuğun ekran y'si 727.5 */
const CAM_Y = PILL.y + (CY - 727.5) / ZOOM
/** yazı boyu (px, uzak planın ölçeğinde) ve çubuğun sol ucundan yazının başına uzaklık */
const TYPE_SIZE = 99 / ZOOM
const TYPE_LEFT = 150 / ZOOM
const MIC_FROM_RIGHT = 157 / ZOOM

// --- 3. sahne: bildirim kartı (genişlik 781; yükseklik yaylanır)
const CARD_W = 781
/** kartı kuran iki levhanın yüksekliği: aralarındaki kayma kartın yüksekliğini 176–281 px arasında değiştirir (ölçülen en kısa hali 176) */
const SLAB = 176
const cardX = curve([[176, 570.5], [178, 571.6], [181, 575.4], [186, 576.3], [191, 571.5], [196, 568.4], [201, 566.7], [206, 567.3], [211, 569.1], [216, 571.7], [221, 573.8], [226, 574.9], [231, 575.3], [236, 575.1], [241, 574.5], [246, 573.8], [251, 573.2], [256, 573.3], [261, 574], [264, 574.3]])
const cardY = curve([[176, 768.2], [178, 768.8], [180, 770.5], [181.5, 772.6], [185, 772.5], [186.5, 771.7], [188, 771.1], [189.5, 769.7], [191.5, 768.4], [193, 767.1], [194.5, 765.9], [196.5, 764.9], [198, 764], [199.5, 763.2], [201, 762.6], [202.5, 762.1], [204.5, 761.7], [206, 761.4], [209, 761.1], [213, 761.2], [216, 761.6], [221, 762.1], [224, 762.7], [227, 763.8], [230, 764.9], [234, 766], [238, 766.9], [241, 767], [245, 766.4], [250, 765.7], [255, 765.5], [260, 766.1], [264, 766.3]])
const cardTilt = curve([[176, 0.77], [178, 0.75], [180, 0.67], [181.5, 0.27], [183.5, 0.17], [186, 0.11], [188, 0.2], [191.5, 0.12], [193, 0.06], [194.5, -0.05], [196.5, -0.1], [198, -0.23], [199.5, -0.38], [201, -0.49], [202.5, -0.6], [204.5, -0.68], [206, -0.75], [207.5, -0.81], [209.5, -0.84], [211, -0.84], [212.5, -0.81], [214.5, -0.74], [216, -0.64], [217.5, -0.49], [219, -0.31], [220.5, -0.1], [222.5, 0.06], [224, 0.26], [225.5, 0.44], [227.5, 0.59], [229, 0.75], [230.5, 0.88], [232.5, 1], [234, 1.08], [235.5, 1.15], [237, 1.19], [238.5, 1.21], [240.5, 1.21], [242, 1.19], [243.5, 1.14], [245.5, 1.07], [247, 0.99], [248.5, 0.89], [250, 0.79], [251.5, 0.66], [253.5, 0.53], [255, 0.39], [256.5, 0.26], [258.5, 0.12], [260, -0.02], [261.5, -0.14], [263.5, -0.22], [265, -0.34], [266.5, -0.44]])
const cardWidth = curve([[176, 719], [178, 776], [180, 789], [181.5, 794], [183.5, 796], [185, 798], [186.5, 799], [188, 798], [189.5, 796], [191.5, 793], [193, 791], [194.5, 787], [196.5, 785], [198, 783], [199.5, 781], [201, 780], [204, 780]])
const cardHeight = curve([[176, 112], [178, 167], [180, 185], [181.5, 192], [183.5, 200.6], [185, 206], [186.5, 209], [188, 209], [189.5, 208], [191.5, 205], [193, 200.6], [194.5, 195.5], [196.5, 190], [198, 185], [199.5, 181], [201, 178], [202.5, 176.7], [204.5, 176.4], [206, 177], [207.5, 178.5], [209.5, 180.3], [211, 182.3], [212.5, 184.4], [214.5, 186.3], [216, 188], [217.5, 189.3], [219.5, 190.2], [222, 190.7], [224, 190.5], [225.5, 190], [227.5, 189.3], [229, 188.5], [230.5, 187.7], [232.5, 187], [234, 186.3], [235.5, 185.8], [237, 185.5], [239.5, 185.2], [241.5, 185.2], [243.5, 185.5], [245.5, 185.8], [247, 186.2], [250, 186.8], [253, 187.2], [256, 187.4], [258.5, 187.3], [260, 186.9], [264, 187.1]])
/** çıkış: kart yukarı fırlar (265–268) ve sönerken yükselmeyi sürdürür (hareket bulanıklığı kaybolmasın) */
const cardExit = curve([[264, 0], [265, -7.7], [266, -110], [267, -150], [268, -175], [270, -200]])
/** kartın içindeki nokta (merkeze göre px; kart eğimi ve genişlik ölçeğiyle birlikte) */
const inCard = (f: number, rx: number, ry: number, own = 1): Pose => {
  const tilt = cardTilt(f)
  const s = cardWidth(f) / CARD_W
  const x = rx * s
  const c = Math.cos(tilt * RAD)
  const n = Math.sin(tilt * RAD)
  return { x: cardX(f) + x * c - ry * n, y: cardY(f) + cardExit(f) + x * n + ry * c, rot: tilt, s: s * own }
}
/** levhaların kart merkezinden dikey uzaklığı (px): ölçek uygulanmış yükseklik ölçülen yüksekliğe eşit olsun */
const slabShift = (f: number) => {
  const s = cardWidth(f) / CARD_W
  return (s * Math.min(SLAB - 2 * SLAB * 0.2, Math.max(0, cardHeight(f) / s - SLAB))) / 2
}
// kartın içi (merkeze göre px; yazılar satır ortasına göre)
const AVATAR = 80
const RING = 87
const avatarX = curve([[176, -290], [178, -293.6], [180, -297], [183, -309], [187, -310], [189, -303.6], [191, -300], [193, -297], [195, -293.5], [197, -290.4], [199, -287], [205, -287]])
const avatarY = curve([[176, -9], [178, -14], [180, -18], [183, -35], [185, -36], [187, -40], [189, -32], [191, -26], [193, -19], [195, -13.5], [197, -8], [199, 0], [205, 0]])
const avatarPop = curve([[176, 1], [178, 1.1], [180, 1.2], [183, 1.45], [185, 1.55], [187, 1.55], [189, 1.45], [191, 1.35], [193, 1.25], [195, 1.2], [197, 1.1], [199, 1], [203, 0.97], [210, 1]])
const TEXT_LEFT = -216
const TITLE_SIZE = 35
const BODY_SIZE = 33
const TIME_SIZE = 30.5
const TIME_RIGHT = 305
/** başlık: yukarıdan düşer, yerinin altına taşar, yavaşça yerine çıkar */
const titleY = curve([[180, -95], [181.5, -94], [183.5, -68], [185, -50], [186.5, -34], [188, -21], [189.5, -11], [191.5, -5], [195, -2], [199, -2], [203, -16], [207, -21], [211, -25], [215, -29], [221, -30], [230, -28], [240, -28]])
/** alt satır: kelimeler art arda (kelime başına 0.75 kare) düşer, birlikte yerine çıkar */
const BODY_FALL: Key[] = [[180, -82], [184, -82], [185, -76], [186.5, -55], [188, -23], [189.5, -8], [191.5, 12], [193, 23.5], [194.5, 35], [196.5, 42], [198, 45]]
const BODY_RISE: Key[] = [[200.5, 46], [203, 45], [207, 42], [209, 39], [211, 35], [213, 32], [215, 29], [217, 24], [219, 21], [221, 18], [226, 18]]
const wordY = (i: number) => curve([...BODY_FALL.map(([f, v]): Key => [f + (f > 180 ? Math.min(0.75 * i, 2.3) : 0), v]), ...BODY_RISE])
/** saat: önce rakamlar, 5 kare sonra ek; aşağı taşar, yukarı taşar, yerine iner */
const clockY = curve([[183, -104], [185, -82], [186.5, -57], [188, -35], [189.5, -13], [191.5, 5], [193, 19], [194.5, 29], [196.5, 34], [198, 37], [199.5, 34], [201, 30], [202.5, 24], [204, 20], [205.5, 14], [207, -3], [209, -13], [211, -20], [213, -31], [215, -37], [217, -43], [219, -46], [223, -45], [227, -43], [231, -38], [235, -32], [239, -27], [243, -25], [250, -25]])
const suffixY = curve([[188, -88], [189.5, -66], [191.5, -41], [193, -19], [194.5, 1], [196.5, 15], [198, 27], [199.5, 36], [202, 35], [204.5, 31], [207, 21], [209, 10.5], [211, 1], [213, -10.5], [215, -21], [217, -34], [219, -42], [221, -45], [223, -46], [227, -45], [231, -39], [235, -32], [239, -27], [243, -25], [250, -25]])
/** soldan gelen ince çizgi (173–175; 175'te kadrajın ortasında: x = 568, y = 768) */
const lineX = curve([[172, -700], [173, 200], [174, 440], [176, 696]])
const lineY = curve([[172, 815], [173, 800], [174, 785], [176, 751]])

// --- 4. sahne: kapanış (Inter 600, 67.5 px; ölçülen satır ortası y = 704.6, iki kelimenin ortası x = 531)
const WORD_SIZE = 67.5
const WORD_Y = 704.6
const WORDS_CX = 531.2
/** iki kelimenin yerlerine göre düşey kayması (px): önce ilki düşer, ikincisi gelince birlikte tahterevalli gibi yaylanırlar */
const firstY = curve([[269.5, -190], [271.5, -107.5], [273, -46.5], [274.5, -19], [276.5, -4.4], [278, 2.4], [279.5, 8.5], [281.5, 25], [283, 37], [284.5, 44], [286, 46], [287.5, 43.7], [289.5, 37.7], [291, 29.3], [292.5, 19.7], [294.5, 10], [296, 1.2], [297.5, -6], [299.5, -11.3], [301, -14.6], [302.5, -15.6], [304, -15], [305.5, -12.7], [307.5, -9.8], [309, -6.5], [310.5, -3], [312.5, 0], [314, 2.4], [315.5, 4], [317, 4.7], [318.5, 4.5], [320.5, 3.5], [322, 2.2], [323.5, 0.3], [325.5, -1.6], [327, -3.2], [328.5, -4.7], [330.5, -5.6], [332, -6], [335, -5.5], [336.5, -4.6], [338.5, -3.3], [340, -1.9], [341.5, -0.7], [343.5, 0.5], [345, 1.6], [346.5, 2.4], [348.5, 3], [350, 3.3], [352, 3.4], [354.5, 3.2], [356.5, 2.8], [358, 2.4], [359.5, 1.9], [361.5, 1.5], [363, 1], [364.5, 0.7], [366.5, 0.4], [368, 0.3], [372, 0], [380, 0]])
const secondY = curve([[277, -180], [278, -107.5], [279.5, -49.6], [281.5, -22.5], [283, -8.3], [284.5, -1.9], [286, 4.3], [287.5, 21], [289.5, 33], [291, 40.3], [292.5, 42.4], [294.5, 40.5], [296, 34.8], [297.5, 27], [299.5, 18], [301, 8.8], [302.5, 0.4], [304, -6.6], [305.5, -11.5], [307.5, -14.5], [309, -15.2], [310.5, -14.1], [312.5, -11.7], [314, -8.2], [315.5, -4.1], [317, 0], [318.5, 3.5], [320.5, 6.3], [322, 8.2], [323.5, 9.2], [325.5, 9.5], [327, 8.7], [328.5, 7.5], [330.5, 5.7], [332, 3.9], [333.5, 2], [335, 0.4], [336.5, -1], [338.5, -2.2], [340, -3], [341.5, -3.5], [343.5, -3.8], [345, -4.1], [348, -3.6], [352, -2.8], [356, -2], [360, -1.2], [364, -0.6], [368, -0.2], [372, 0], [380, 0]])

/** kelimenin ilerleme genişliği (em): 0 = Inter 400, 1 = Inter 500, 2 = Inter 600 */
const em = (word: string, weight: 0 | 1 | 2) => SOON_EM[word]?.[weight] ?? word.length * 0.56
const SPACE = (weight: 0 | 1 | 2) => SOON_EM[' '][weight]
/** troika satır kutusunun ortasını hizalar; büyük harflerin ortası bu kadar (em) yukarıda kalır (render'dan ölçüldü) */
const TEXT_DROP = 0.18

export function buildComingSoon({ t, b, layer, camera, project }: Kit): Project {
  const base = import.meta.env.BASE_URL
  const file = (name: string) => `${base}templates/coming-soon/${name}`
  const k = (key: string) => t(`templates.coming-soon.${key}`)

  const cut = (from: number, to: number) => [b('fade-in', AT(from), 0), b('fade-out', AT(to), 0)]

  /** Duruşları kare kare `move` bloklarına çevirir; parçalar arasındaki geçiş tek anda (0 sn) olur: kesmede iki çekim karışmaz. */
  const poseBlocks = (sections: Section[], scale: number): BlockSpec[] => {
    const out: BlockSpec[] = []
    const delta = (p: Pose, q: Pose) => ({ dx: (q.x - p.x) * U * scale, dy: -(q.y - p.y) * U * scale, rotate: -((q.rot ?? 0) - (p.rot ?? 0)), scaleBy: (q.s ?? 1) / (p.s ?? 1) })
    const still = (d: ReturnType<typeof delta>) => Math.abs(d.dx) < 1e-7 && Math.abs(d.dy) < 1e-7 && Math.abs(d.rotate) < 1e-6 && Math.abs(d.scaleBy - 1) < 1e-7
    sections.forEach((section, i) => {
      if (i > 0) {
        const prev = sections[i - 1]
        const jump = delta(prev.pose(prev.to), section.pose(section.from))
        if (!still(jump)) out.push(b('move', AT(section.from), 0, { params: jump }))
      }
      const step = section.step ?? 1
      const closing = i === sections.length - 1
      for (let f = section.from; f < section.to - 1e-9; ) {
        let g = Math.min(section.to, f + step)
        // Son parçada bitişten bir önceki kare sınırı atlanır (son iki kare tek blok): `fitClip` klibi, katmanın göründüğü
        // son karede biten ilk blokta bitiriyor; o sınırda biten bir hareket bloğu son kareyi gizliyordu.
        if (closing && Math.abs(g - (section.to - 1)) < 1e-9) g = section.to
        const d = delta(section.pose(f), section.pose(g))
        if (!still(d)) out.push(b('move', F(f), DUR(g - f), { params: d, easing: 'linear' }))
        f = g
      }
    })
    return out
  }
  /** ilk duruşunda yerleştirilmiş, duruşlarını izleyen katman; `size` katmanın ölçek 1'deki çarpanı */
  const placed = (spec: Omit<LayerSpec, 'position' | 'blocks'>, z: number, sections: Section[], extra: BlockSpec[] = [], size = 1) => {
    const first = sections[0].pose(sections[0].from)
    const last = sections[sections.length - 1]
    return layer({
      ...spec,
      position: P(first.x, first.y, z),
      rotation: [0, 0, -(first.rot ?? 0)],
      scale: size * depth(z) * (first.s ?? 1),
      blocks: [...cut(sections[0].from, last.to), ...poseBlocks(sections, depth(z)), ...extra],
    })
  }
  const shape = (name: string, kind: 'rect' | 'rounded' | 'circle', w: number, h: number, color: string, z: number, sections: Section[], extra: BlockSpec[] = []) =>
    placed({ name, kind: 'shape', shape: kind, shapeWidth: w * U, shapeHeight: h * U, color }, z, sections, extra)
  /** görsel 3 birim genişliğinde çizilir: kadrajdaki genişliği (px) ölçekle verilir */
  const image = (name: string, src: string, widthPx: number, z: number, sections: Section[], extra: BlockSpec[] = [], more: Partial<LayerSpec> = {}) =>
    placed({ name, kind: 'image', color: WHITE, image: src, ...more }, z, sections, extra, (widthPx * U) / 3)
  /** yazı: Inter 400 / 500 / 600 (`inter-medium` ailesinde normal = 500, kalın = 600); duruş satırın sol ucu ve büyük harf ortası */
  const text = (name: string, value: string, size: number, weight: 400 | 500 | 600, color: string, z: number, sections: Section[], extra: BlockSpec[] = []) =>
    placed(
      { name, kind: 'text', text: value, fontFamily: weight === 400 ? 'inter' : 'inter-medium', fontWeight: weight === 600 ? 700 : 400, fontSize: size * U, textWidth: 40, align: 'left', color },
      z,
      sections.map((section) => ({ ...section, pose: (f: number) => { const p = section.pose(f); return { ...p, y: p.y + TEXT_DROP * size * (p.s ?? 1) } } })),
      extra,
    )

  const layers: Layer[] = []
  /** sona eklenen katman listede arkada kalır: önce öndekiler eklenir */
  const add = (...items: Layer[]) => layers.push(...items)

  // ---------------------------------------------------------------- 4) kapanış: iki kelime (270–379)
  {
    const first = k('word1')
    const second = k('word2')
    const total = (em(first, 2) + SPACE(2) + em(second, 2)) * WORD_SIZE
    const left = WORDS_CX - total / 2
    const secondLeft = left + (em(first, 2) + SPACE(2)) * WORD_SIZE
    const secondWidth = em(second, 2) * WORD_SIZE
    // düşüş kare kare, yaylanma 2 karede bir, sönümlenen son salınımlar 4 karede bir (blok sayısı az kalsın)
    const fall = (x: number, y: (f: number) => number, from: number): Section[] => {
      const pose = (f: number) => ({ x, y: WORD_Y + y(f) })
      return [{ from, to: 292, pose }, { from: 292, to: 332, step: 2, pose }, { from: 332, to: FRAMES + 1, step: 4, pose }]
    }
    add(text(k('word1Name'), first, WORD_SIZE, 600, TITLE_INK, 0.02, fall(left, firstY, 270.5), [b('fade-in', F(270.5), DUR(1), { easing: 'linear' })]))
    add(text(k('word2Name'), second, WORD_SIZE, 600, ORANGE, 0.02, fall(secondLeft, secondY, 277.5), [b('fade-in', F(277.5), DUR(1), { easing: 'linear' })]))
    // renkli kelimenin arkasındaki ışık lekesi: kelimeyle birlikte düşer; genişliği kelimeye göre (görseldeki kutu 340 px)
    const glowWidth = (640 * (secondWidth + 24)) / 340
    add(image(k('glow'), file('glow.png'), glowWidth, 0.01, fall(secondLeft + secondWidth / 2, (f) => secondY(f) + 2, 277.5), [b('fade-in', F(277.5), DUR(3), { easing: 'linear' })], { tint: true, color: GLOW, opacity: 0.6 }))
  }

  // ---------------------------------------------------------------- 3) bildirim kartı (173–269)
  {
    const FROM = 176
    const TO = 270
    /** kartla birlikte: açılış ve düşüş 2 karede bir, yerine oturma 3, sallanma 6 karede bir; çıkış kare kare */
    const ride = (pose: (f: number) => Pose, from = FROM): Section[] => [
      { from, to: 202, step: 2, pose },
      { from: 202, to: 226, step: 3, pose },
      { from: 226, to: 262, step: 6, pose },
      { from: 262, to: TO, pose },
    ]
    const leave = [b('fade-out', F(266.5), DUR(3), { easing: 'linear' })]
    const sender = k('sender')
    const words = k('message').split(' ')
    const clock = k('time').split(' ')

    add(text(k('senderName'), sender, TITLE_SIZE, 600, WHITE, 0.03, ride((f) => inCard(f, TEXT_LEFT, titleY(f)), 181), leave))
    let x = TEXT_LEFT
    words.forEach((word, i) => {
      const y = wordY(i)
      const at = x
      add(text(`${k('messageName')} ${i + 1}`, word, BODY_SIZE, 400, MUTED, 0.03, ride((f) => inCard(f, at, y(f)), 180), leave))
      x += (em(word, 0) + SPACE(0)) * BODY_SIZE
    })
    const clockWidth = clock.reduce((sum, part) => sum + em(part, 0) * TIME_SIZE, 0) + (clock.length - 1) * SPACE(0) * TIME_SIZE
    let cx = TIME_RIGHT - clockWidth
    clock.forEach((part, i) => {
      const y = i === 0 ? clockY : suffixY
      const at = cx
      add(text(`${k('timeName')} ${i + 1}`, part, TIME_SIZE, 400, MUTED, 0.03, ride((f) => inCard(f, at, y(f)), i === 0 ? 183 : 188), leave))
      cx += (em(part, 0) + SPACE(0)) * TIME_SIZE
    })
    // yuvarlak görsel ve halkası: kartla birlikte büyür, taşar (1.55 kat) ve yerine oturur
    const avatar = (f: number) => inCard(f, avatarX(f), avatarY(f), avatarPop(f))
    add(image(k('avatar'), file('avatar.png'), AVATAR, 0.03, ride(avatar), leave))
    add(shape(k('ring'), 'circle', RING, RING, LEAF, 0.02, ride(avatar), leave))
    // kart: dikey kayan iki levha (birleşimleri tek kart)
    add(shape(`${k('card')} 1`, 'rounded', CARD_W, SLAB, INK, 0.01, ride((f) => inCard(f, 0, -slabShift(f))), leave))
    add(shape(`${k('card')} 2`, 'rounded', CARD_W, SLAB, INK, 0.01, ride((f) => inCard(f, 0, slabShift(f))), leave))
    // ince çizgi: soldan hızla gelir (hareket bulanıklığıyla iz bırakır), 176'da karta dönüşür
    const LINE = { w: 589, h: 44 }
    const line = (dx: number): Section[] => [{ from: 173, to: 176, pose: (f) => ({ x: lineX(f) + dx, y: lineY(f) + dx * Math.sin(0.7 * RAD), rot: 0.7 }) }]
    add(shape(`${k('line')} 1`, 'circle', LINE.h, LINE.h, INK, 0.01, line(-(LINE.w - LINE.h) / 2)))
    add(shape(`${k('line')} 2`, 'circle', LINE.h, LINE.h, INK, 0.01, line((LINE.w - LINE.h) / 2)))
    add(shape(k('line'), 'rect', LINE.w - LINE.h, LINE.h, INK, 0.01, line(0)))
  }

  // ---------------------------------------------------------------- 1–2) nokta → hap → yakın planda yazı (1–166)
  {
    const prompt = k('prompt')
    // yazı: 96'da ilk harf, sonra her 2 karede bir harf (referanstaki tempo ~1.75–2.2 kare); imleç 90'dan itibaren.
    // Harfler tam kare sınırında belirir: kare ortasında belirince hareket bulanıklığı o karede soluk bir ikinci imleç çiziyordu.
    const n = Math.max(1, prompt.length)
    const typeFrames = 2 * n
    const typeStart = 95
    // uzun istem mikrofona binmesin: yazı, başlangıcı ile mikrofon arasındaki boşluğa (imleç payıyla) sığacak kadar küçülür
    const promptEm = prompt.split(' ').reduce((sum, word) => sum + em(word, 1), 0) + (prompt.split(' ').length - 1) * SPACE(1)
    const typeSize = Math.min(TYPE_SIZE, (CLOSE_LENGTH - TYPE_LEFT - MIC_FROM_RIGHT - 64 / 2 - 12) / promptEm)
    add(
      text(k('promptName'), prompt, typeSize, 500, TYPED, 0.02, [{ from: 90, to: 167, pose: () => ({ x: BAR_LEFT + TYPE_LEFT, y: PILL.y - 3.4 }) }], [
        b('caret', F(90), DUR(77), { params: { blink: 0 } }),
        b('typewriter', F(typeStart) - 1e-4, DUR(typeFrames), { easing: 'linear' }),
      ]),
    )
    // imleç (uzak plan): çubuk büyürken yerinde durur, 65'te söner
    add(shape(t('layerNames.caret'), 'rect', 2.6, 34, CARET, 0.02, [{ from: 44, to: 65, step: 3, pose: (f) => onPill(f, () => 293 - PILL.x) }]))
    // mikrofon: dairede büyür, hapın ortasından sağ ucuna savrulur; yakın planda sağ uçta
    const micWide = (f: number) => {
      const tilt = pillTilt(f)
      const d = micX(f) - PILL.x
      return { x: micX(f), y: PILL.y + d * Math.tan(tilt * RAD), rot: tilt }
    }
    add(
      image(k('mic'), file('mic.png'), 64, 0.02, [
        { from: 8, to: 41, step: 2, pose: (f) => ({ ...dot(f), s: (dotSize(f) / DOT) * micGrow(f) }) },
        { from: 41, to: 42, pose: () => ({ x: 537.2, y: 737.5, rot: -0.89, s: 1.04 }) },
        { from: 42, to: 78, step: 2, pose: micWide },
        { from: 78, to: 167, pose: () => ({ x: BAR_LEFT + CLOSE_LENGTH - MIC_FROM_RIGHT, y: PILL.y }) },
      ], [], { tint: true, color: ICON }),
    )
    // hap: iki uç dairesi + iki gövde dikdörtgeni; her parçanın arkasında biraz büyük gri kenar parçası
    const parts: { name: string; kind: 'circle' | 'rect'; w: number; along: (half: number) => number }[] = [
      { name: k('capLeft'), kind: 'circle', w: BAR_H, along: (half) => -half },
      { name: k('capRight'), kind: 'circle', w: BAR_H, along: (half) => half },
      { name: `${k('bar')} 1`, kind: 'rect', w: BODY, along: (half) => -half + BODY / 2 },
      { name: `${k('bar')} 2`, kind: 'rect', w: BODY, along: (half) => half - BODY / 2 },
    ]
    const pillSections = (along: (half: number) => number): Section[] => [
      { from: 42, to: 78, step: 2, pose: (f) => onPill(f, along) },
      { from: 78, to: 167, pose: (f) => onPill(f, along, true) },
    ]
    for (const part of parts) add(shape(part.name, part.kind, part.w, BAR_H, INK, 0.01, pillSections(part.along)))
    // 41: daire köşeli kutuya döner (tek kare), 42'de hap olur
    const square: Section[] = [{ from: 41, to: 42, pose: () => ({ x: 537.2, y: 737.5, rot: -0.89 }) }]
    add(shape(k('square'), 'rounded', 110, 94, INK, 0.01, square))
    add(shape(k('dot'), 'circle', DOT, DOT, INK, 0.01, [{ from: 1, to: 41, step: 2, pose: dot }]))
    for (const part of parts) {
      const grow = part.kind === 'circle' ? 2 * RIM : 0
      add(shape(`${part.name} · ${k('edge')}`, part.kind, part.w + grow, BAR_H + 2 * RIM, EDGE, 0, pillSections(part.along)))
    }
    add(shape(`${k('square')} · ${k('edge')}`, 'rounded', 110 + 2 * RIM, 94 + 2 * RIM, EDGE, 0, square))
    add(shape(`${k('dot')} · ${k('edge')}`, 'circle', DOT + 2 * RIM, DOT + 2 * RIM, EDGE, 0, [{ from: 1, to: 41, step: 2, pose: dot }]))
  }

  // ---------------------------------------------------------------- kamera: 78'de yakın plana keser, çubuğu izler, 167'de geri döner
  const camBlocks: BlockSpec[] = [b('camera-move', AT(78), 0, { params: { dx: (camX(78) - CX) * U, dy: (CY - CAM_Y) * U, zoom: ZOOM } })]
  for (let f = 78; f < 166; f++) {
    const dx = (camX(f + 1) - camX(f)) * U
    if (Math.abs(dx) > 1e-7) camBlocks.push(b('camera-move', F(f), DUR(1), { params: { dx, dy: 0, zoom: 1 }, easing: 'linear' }))
  }
  camBlocks.push(b('camera-move', AT(167), 0, { params: { dx: -(camX(166) - CX) * U, dy: -(CY - CAM_Y) * U, zoom: 1 / ZOOM } }))

  // Ses efektleri: her grup videonun tamamı boyunca süren ayrı bir parça; seviyesi zaman çizelgesinden ayrı ayarlanır.
  // Olaylar videodaki karelerle eşli olduğu için parçalar 0'dan başlar; kaydırılırsa eşleme bozulur.
  const sfx = (['air', 'ui', 'hit', 'tone'] as const).map((group) => ({
    id: newId('au'), name: k(`sfx.${group}`), asset: file(`sfx/${group}.mp3`),
    start: 0, offset: 0, duration: END, sourceDuration: END, volume: 1, fadeIn: 0, fadeOut: 0,
  }))

  return {
    ...project(k('name'), END, BG, layers, camera(camBlocks)),
    audio: sfx,
    width: W,
    height: H,
    fps: 60,
    effects: {
      dof: { enabled: false, bokeh: 5, range: 1.4 },
      bloom: { enabled: false, intensity: 0.35, threshold: 0.9 },
      vignette: { enabled: false, darkness: 0.35 },
      // referansta her hızlı harekette (savrulan kamera, düşen kelimeler, fırlayan kart) belirgin hareket bulanıklığı var
      motionBlur: { enabled: true, samples: 16, shutter: 0.7 },
    },
  }
}
