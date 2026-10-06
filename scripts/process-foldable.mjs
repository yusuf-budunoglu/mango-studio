// Katlanır telefon modelini uygulamaya hazırlar: models-src/foldable.glb → public/models/foldable.glb
//   node scripts/process-foldable.mjs
// Kaynak iskeletli bir model: gövdenin iki yarısı ve menteşe kemiklere bağlı, iç ekran tek parça ve menteşede kemik
// ağırlıklarıyla bükülüyor, 2 sn'lik bir aç-kapa animasyonu var. Betik yapıyı korur, uygulamanın sözleşmesine uydurur:
// - Logo çıkarılır; düğüm, malzeme ve doku adlarında marka adı kalmaz.
// - Ölçü: açıkken yükseklik 3.5 birim, iç ekran +z'ye bakar, menteşe y ekseninde ve x = 0'da, model ortalı.
// - `fold` düğümü menteşe ekseninde durur: uygulama onu ters yönde yarım açı kadar çevirir, böylece iki yarı
//   simetrik kapanır ve sırt yerinde kalır (kaynakta sağ yarı sabit, sol yarı 180° dönüyor).
// - Animasyon `fold` adıyla, açıya göre doğrusal yeniden örneklenir: zaman 0 = açık, 1 = kapalı (kaynakta yumuşatılmış).
// - İç ekran `screen` (0..1 doku koordinatı, üst kenar v=1), dış ekran `cover` (arkadan bakışa göre 0..1).
// - Gövde malzemeleri `finish:frame*` / `finish:back*`: rengi uygulamadan değişir; `extras.tone` o parçanın ana
//   renge oranıdır (anten şeridi, vidalar, mat sırt gibi parçalar ana renkle aynı tonda kalmaz).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, getBounds, meshopt, prune } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import fs from 'node:fs'

const SRC = 'models-src/foldable.glb'
const OUT = 'public/models/foldable.glb'
/** Açıkken yükseklik (sahne birimi): telefon maketiyle aynı */
const HEIGHT = 3.5
const LOGO_NODE = /logo/i
const SCREEN_NODE = 'Front_Screen'
const COVER_NODE = 'Back_Screen'
const HINGE_BONE = 'Bone_Hinge'
const BACK_INNER_NODE = 'Back_Panel_02'
const BACK_PANEL_NODE = 'Back_Panel_01'
/** Logo oyuğunu kapatan yamanın logo sınırından taşma payı ve arka yüzeyden içeri payı (metre) */
const LOGO_MARGIN = 0.0012
const LOGO_PATCH_INSET = 0.00005
/** İç ekranın çerçeve camının önüne alınma payı (kaynak birimi, metre): 0.15 mm (çerçeve camının menteşe yanındaki şeridi ekrandan 0.1 mm yüksekte) */
const SCREEN_LIFT = Number(process.env.SCREEN_LIFT ?? 0.00015)
/** Bir köşe bir kenara bundan yakınsa (metre) o kenarın üstünde sayılır */
const T_TOLERANCE = 2e-5
/** Yeniden örneklenen animasyondaki anahtar sayısı - 1 */
const STEPS = 60
/** Rengi uygulamadan değişen malzemeler: kaynak adı → [yuva, ek] (ek boşsa yuvanın ana malzemesi) */
const FINISH = {
  C_StarWhite_Side: ['frame', ''],
  C_SW_Side_Matte: ['frame', '-matte'],
  C_SW_Screws: ['frame', '-screw'],
  C_SW_Screws_Aniso: ['frame', '-screw-top'],
  C_SW_ButtonCap: ['frame', '-button'],
  C_SW_BottomTopSpeaker: ['frame', '-grille'],
  C_SW_BackCamSpeaker: ['frame', '-mic'],
  C_SW_Antenna: ['frame', '-antenna'],
  C_SW_Plastic: ['frame', '-port'],
  C_StarWhite_Backpanel: ['back', ''],
  C_SW_Backpanel_Inner: ['back', '-inner'],
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
await MeshoptEncoder.ready
const doc = await io.read(SRC)
const root = doc.getRoot()
const scene = root.listScenes()[0]
const find = (name) => {
  const node = root.listNodes().find((n) => n.getName() === name)
  if (!node) throw new Error(`düğüm bulunamadı: ${name}`)
  return node
}
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]

