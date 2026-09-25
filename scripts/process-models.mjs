// Cihaz modellerini uygulamaya hazırlar: models-src/*.glb → public/models/*.glb
//   node scripts/process-models.mjs
// - Marka logoları ve yazıları, aksesuarlar (klavye kılıfı, kalem) ve hazır duvar kağıtları çıkarılır.
// - Parça/malzeme adları genel adlarla değiştirilir (dosyada marka adı kalmaz).
// - Model, ekranı +z'ye bakacak şekilde döndürülür, ortalanır ve procedural maketlerle aynı ölçüye getirilir.
// - Ekran parçası "screen" adını alır ve 0..1 doku koordinatı üretilir (ekran görüntüsü tam oturur).
// - Gövde rengi uygulamadan değişebilsin diye gövde malzemeleri "finish:frame" / "finish:back" adını alır.
// - Laptop kapağı "lid" düğümüne taşınır (menteşe ekseninde döner; extras.baseAngle = modeldeki açı).
import { Document, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions'
import { MeshoptEncoder } from 'meshoptimizer'
import fs from 'node:fs'

const MODELS = [
  {
    src: 'iphone',
    out: 'phone',
    remove: [],
    // logo parçası gövdede delik bırakıyor: silmek yerine gövde malzemesiyle doldurulur
    fill: { case_logo_0: 'back' },
    screen: 'case_wallpaper_0',
    up: 'case_lens_0', // arka kamera lensleri üstte
    major: 'y',
    size: { axis: 'y', value: 3.5 },
    finish: { frame: ['ereve'], back: ['ana_renk'] },
    stripTextures: [],
  },
  {
    src: 'ipad',
    out: 'tablet',
    remove: [
      'zOxbcmrLkjhpczv', // logo
      'zqtoVbRomYTqSHh', // arka yüzdeki model yazısı
      // klavye kılıfı ve kalem
      'JSIYFTAfNBxITwh', 'IqRfKStwDgeRQOZ', 'gkBpCLiJsVZOeeI', 'lrbrVschRxheJpH', 'QrDbpdHDavAtmIJ', 'KCdNBYluvwbWRkT',
      'CDrzEfoLjyASCRi', 'nJERXzOZsnFcSON', 'BpyRVSoPvSPKdjk', 'XFdCnuCHXOLuzFd', 'OEQcAqSXcnKaUOE', 'DrcYzFmiOfKdeZe',
      'iekTaVdHmnWwJsx', 'gBlUCtDyXyMRPqx', 'JdEVVtxiHuCClVS', 'zSmVLZftLugfLRZ', 'qMySgvAZPQLyJha', 'IKHWfRUdSrzoulc',
      'LnNrRRAQOCeAZvC', 'qCzZmpqsTctXcrb', 'YbbSYeQhOxKuoyj', 'VafWfnbbqnvoFHm',
    ],
    screen: 'EjCaatfcGdAQBho',
    up: 'ieymSYEAEEGnCHY', // arka kamera: yatay tutuşta üst kenarda
    major: 'x',
    size: { axis: 'x', value: 3.6 },
    finish: { frame: ['JiwoEoDQOLnLqCc', 'rJLLQibgXjvbmhN'], back: ['rlLxXLyqFuSJzQX'] },
    // arka yüzdeki model yazısı dokularda; gövde dokuları tamamen kaldırılır
    stripTextures: ['rlLxXLyqFuSJzQX', 'JiwoEoDQOLnLqCc', 'rJLLQibgXjvbmhN', 'wADiXiaDqUQHYtm', 'TqhTgVXhIEMfiTt', 'sWpcDaipWDFtTnj'],
  },
  {
    src: 'macbook',
    out: 'laptop',
    remove: ['Object_55'], // alt yüzdeki model yazısı
    fill: { Object_100: 'frame' }, // kapaktaki logo
    screen: 'Object_107',
    major: null, // zaten dik duruyor, ön yüz +z
    size: { axis: 'x', value: 3.8 },
    finish: { frame: ['zNRfbdNyoCOxSDD', 'HdeQgqDhVRltuvQ', 'XvtJEVWVvyDeJRR', 'WiyOPYJEeiHNVjF'], back: [] },
    stripTextures: [],
    lid: ['Object_83', 'Object_85', 'Object_87', 'Object_89', 'Object_91', 'Object_94', 'Object_96', 'Object_100', 'Object_103', 'Object_105', 'Object_107', 'Object_111'],
  },
]

const WHITE_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

// --- küçük vektör/matris yardımcıları (glTF sütun öncelikli 4x4) ---
const apply = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]
const applyDir = (m, [x, y, z]) => [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z]
const sub = (a, b) => a.map((v, i) => v - b[i])
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const norm = (a) => {
  const l = Math.hypot(...a)
  return a.map((v) => v / l)
}
const scale = (a, s) => a.map((v) => v * s)
function mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
function invertRigidScale(m) {
  // yalnızca döndürme + eşit ölçek + öteleme içeren matrisler için
  const s2 = m[0] * m[0] + m[1] * m[1] + m[2] * m[2]
  const r = [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1].map((v, i) => (i % 4 === 3 || i >= 12 ? v : v / s2))
  const t = applyDir(r, [m[12], m[13], m[14]])
  r[12] = -t[0]
  r[13] = -t[1]
  r[14] = -t[2]
  return r
}

