import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import fs from 'node:fs'
const [file, outDir] = process.argv.slice(2)
fs.mkdirSync(outDir, { recursive: true })
const doc = await new NodeIO().registerExtensions(ALL_EXTENSIONS).read(file)
const root = doc.getRoot()
root.listTextures().forEach((t, i) => {
  const ext = t.getMimeType() === 'image/png' ? 'png' : 'jpg'
  const users = root.listMaterials().filter((m) => [m.getBaseColorTexture(), m.getEmissiveTexture(), m.getNormalTexture(), m.getMetallicRoughnessTexture(), m.getOcclusionTexture()].includes(t)).map((m) => m.getName())
  const slot = root.listMaterials().flatMap((m) => [['base', m.getBaseColorTexture()], ['emit', m.getEmissiveTexture()], ['normal', m.getNormalTexture()], ['mr', m.getMetallicRoughnessTexture()], ['ao', m.getOcclusionTexture()]].filter(([, x]) => x === t).map(([s]) => s))
  fs.writeFileSync(`${outDir}/${i}-${slot[0] ?? 'x'}-${users[0] ?? ''}.${ext}`, t.getImage())
})
console.log('textures:', root.listTextures().length)