// --- 1. logo ---
// Logo parçası çıkarılır. Arka panelde logonun oturduğu oyuk da kalmamalı (kenarları ışıkta logo biçimini çiziyor):
// oyuğun üstü, arka panelin yüzeyinde ve aynı malzemede düz bir yamayla kapatılır.
for (const node of root.listNodes()) {
  if (!LOGO_NODE.test(node.getName())) continue
  const world = node.getWorldMatrix()
  const points = node.getMesh().listPrimitives().flatMap((prim) => {
    const pos = prim.getAttribute('POSITION')
    return Array.from({ length: pos.getCount() }, (_, i) => apply(world, pos.getElement(i, [])))
  })
  const box = [0, 1].map((k) => [Math.min(...points.map((p) => p[k])) - LOGO_MARGIN, Math.max(...points.map((p) => p[k])) + LOGO_MARGIN])
  node.getMesh().dispose()
  node.dispose()
  // iç panel yalnızca bu oyuktan (ve kaynakta yarı saydam olan arka panelin altından) görünüyordu: gerek kalmadı
  const inner = find(BACK_INNER_NODE)
  inner.getMesh().dispose()
  inner.dispose()

  const panel = find(BACK_PANEL_NODE)
  const panelWorld = panel.getWorldMatrix()
  const prim = panel.getMesh().listPrimitives()[0]
  const pos = prim.getAttribute('POSITION')
  const uv = prim.getAttribute('TEXCOORD_0')
  // yamanın çevresindeki panel köşeleri: dış yüzeyin derinliği ve doku koordinatının konuma göre doğrusal uyumu
  const near = []
  for (let i = 0; i < pos.getCount(); i++) {
    const p = apply(panelWorld, pos.getElement(i, []))
    if (p[0] > box[0][0] - 0.01 && p[0] < box[0][1] + 0.01 && p[1] > box[1][0] - 0.01 && p[1] < box[1][1] + 0.01) near.push({ p, uv: uv.getElement(i, []) })
  }
  const outer = Math.min(...near.map((v) => v.p[2]))
  const surface = near.filter((v) => v.p[2] < outer + 2e-5)
  // en küçük kareler: u = a·x + b·y + c (v için de)
  const fit = (k) => {
    const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
    const r = [0, 0, 0]
    for (const v of surface) {
      const row = [v.p[0], v.p[1], 1]
      for (let i = 0; i < 3; i++) {
        r[i] += row[i] * v.uv[k]
        for (let j = 0; j < 3; j++) m[i][j] += row[i] * row[j]
      }
    }
    const det = (q) => q[0][0] * (q[1][1] * q[2][2] - q[1][2] * q[2][1]) - q[0][1] * (q[1][0] * q[2][2] - q[1][2] * q[2][0]) + q[0][2] * (q[1][0] * q[2][1] - q[1][1] * q[2][0])
    const d = det(m)
    return [0, 1, 2].map((c) => det(m.map((row, i) => row.map((value, j) => (j === c ? r[i] : value)))) / d)
  }
  const [fu, fv] = [fit(0), fit(1)]
  const corners = [[box[0][0], box[1][0]], [box[0][1], box[1][0]], [box[0][1], box[1][1]], [box[0][0], box[1][1]]]
  // oyuğun duvarları ve tabanı (dış yüzeyde olmayan, yamanın içinde kalan üçgenler) atılır: yüzeyde logo biçiminde
  // bir delik kalır, yama onun hemen içinde durur. Yamayı yüzeyin üstüne koymak yetmedi: oyuğun kenarı derinlik
  // karşılaştırmasında yamayla çakışıp yine görünüyordu.
  const inside = (i) => {
    const p = apply(panelWorld, pos.getElement(i, []))
    return p[0] > box[0][0] && p[0] < box[0][1] && p[1] > box[1][0] && p[1] < box[1][1]
  }
  const deep = (i) => apply(panelWorld, pos.getElement(i, []))[2] > outer + 2e-5
  const indices = prim.getIndices().getArray()
  const kept = []
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const tri = [indices[i], indices[i + 1], indices[i + 2]]
    if (tri.every(inside) && tri.some(deep)) continue
    kept.push(...tri)
  }
  console.log('arka panelden atılan oyuk üçgeni', (indices.length - kept.length) / 3)
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new indices.constructor(kept)).setBuffer(root.listBuffers()[0]))
  const z = outer + LOGO_PATCH_INSET
  const buffer = root.listBuffers()[0]
  const patch = doc
    .createPrimitive()
    .setMaterial(prim.getMaterial())
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(corners.flatMap(([x, y]) => [x, y, z]))).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(Float32Array.from(corners.flatMap(() => [0, 0, -1]))).setBuffer(buffer))
    .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(Float32Array.from(corners.flatMap(([x, y]) => [fu[0] * x + fu[1] * y + fu[2], fv[0] * x + fv[1] * y + fv[2]]))).setBuffer(buffer))
    // arkadan (-z) bakınca saat yönünün tersi
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from([0, 2, 1, 0, 3, 2])).setBuffer(buffer))
  // yama dünya koordinatında yazıldı: panelin üst düğümüne, o düğümün ters dönüşümüyle bağlanır (katı dönüşüm)
  const parent = panel.getParentNode()
  const m = parent.getWorldMatrix()
  const t = [m[12], m[13], m[14]]
  const inverse = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, -(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]), -(m[4] * t[0] + m[5] * t[1] + m[6] * t[2]), -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2]), 1]
  parent.addChild(doc.createNode('Back_Panel_Patch').setMatrix(inverse).setMesh(doc.createMesh().addPrimitive(patch)))
  console.log('logo yaması', box.map((r) => r.map((v) => +v.toFixed(4))), '| yüzey köşesi', surface.length, '| z', +z.toFixed(5))
}