function worldPositions(node) {
  const m = node.getWorldMatrix()
  const out = []
  for (const p of node.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION')
    for (let i = 0; i < pos.getCount(); i++) out.push(apply(m, pos.getElement(i, [])))
  }
  return out
}

/** Ekranın normali (alan ağırlıklı üçgen normallerinin toplamı), dünya uzayında. */
function screenNormal(node) {
  const m = node.getWorldMatrix()
  let n = [0, 0, 0]
  for (const p of node.getMesh().listPrimitives()) {
    const pos = p.getAttribute('POSITION')
    const idx = p.getIndices()
    const count = idx ? idx.getCount() : pos.getCount()
    const at = (k) => apply(m, pos.getElement(idx ? idx.getScalar(k) : k, []))
    for (let k = 0; k + 2 < count; k += 3) {
      const a = at(k)
      n = n.map((v, i) => v + cross(sub(at(k + 1), a), sub(at(k + 2), a))[i])
    }
  }
  return norm(n)
}

const centroid = (pts) => scale(pts.reduce((s, p) => s.map((v, i) => v + p[i]), [0, 0, 0]), 1 / pts.length)

/** Düzlemdeki en uzun doğrultu (2B kovaryansın büyük özvektörü). */
function majorAxis(pts, n) {
  const a = norm(Math.abs(n[0]) < 0.9 ? cross(n, [1, 0, 0]) : cross(n, [0, 1, 0]))
  const b = cross(n, a)
  const c = centroid(pts)
  let xx = 0
  let yy = 0
  let xy = 0
  for (const p of pts) {
    const d = sub(p, c)
    const u = dot(d, a)
    const v = dot(d, b)
    xx += u * u
    yy += v * v
    xy += u * v
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
  return norm(a.map((v, i) => v * Math.cos(angle) + b[i] * Math.sin(angle)))
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })
await MeshoptEncoder.ready
fs.mkdirSync('public/models', { recursive: true })

