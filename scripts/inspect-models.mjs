import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f)
  const root = doc.getRoot()
  console.log('=====', f)
  for (const m of root.listMaterials()) {
    const tex = m.getBaseColorTexture()
    const em = m.getEmissiveTexture()
    console.log('MAT', JSON.stringify(m.getName()), 'color', m.getBaseColorFactor().map((v) => +v.toFixed(2)).join(','), 'metal', m.getMetallicFactor(), 'rough', m.getRoughnessFactor(), 'tex', tex ? `${tex.getName()} ${tex.getSize()?.join('x')}` : '-', em ? 'emissiveTex ' + em.getName() : '')
  }
  for (const n of root.listNodes()) {
    const mesh = n.getMesh()
    if (!mesh) continue
    const mats = mesh.listPrimitives().map((p) => p.getMaterial()?.getName()).join('|')
    const verts = mesh.listPrimitives().reduce((s, p) => s + (p.getAttribute('POSITION')?.getCount() ?? 0), 0)
    console.log('NODE', JSON.stringify(n.getName()), 'mesh', JSON.stringify(mesh.getName()), 'mats', mats, 'verts', verts)
  }
}