// --- 2. ekranlar: doku koordinatı konumdan yeniden yazılır, yüzler dışarı bakar ---
/** `facing`: +1 iç ekran (+z'ye bakar), -1 dış ekran (-z'ye bakar; yatay eksen arkadan bakışa göre ters) */
function prepareScreen(nodeName, newName, facing) {
  const node = find(nodeName)
  const world = node.getWorldMatrix()
  const prims = node.getMesh().listPrimitives()
  const points = prims.flatMap((prim) => {
    const pos = prim.getAttribute('POSITION')
    return Array.from({ length: pos.getCount() }, (_, i) => apply(world, pos.getElement(i, [])))
  })
  const range = (k) => [Math.min(...points.map((p) => p[k])), Math.max(...points.map((p) => p[k]))]
  const [x0, x1] = range(0)
  const [y0, y1] = range(1)
  for (const prim of prims) {
    const pos = prim.getAttribute('POSITION')
    const uv = new Float32Array(pos.getCount() * 2)
    const at = (i) => apply(world, pos.getElement(i, []))
    for (let i = 0; i < pos.getCount(); i++) {
      const [x, y] = at(i)
      uv.set([facing > 0 ? (x - x0) / (x1 - x0) : (x1 - x) / (x1 - x0), (y - y0) / (y1 - y0)], i * 2)
    }
    prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(root.listBuffers()[0]))
    prim.setAttribute('TANGENT', null)
    // iç ekran çerçeve camıyla aynı düzlemde: menteşe yanında ince çizgiler (titreşim) yapmasın diye çok az öne alınır
    if (facing > 0) {
      const lifted = pos.getArray().slice()
      for (let i = 2; i < lifted.length; i += 3) lifted[i] += SCREEN_LIFT
      prim.setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(lifted).setBuffer(root.listBuffers()[0]))
    }
    prim.setAttribute('COLOR_0', null)
    // sarım yönü: yüzey normali `facing` yönüne baksın (uygulama ekranı tek yüzlü çizer)
    const idx = prim.getIndices()
    const array = idx.getArray().slice()
    let nz = 0
    for (let i = 0; i + 2 < array.length; i += 3) {
      const [a, b, c] = [at(array[i]), at(array[i + 1]), at(array[i + 2])]
      nz += (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    }
    if (nz * facing < 0) {
      for (let i = 0; i + 2 < array.length; i += 3) [array[i + 1], array[i + 2]] = [array[i + 2], array[i + 1]]
      prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(array).setBuffer(root.listBuffers()[0]))
    }
    if (facing > 0) weldByPosition(prim)
  }
  node.setName(newName)
  return { node, aspect: (x1 - x0) / (y1 - y0) }
}
/**
 * İç ekranın ağını su geçirmez yapar: aynı yerdeki köşeler tek köşe olur, bir kenarın ortasına düşen köşeler o
 * üçgeni böler. İç ekran menteşede çok ince uzun üçgenlerden oluşuyor; komşu üçgenler köşe paylaşmayınca aralarından
 * arkası görünüyor (açık telefonda menteşe boyunca ince parlak çizgicikler).
 */