for (const cfg of MODELS) {
  /** @type {Document} */
  const doc = await io.read(`models-src/${cfg.src}.glb`)
  const root = doc.getRoot()
  const scene = root.listScenes()[0]
  const byName = (name) => {
    const n = root.listNodes().find((x) => x.getName() === name)
    if (!n) throw new Error(`${cfg.src}: düğüm yok: ${name}`)
    return n
  }

  for (const name of cfg.remove) byName(name).dispose()

  // Gövde malzemeleri ve dokular
  for (const mat of root.listMaterials()) {
    const name = mat.getName()
    if (cfg.stripTextures.includes(name)) {
      mat.setBaseColorTexture(null).setMetallicRoughnessTexture(null).setNormalTexture(null).setOcclusionTexture(null).setEmissiveTexture(null)
    }
    for (const [slot, names] of Object.entries(cfg.finish)) if (names.includes(name)) mat.setName(`finish:${slot}`)
  }

  // Logo delikleri: logo parçası gövdeyle aynı malzemeyi alır, iz kalmaz
  for (const [name, slot] of Object.entries(cfg.fill ?? {})) {
    const mat = root.listMaterials().find((m) => m.getName() === `finish:${slot}`)
    for (const p of byName(name).getMesh().listPrimitives()) p.setMaterial(mat)
  }

  // Ekran: kendi dokusunu bırak, ekran görüntüsü uygulamadan gelecek
  const screenNode = byName(cfg.screen)
  // 1×1 beyaz doku: prune dokusuz malzemenin doku koordinatlarını silmesin diye
  const white = doc.createTexture('').setMimeType('image/png').setImage(Buffer.from(WHITE_PNG, 'base64'))
  const screenMat = doc.createMaterial('screen').setBaseColorTexture(white).setMetallicFactor(0).setRoughnessFactor(1)
  for (const p of screenNode.getMesh().listPrimitives()) p.setMaterial(screenMat)

  // Yön: ekran normali +z, uzun kenar cfg.major, "up" parçası +y tarafında
  const sPts = worldPositions(screenNode)
  let n = screenNormal(screenNode)
  if (!cfg.major && n[2] < 0) n = scale(n, -1)
  let X = [1, 0, 0]
  let Y = [0, 1, 0]
  let Z = [0, 0, 1]
  if (cfg.major) {
    const all = root.listNodes().filter((x) => x.getMesh()).flatMap(worldPositions)
    // normal gövdenin dışına baksın
    if (dot(sub(centroid(sPts), centroid(all)), n) < 0) n = scale(n, -1)
    const major = majorAxis(sPts, n)
    const minor = cross(n, major)
    const upRef = sub(centroid(worldPositions(byName(cfg.up))), centroid(sPts))
    Z = n
    if (cfg.major === 'y') {
      Y = dot(major, upRef) >= 0 ? major : scale(major, -1)
      X = cross(Y, Z)
    } else {
      Y = dot(minor, upRef) >= 0 ? minor : scale(minor, -1)
      X = cross(Y, Z)
    }
  }
  // dünya → yeni eksenler (satırlar X, Y, Z)
  const rot = [X[0], Y[0], Z[0], 0, X[1], Y[1], Z[1], 0, X[2], Y[2], Z[2], 0, 0, 0, 0, 1]

  // Laptop kapağı: menteşede duran bir düğüme taşı
  if (cfg.lid) {
    const lidNodes = cfg.lid.map(byName)
    const pts = lidNodes.flatMap(worldPositions)
    const low = pts.reduce((a, b) => (b[1] < a[1] ? b : a))
    const hinge = [0, low[1], low[2]]
    const top = pts.reduce((a, b) => (b[1] > a[1] ? b : a))
    const baseAngle = 90 + (Math.atan2(hinge[2] - top[2], top[1] - hinge[1]) * 180) / Math.PI
    const lid = doc.createNode('lid').setTranslation(hinge).setExtras({ baseAngle: +baseAngle.toFixed(2) })
    scene.addChild(lid)
    const inv = invertRigidScale(lid.getWorldMatrix())
    for (const node of lidNodes) {
      const world = node.getWorldMatrix()
      for (const p of node.listParents()) if (p.propertyType === 'Node' || p.propertyType === 'Scene') p.removeChild(node)
      node.setMatrix(mul(inv, world))
      lid.addChild(node)
    }
    console.log(cfg.out, 'lid baseAngle', baseAngle.toFixed(1), 'hinge', hinge.map((v) => +v.toFixed(4)))
  }

  // Doku koordinatları: ekran düzleminde X yatay, Y dikey
  {
    const m = screenNode.getWorldMatrix()
    const nS = cfg.major ? Z : n
    const u = norm(sub(X, scale(nS, dot(X, nS))))
    const v = cross(nS, u)
    const us = sPts.map((p) => dot(p, u))
    const vs = sPts.map((p) => dot(p, v))
    const range = (a) => a.reduce(([lo, hi], x) => [Math.min(lo, x), Math.max(hi, x)], [Infinity, -Infinity])
    const [[u0, u1], [v0, v1]] = [range(us), range(vs)]
    for (const p of screenNode.getMesh().listPrimitives()) {
      const pos = p.getAttribute('POSITION')
      const uv = new Float32Array(pos.getCount() * 2)
      for (let i = 0; i < pos.getCount(); i++) {
        const w = apply(m, pos.getElement(i, []))
        uv[i * 2] = (dot(w, u) - u0) / (u1 - u0)
        // üst kenar v=1: uygulamadaki ekran görüntüleri three.js varsayılanıyla (flipY) yükleniyor
        uv[i * 2 + 1] = (dot(w, v) - v0) / (v1 - v0)
      }
      for (const sem of p.listSemantics()) if (sem.startsWith('TEXCOORD')) p.setAttribute(sem, null)
      p.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(uv).setBuffer(root.listBuffers()[0]))
    }
  }

  // Tüm sahneyi tek kök altında topla: döndür, ortala, ölçekle
  const device = doc.createNode('device')
  for (const child of scene.listChildren()) {
    scene.removeChild(child)
    device.addChild(child)
  }
  scene.addChild(device)
  device.setMatrix(rot)
  const pts = root.listNodes().filter((x) => x.getMesh()).flatMap(worldPositions)
  const min = pts.reduce((a, p) => a.map((v, i) => Math.min(v, p[i])), [Infinity, Infinity, Infinity])
  const max = pts.reduce((a, p) => a.map((v, i) => Math.max(v, p[i])), [-Infinity, -Infinity, -Infinity])
  const axis = { x: 0, y: 1, z: 2 }[cfg.size.axis]
  const s = cfg.size.value / (max[axis] - min[axis])
  const c = min.map((v, i) => (v + max[i]) / 2)
  const final = mul([s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, -c[0] * s, -c[1] * s, -c[2] * s, 1], rot)
  device.setMatrix(final)
  console.log(cfg.out, 'size', max.map((v, i) => +((v - min[i]) * s).toFixed(3)))

  // Genel adlar: dosyada marka/model adı kalmasın
  let k = 0
  for (const node of root.listNodes()) if (!['device', 'lid'].includes(node.getName()) && node !== screenNode) node.setName(`part${k++}`)
  screenNode.setName('screen')
  for (const mesh of root.listMeshes()) mesh.setName('')
  k = 0
  for (const mat of root.listMaterials()) if (!/^(finish:|screen$)/.test(mat.getName())) mat.setName(`m${k++}`)
  for (const tex of root.listTextures()) tex.setName('').setURI('')
  root.getAsset().extras = {}
  root.getAsset().generator = 'motion-studio'

  await doc.transform(prune(), dedup(), weld(), meshopt({ encoder: MeshoptEncoder, level: 'medium' }))
  fs.writeFileSync(`public/models/${cfg.out}.glb`, await io.writeBinary(doc))
  console.log(cfg.out, (fs.statSync(`public/models/${cfg.out}.glb`).size / 1024).toFixed(0), 'KB')
}
