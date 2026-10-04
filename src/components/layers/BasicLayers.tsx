import { RoundedBox } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box3, DoubleSide, ExtrudeGeometry, ShapeGeometry, Vector3, type BufferGeometry } from 'three'
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js'
import { resolveAssetUrl } from '../../persistence/assets'
import { roundedRect } from './geometry'
import type { LayerState } from '../../engine/types'
import { useImageTexture, useLayerNode, type LayerProps } from './shared'

// light-sweep: görselin yerel konumu (yükseklik birimiyle) yuvarlatılmış kutunun çevresindeki yere (0..1) çevrilir;
// saatin yönünde, üst kenarın solundan başlar. Işıklar bu yol boyunca eşit hızla ilerler.
const SWEEP_GLSL = /* glsl */ `
uniform float uSweep; uniform float uSweepOn; uniform float uSweepCount; uniform float uSweepWidth; uniform float uSweepFloor;
uniform float uSweepRadius; uniform float uSweepInset; uniform float uSweepAspect;
varying vec2 vSweepPos;
float sweepPerimeter(vec2 q, float hw, float hh, float r) {
  float a = max(hw - r, 0.0); float b = max(hh - r, 0.0);
  vec2 c = clamp(q, vec2(-a, -b), vec2(a, b));
  vec2 v = q - c;
  if (abs(v.x) < 1e-5 && abs(v.y) < 1e-5) { if (abs(q.y) * hw >= abs(q.x) * hh) v.y = sign(q.y + 1e-6) * 1e-5; else v.x = sign(q.x) * 1e-5; }
  float hp = 1.5707963 * r;
  float d;
  if (v.y > 0.0 && abs(v.x) < 1e-5) d = c.x + a;
  else if (v.x > 0.0 && v.y > 0.0) d = 2.0 * a + atan(v.x, v.y) * r;
  else if (v.x > 0.0 && abs(v.y) < 1e-5) d = 2.0 * a + hp + (b - c.y);
  else if (v.x > 0.0) d = 2.0 * a + 2.0 * b + hp + atan(-v.y, v.x) * r;
  else if (v.y < 0.0 && abs(v.x) < 1e-5) d = 2.0 * a + 2.0 * b + 2.0 * hp + (a - c.x);
  else if (v.y < 0.0) d = 4.0 * a + 2.0 * b + 2.0 * hp + atan(-v.x, -v.y) * r;
  else if (abs(v.y) < 1e-5) d = 4.0 * a + 2.0 * b + 3.0 * hp + (c.y + b);
  else d = 4.0 * a + 4.0 * b + 3.0 * hp + atan(v.y, -v.x) * r;
  return d / (4.0 * a + 4.0 * b + 4.0 * hp);
}
float sweepMask() {
  float hw = uSweepAspect * 0.5 - uSweepInset; float hh = 0.5 - uSweepInset;
  float u = sweepPerimeter(vSweepPos, hw, hh, min(uSweepRadius, min(hw, hh)));
  float m = 0.0;
  for (int k = 0; k < 4; k++) {
    if (float(k) >= uSweepCount) break;
    float d = fract(u - uSweep - float(k) / uSweepCount + 0.5) - 0.5;
    m = max(m, exp(-(d * d) / (uSweepWidth * uSweepWidth)));
  }
  return uSweepFloor + (1.0 - uSweepFloor) * m;
}
`

/** light-sweep uniform'ları ve görsel malzemesine eklenen shader parçası */
function useSweep() {
  // uniform'lar ref'te: her karede değerleri değişir (React durumu değil)
  const ref = useRef({
    uSweep: { value: 0 }, uSweepOn: { value: 0 }, uSweepCount: { value: 2 }, uSweepWidth: { value: 0.1 }, uSweepFloor: { value: 0 },
    uSweepRadius: { value: 0.5 }, uSweepInset: { value: 0 }, uSweepAspect: { value: 1 }, uSweepHeight: { value: 1 },
  })
  const onBeforeCompile = useCallback((shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) => {
    Object.assign(shader.uniforms, ref.current)
    shader.vertexShader = `uniform float uSweepHeight;\nvarying vec2 vSweepPos;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSweepPos = transformed.xy / uSweepHeight;')
    shader.fragmentShader = `${SWEEP_GLSL}\n${shader.fragmentShader}`.replace(
      '#include <dithering_fragment>',
      '#include <dithering_fragment>\nif (uSweepOn > 0.5) gl_FragColor.a *= sweepMask();',
    )
  }, [])
  const update = useCallback((s: LayerState, aspect: number, height: number) => {
    const u = ref.current
    u.uSweepAspect.value = aspect
    u.uSweepHeight.value = height
    u.uSweepOn.value = s.sweep === null ? 0 : 1
    u.uSweep.value = s.sweep ?? 0
    u.uSweepCount.value = s.sweepCount
    u.uSweepWidth.value = Math.max(1e-3, s.sweepWidth)
    u.uSweepFloor.value = s.sweepFloor
    u.uSweepRadius.value = s.sweepRadius
    u.uSweepInset.value = s.sweepInset
  }, [])
  return { onBeforeCompile, update }
}

export function ImageLayer({ layer, register }: LayerProps) {
  const image = useImageTexture(layer.image)
  const width = 3
  const height = image ? width / image.aspect : width * 0.6
  const sweep = useSweep()
  const node = useLayerNode(layer, register, (_g, s) => sweep.update(s, width / height, height))
  return (
    <group {...node}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {/* saydam PNG'ler (logo, gölgeli etiket) kenarlarıyla karışsın; opak görsellerde fark yok.
            `tint`: görsel katman rengiyle çarpılır (beyaz çizilmiş ışık/çerçeve görselleri istenen renge boyanır)
            light-sweep bloğu varsa görsel yalnızca kenar yolunda dönen ışıkların olduğu yerde görünür */}
        {image ? <meshBasicMaterial key={image.url} map={image.texture} color={layer.tint ? layer.color : '#ffffff'} transparent toneMapped={false} onBeforeCompile={sweep.onBeforeCompile} /> : <meshBasicMaterial color="#2a303a" />}
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