function weldByPosition(prim) {
  const pos = prim.getAttribute('POSITION')
  const seen = new Map()
  const keep = []
  const remap = []
  for (let i = 0; i < pos.getCount(); i++) {
    const key = pos.getElement(i, []).map((v) => Math.round(v * 1e6)).join(',')
    if (!seen.has(key)) {
      seen.set(key, keep.length)
      keep.push(i)
    }
    remap.push(seen.get(key))
  }
  for (const semantic of prim.listSemantics()) {
    const accessor = prim.getAttribute(semantic)
    const size = accessor.getElementSize()
    const from = accessor.getArray()
    const array = new from.constructor(keep.length * size)
    keep.forEach((v, i) => array.set(from.subarray(v * size, v * size + size), i * size))
    prim.setAttribute(semantic, doc.createAccessor().setType(accessor.getType()).setNormalized(accessor.getNormalized()).setArray(array).setBuffer(root.listBuffers()[0]))
  }
  // Bir üçgenin kenarının ortasına düşen köşe (T birleşimi) de aynı sızıntıyı yapar: o üçgen o köşeden ikiye bölünür.
  const points = keep.map((v) => pos.getElement(v, []))
  let tris = Array.from(prim.getIndices().getArray(), (v) => remap[v])
  let split = 0
  for (let pass = 0; pass < 20; pass++) {
    const next = []
    let found = false
    for (let t = 0; t + 2 < tris.length; t += 3) {
      const tri = [tris[t], tris[t + 1], tris[t + 2]]
      let cut = null
      for (let e = 0; e < 3 && !cut; e++) {
        const a = points[tri[e]]
        const b = points[tri[(e + 1) % 3]]
        const length = Math.hypot(b[0] - a[0], b[1] - a[1])
        if (length < 1e-9) continue
        for (let v = 0; v < points.length; v++) {
          if (tri.includes(v)) continue
          const p = points[v]
          const along = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / (length * length)
          const off = Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / length
          if (along > 1e-4 && along < 1 - 1e-4 && off < T_TOLERANCE) {
            cut = [e, v]
            break
          }
        }
      }
      if (!cut) {
        next.push(...tri)
        continue
      }
      const [e, v] = cut
      const [p0, p1, p2] = [tri[e], tri[(e + 1) % 3], tri[(e + 2) % 3]]
      next.push(p0, v, p2, v, p1, p2)
      split++
      found = true
    }
    tris = next
    if (!found) break
  }
  prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(Uint16Array.from(tris)).setBuffer(root.listBuffers()[0]))
  console.log('iç ekran köşeleri', pos.getCount(), '→', keep.length, '| T birleşiminden bölünen üçgen', split, '| üçgen', tris.length / 3)
}
const screen = prepareScreen(SCREEN_NODE, 'screen', 1)
const cover = prepareScreen(COVER_NODE, 'cover', -1)
const white = doc
  .createTexture('white')
  .setMimeType('image/png')
  .setImage(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64'))
// iç ekranın malzemesini uygulama değiştirir; 1×1 beyaz doku, doku koordinatları budanmasın diye
screen.node.getMesh().listPrimitives()[0].setMaterial(doc.createMaterial('screen').setBaseColorTexture(white).setMetallicFactor(0).setRoughnessFactor(1))
// dış ekran: görsel verilmezse koyu cam
cover.node.getMesh().listPrimitives()[0].setMaterial(doc.createMaterial('cover').setBaseColorTexture(white).setBaseColorFactor([0.012, 0.014, 0.02, 1]).setMetallicFactor(0.2).setRoughnessFactor(0.08))

// --- 3. malzemeler ---
const baseColor = {}
for (const material of root.listMaterials()) if (FINISH[material.getName()]?.[1] === '') baseColor[FINISH[material.getName()][0]] = material.getBaseColorFactor()
for (const material of root.listMaterials()) {
  const slot = FINISH[material.getName()]
  if (slot) {
    const color = material.getBaseColorFactor()
    const base = baseColor[slot[0]]
    material.setExtras({ tone: [0, 1, 2].map((i) => +Math.min(2, color[i] / base[i]).toFixed(4)) })
    // arka panel kaynakta %90 opak: sıralama hatası yapmasın diye opak
    material.setBaseColorFactor([color[0], color[1], color[2], 1]).setAlphaMode('OPAQUE')
    material.setName(`finish:${slot[0]}${slot[1]}`)
  } else if (!['screen', 'cover'].includes(material.getName())) {
    material.setName(material.getName().replace(/^(C_SW_|C_StarWhite_|BASE_)/, '').toLowerCase())
  }
}
root.listTextures().forEach((texture, i) => texture.setName(`map${i}`).setURI(''))
// --- 4. animasyon: açıya göre doğrusal ---
const source = root.listAnimations()[0]
const channels = source.listChannels().map((channel) => {
  const sampler = channel.getSampler()
  const input = sampler.getInput()
  const output = sampler.getOutput()
  const times = Array.from({ length: input.getCount() }, (_, i) => input.getScalar(i))
  const values = times.map((_, i) => output.getElement(i, []))
  const at = (t) => {
    let i = 0
    while (i < times.length - 2 && times[i + 1] < t) i++
    const k = sampler.getInterpolation() === 'STEP' ? 0 : Math.min(1, Math.max(0, (t - times[i]) / (times[i + 1] - times[i])))
    const v = values[i].map((a, j) => a + (values[i + 1][j] - a) * k)
    if (channel.getTargetPath() !== 'rotation') return v
    const length = Math.hypot(...v)
    return v.map((a) => a / length)
  }
  const moving = values.some((v) => v.some((a, j) => Math.abs(a - values[0][j]) > 1e-6))
  return { channel, sampler, at, moving, end: times[times.length - 1] }
})
const hinge = channels.find((c) => c.channel.getTargetNode().getName() === HINGE_BONE && c.channel.getTargetPath() === 'rotation')
if (!hinge) throw new Error('menteşe animasyonu bulunamadı')
/** menteşe kemiğinin dönüşü (derece): 0 açık, 90 kapalı */
const hingeAngle = (t) => {
  const q = hinge.at(t)
  return (2 * Math.atan2(Math.hypot(q[0], q[1], q[2]), Math.abs(q[3])) * 180) / Math.PI
}
const closed = hingeAngle(hinge.end)
const timeFor = (angle) => {
  let lo = 0
  let hi = hinge.end
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (hingeAngle(mid) < angle) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}
const buffer = root.listBuffers()[0]
const input = doc.createAccessor().setType('SCALAR').setArray(Float32Array.from({ length: STEPS + 1 }, (_, i) => i / STEPS)).setBuffer(buffer)
const sourceTimes = Array.from({ length: STEPS + 1 }, (_, i) => timeFor((closed * i) / STEPS))
const fold = doc.createAnimation('fold')
for (const c of channels) {
  if (!c.moving) continue
  const size = c.channel.getTargetPath() === 'rotation' ? 4 : 3
  const array = new Float32Array((STEPS + 1) * size)
  sourceTimes.forEach((t, i) => array.set(c.at(t), i * size))
  const output = doc.createAccessor().setType(size === 4 ? 'VEC4' : 'VEC3').setArray(array).setBuffer(buffer)
  const sampler = doc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation('LINEAR')
  fold.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(c.channel.getTargetNode()).setTargetPath(c.channel.getTargetPath()).setSampler(sampler))
}
for (const c of channels) {
  c.channel.dispose()
  c.sampler.dispose()
}
source.dispose()

