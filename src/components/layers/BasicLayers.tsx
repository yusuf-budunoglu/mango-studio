import { RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useState } from 'react'
import { Box3, DoubleSide, ExtrudeGeometry, ShapeGeometry, Vector3, type BufferGeometry } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { resolveAssetUrl } from '../../persistence/assets'
import { roundedRect } from './geometry'
import { useImageTexture, useLayerNode, type LayerProps } from './shared'

export function ImageLayer({ layer, register }: LayerProps) {
  const node = useLayerNode(layer, register)
  const image = useImageTexture(layer.image)
  const width = 3
  const height = image ? width / image.aspect : width * 0.6
  return (
    <group {...node}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {/* saydam PNG'ler (logo, gölgeli etiket) kenarlarıyla karışsın; opak görsellerde fark yok */}
        {image ? <meshBasicMaterial key={image.url} map={image.texture} transparent toneMapped={false} /> : <meshBasicMaterial color="#2a303a" />}
      </mesh>
    </group>
  )
}

/** Şekiller: 3D küp ya da düz dikdörtgen, yuvarlatılmış kutu, daire (elips). */
export function ShapeLayer({ layer, register }: LayerProps) {
  const node = useLayerNode(layer, register)
  const w = layer.shapeWidth ?? 1
  const h = layer.shapeHeight ?? 1
  const shape = layer.shape ?? 'cube'
  const rounded = useMemo(() => (shape === 'rounded' ? new ShapeGeometry(roundedRect(w, h, Math.min(w, h) * 0.2), 12) : null), [shape, w, h])
  useEffect(() => () => rounded?.dispose(), [rounded])
  const flat = <meshBasicMaterial color={layer.color} toneMapped={false} side={DoubleSide} />

  return (
    <group {...node}>
      {shape === 'cube' && (
        <RoundedBox args={[w, h, 0.2]} radius={Math.min(w, h, 0.2) * 0.5}>
          <meshStandardMaterial color={layer.color} />
        </RoundedBox>
      )}
      {shape === 'rect' && (
        <mesh>
          <planeGeometry args={[w, h]} />
          {flat}
        </mesh>
      )}
      {shape === 'rounded' && rounded && <mesh geometry={rounded}>{flat}</mesh>}
      {shape === 'circle' && (
        <mesh scale={[1, h / w, 1]}>
          <circleGeometry args={[w / 2, 64]} />
          {flat}
        </mesh>
      )}
    </group>
  )
}

interface SvgPart {
  geometry: BufferGeometry
  color: string
}

/** SVG dosyasını sahneye çevirir: ortalanır, 2.5 birim genişliğe ölçeklenir, istenirse kalınlık verilir. */
function useSvgParts(ref: string | undefined, extrude: number) {
  const [parts, setParts] = useState<SvgPart[] | null>(null)
  useEffect(() => {
    if (!ref) return
    let alive = true
    let made: SvgPart[] = []
    void resolveAssetUrl(ref)
      .then((url) => (url ? fetch(url).then((r) => r.text()) : null))
      .then((text) => {
        if (!alive || !text) return
        const data = new SVGLoader().parse(text)
        const shaped = data.paths
          .filter((path) => (path.userData?.style as { fill?: string } | undefined)?.fill !== 'none')
          .map((path) => ({ shapes: SVGLoader.createShapes(path), color: `#${path.color.getHexString()}` }))
        // Önce düz haliyle ölçü al: ortalamak ve genişliği 2.5 birime getirmek için.
        const box = new Box3()
        for (const { shapes } of shaped) {
          const flatGeometry = new ShapeGeometry(shapes)
          flatGeometry.computeBoundingBox()
          if (flatGeometry.boundingBox) box.union(flatGeometry.boundingBox)
          flatGeometry.dispose()
        }
        const size = box.getSize(new Vector3())
        const center = box.getCenter(new Vector3())
        const scale = 2.5 / Math.max(size.x, size.y, 1e-6)
        made = shaped.map(({ shapes, color }) => {
          // Kalınlık sahne biriminde; SVG'nin kendi ölçüsünden bağımsız.
          const geometry = extrude > 0 ? new ExtrudeGeometry(shapes, { depth: extrude / scale, bevelEnabled: false, curveSegments: 12 }) : new ShapeGeometry(shapes, 12)
          // SVG'de y aşağı doğru. Ters çevirmeyi X ekseninde 180° döndürerek yap: negatif ölçek yüzey
          // yönlerini bozar ve ışık yanlış tarafa düşer. Böylece ön yüz kameraya, kalınlık geriye bakar.
          geometry.translate(-center.x, -center.y, 0)
          geometry.rotateX(Math.PI)
          geometry.scale(scale, scale, scale)
          return { geometry, color }
        })
        setParts(made)
      })
    return () => {
      alive = false
      for (const p of made) p.geometry.dispose()
    }
  }, [ref, extrude])
  return ref ? parts : null
}

export function SvgLayer({ layer, register }: LayerProps) {
  const node = useLayerNode(layer, register)
  const extrude = layer.extrude ?? 0
  const parts = useSvgParts(layer.media, extrude)
  return (
    <group {...node}>
      {parts?.map((p, i) => (
        <mesh key={i} geometry={p.geometry}>
          {extrude > 0 ? (
            <meshStandardMaterial color={layer.tint ? layer.color : p.color} metalness={0.3} roughness={0.4} side={DoubleSide} />
          ) : (
            <meshBasicMaterial color={layer.tint ? layer.color : p.color} toneMapped={false} side={DoubleSide} />
          )}
        </mesh>
      ))}
      {!parts && (
        // Dosya seçilmemişken tıklanabilir bir yer tutucu.
        <mesh>
          <planeGeometry args={[2.5, 1]} />
          <meshBasicMaterial color="#2a303a" />
        </mesh>
      )}
    </group>
  )
}