// --- 5. ölçü, ortalama ve menteşe düğümü ---
const bounds = getBounds(scene)
const s = HEIGHT / (bounds.max[1] - bounds.min[1])
const hingeAt = find(HINGE_BONE).getWorldTranslation()
const center = [hingeAt[0], (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2]
const device = doc.createNode('device').setScale([s, s, s])
const pivot = doc.createNode('fold').setTranslation([0, 0, hingeAt[2] - center[2]])
const rig = doc.createNode('rig').setTranslation([-hingeAt[0], -center[1], -hingeAt[2]])
for (const child of scene.listChildren()) rig.addChild(child)
pivot.addChild(rig)
device.addChild(pivot)
scene.addChild(device)
root.getAsset().generator = 'motion-studio'
root.getAsset().extras = {}
root.setExtras({})
scene.setName('foldable')

await doc.transform(prune({ keepAttributes: true, keepSolidTextures: true }), dedup(), ...(process.env.NO_COMPRESS ? [] : [meshopt({ encoder: MeshoptEncoder, level: 'medium' })]))
const bytes = await io.writeBinary(doc)
fs.writeFileSync(OUT, bytes)

const json = Buffer.from(bytes.buffer, bytes.byteOffset + 20, new DataView(bytes.buffer, bytes.byteOffset).getUint32(12, true)).toString('utf8')
const branded = json.match(/apple|iphone|airpods|duo/gi)
if (branded) throw new Error(`dosyada marka adı kaldı: ${[...new Set(branded)].join(', ')}`)
const size = bounds.max.map((v, i) => +((v - bounds.min[i]) * s).toFixed(3))
console.log('foldable boyut', size, '| ölçek', +s.toFixed(3), '| menteşe z', +((hingeAt[2] - center[2]) * s).toFixed(4))
console.log('iç ekran oranı', +screen.aspect.toFixed(4), '| dış ekran oranı', +cover.aspect.toFixed(4), '| kapalı menteşe açısı', +closed.toFixed(2))
console.log('animasyon kanalları', fold.listChannels().map((c) => `${c.getTargetNode().getName()}.${c.getTargetPath()}`).join(', '))
console.log(OUT, (fs.statSync(OUT).size / 1024).toFixed(0), 'KB')
