import { useEffect, useMemo } from 'react'
import { Object3D, type BufferGeometry, type InstancedMesh, type Texture } from 'three'
import type { DeviceFinish, Layer } from '../../engine/types'
import { roundedPlane, roundedSlab } from './geometry'
import { useImageTexture, useLayerNode, type LayerProps } from './shared'

// Kodla çizilen cihaz maketleri (dış model dosyası yok): telefon, tablet, laptop.
// Ölçüler sahne birimi; eski projelerle aynı yerleşim için telefon ~1.7×3.5, tablet ~3.6×2.6.

const FINISHES: Record<DeviceFinish, { frame: string; back: string }> = {
  silver: { frame: '#d6d8dc', back: '#e8e9eb' },
  space: { frame: '#3a3c41', back: '#2b2d31' },
  titanium: { frame: '#b8ad9f', back: '#cdc5ba' },
  blue: { frame: '#3f4b60', back: '#5a6a82' },
}

/** Geometrileri bir kez oluşturur ve katman kaldırılınca bırakır. */
function useGeometries<T extends Record<string, BufferGeometry>>(make: () => T, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- bağımlılıklar çağırandan geliyor
  const geometries = useMemo(make, deps)
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries])
  return geometries
}

/** Ekran: görüntü varsa köşelerden kırpılmış olarak, yoksa renk + temsili arayüz. */
function Screen({ geometry, layer, texture, width, height, z }: { geometry: BufferGeometry; layer: Layer; texture: Texture | null; width: number; height: number; z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geometry}>
        {texture ? <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} /> : <meshBasicMaterial color={layer.color} toneMapped={false} />}
      </mesh>
      {!texture && (
        <group position={[0, 0, 0.001]}>
          {[0.28, 0.17, 0.06].map((y, i) => (
            <mesh key={y} position={[0, height * y, 0]}>
              <planeGeometry args={[width * (0.72 - i * 0.14), height * 0.045]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
            </mesh>
          ))}
          <mesh position={[0, -height * 0.22, 0]}>
            <planeGeometry args={[width * 0.72, height * 0.28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Lens({ x, y, z, r }: { x: number; y: number; z: number; r: number }) {
  return (
    <group position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, 0.05, 32]} />
        <meshStandardMaterial color="#2c2e33" metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh position={[0, -0.026, 0]}>
        <cylinderGeometry args={[r * 0.72, r * 0.72, 0.01, 32]} />
        <meshStandardMaterial color="#05070a" metalness={0.2} roughness={0.05} />
      </mesh>
    </group>
  )
}

function Phone({ layer, screen }: { layer: Layer; screen: Texture | null }) {
  const W = 1.7
  const H = 3.5
  const D = 0.17
  const R = 0.27
  const finish = FINISHES[layer.deviceFinish ?? 'space']
  const g = useGeometries(
    () => ({
      body: roundedSlab(W, H, R, D, 0.035),
      glass: roundedPlane(W - 0.05, H - 0.05, R - 0.025),
      screen: roundedPlane(W - 0.16, H - 0.16, R - 0.08),
      island: roundedPlane(0.44, 0.13, 0.065),
      bump: roundedSlab(0.78, 0.78, 0.2, 0.05, 0.015),
    }),
    [],
  )
  const front = D / 2 + 0.001
  return (
    <group>
      <mesh geometry={g.body}>
        <meshStandardMaterial color={finish.frame} metalness={0.95} roughness={0.28} />
      </mesh>
      {/* Ön cam ve ekran */}
      <mesh geometry={g.glass} position={[0, 0, front]}>
        <meshStandardMaterial color="#050507" metalness={0.1} roughness={0.08} />
      </mesh>
      <Screen geometry={g.screen} layer={layer} texture={screen} width={W - 0.16} height={H - 0.16} z={front + 0.001} />
      <mesh geometry={g.island} position={[0, H / 2 - 0.23, front + 0.003]}>
        <meshBasicMaterial color="#000000" />
      </mesh>
      {/* Yan tuşlar */}
      {[
        [-1, 1.08, 0.13],
        [-1, 0.72, 0.3],
        [-1, 0.32, 0.3],
        [1, 0.82, 0.46],
      ].map(([side, y, h], i) => (
        <mesh key={i} position={[(side * W) / 2 + side * 0.012, y, 0]}>
          <boxGeometry args={[0.03, h, 0.06]} />
          <meshStandardMaterial color={finish.frame} metalness={0.95} roughness={0.3} />
        </mesh>
      ))}
      {/* Arka cam ve kamera çıkıntısı */}
      <mesh geometry={g.glass} position={[0, 0, -front]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color={finish.back} metalness={0.3} roughness={0.55} />
      </mesh>
      <group position={[W / 2 - 0.52, H / 2 - 0.52, -front - 0.025]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={g.bump}>
          <meshStandardMaterial color={finish.back} metalness={0.4} roughness={0.35} />
        </mesh>
        <Lens x={-0.17} y={0.17} z={0.045} r={0.13} />
        <Lens x={-0.17} y={-0.17} z={0.045} r={0.13} />
        <Lens x={0.19} y={0} z={0.045} r={0.13} />
        <mesh position={[0.19, 0.25, 0.03]}>
          <circleGeometry args={[0.045, 24]} />
          <meshBasicMaterial color="#f6ecd5" />
        </mesh>
      </group>
    </group>
  )
}

function Tablet({ layer, screen }: { layer: Layer; screen: Texture | null }) {
  const W = 3.6
  const H = 2.6
  const D = 0.1
  const R = 0.2
  const finish = FINISHES[layer.deviceFinish ?? 'silver']
  const g = useGeometries(
    () => ({
      body: roundedSlab(W, H, R, D, 0.025),
      glass: roundedPlane(W - 0.04, H - 0.04, R - 0.02),
      screen: roundedPlane(W - 0.28, H - 0.28, R - 0.12),
      bump: roundedSlab(0.42, 0.62, 0.12, 0.03, 0.01),
    }),
    [],
  )
  const front = D / 2 + 0.001
  return (
    <group>
      <mesh geometry={g.body}>
        <meshStandardMaterial color={finish.frame} metalness={0.95} roughness={0.3} />
      </mesh>
      <mesh geometry={g.glass} position={[0, 0, front]}>
        <meshStandardMaterial color="#050507" metalness={0.1} roughness={0.08} />
      </mesh>
      <Screen geometry={g.screen} layer={layer} texture={screen} width={W - 0.28} height={H - 0.28} z={front + 0.001} />
      <mesh position={[0, H / 2 - 0.07, front + 0.002]}>
        <circleGeometry args={[0.025, 16]} />
        <meshBasicMaterial color="#15181d" />
      </mesh>
      <mesh geometry={g.glass} position={[0, 0, -front]} rotation={[0, Math.PI, 0]}>
        <meshStandardMaterial color={finish.back} metalness={0.9} roughness={0.35} />
      </mesh>
      <group position={[W / 2 - 0.36, H / 2 - 0.44, -front - 0.015]} rotation={[0, Math.PI, 0]}>
        <mesh geometry={g.bump}>
          <meshStandardMaterial color={finish.back} metalness={0.6} roughness={0.3} />
        </mesh>
        <Lens x={0} y={0.14} z={0.03} r={0.1} />
        <Lens x={0} y={-0.14} z={0.03} r={0.08} />
      </group>
    </group>
  )
}

/** Klavye tuşları: tek bir örneklenmiş (instanced) mesh. */
function Keyboard({ width, depth }: { width: number; depth: number }) {
  const cols = 14
  const rows = 6
  const gap = 0.025
  const key = Math.min((width - gap * (cols + 1)) / cols, (depth - gap * (rows + 1)) / rows)
  const setup = (mesh: InstancedMesh | null) => {
    if (!mesh) return
    const o = new Object3D()
    let i = 0
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        o.position.set(-width / 2 + gap + key / 2 + c * (key + gap), 0, -depth / 2 + gap + key / 2 + r * (key + gap))
        o.updateMatrix()
        mesh.setMatrixAt(i++, o.matrix)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
  }
  return (
    <instancedMesh ref={setup} args={[undefined, undefined, cols * rows]}>
      <boxGeometry args={[key, 0.018, key]} />
      <meshStandardMaterial color="#17181b" roughness={0.7} />
    </instancedMesh>
  )
}

function Laptop({ layer, screen }: { layer: Layer; screen: Texture | null }) {
  const W = 3.8
  const H = 2.45
  const lidD = 0.05
  const baseD = 2.6
  const finish = FINISHES[layer.deviceFinish ?? 'silver']
  const angle = ((layer.lidAngle ?? 105) * Math.PI) / 180
  const g = useGeometries(
    () => ({
      lid: roundedSlab(W, H, 0.12, lidD, 0.012),
      bezel: roundedPlane(W - 0.03, H - 0.03, 0.11),
      screen: roundedPlane(W - 0.22, H - 0.3, 0.05),
      notch: roundedPlane(0.34, 0.1, 0.04),
      base: roundedSlab(W + 0.04, baseD, 0.14, 0.1, 0.03),
      well: roundedPlane(3.2, 1.12, 0.04),
      trackpad: roundedPlane(1.45, 0.88, 0.06),
    }),
    [],
  )
  const lidFront = lidD / 2 + 0.001
  // Kapak menteşe etrafında döner; 90° dik, 105° hafif geriye yatık.
  return (
    <group>
      <group position={[0, -H / 2, 0]} rotation={[-(angle - Math.PI / 2), 0, 0]}>
        <group position={[0, H / 2, 0]}>
          <mesh geometry={g.lid}>
            <meshStandardMaterial color={finish.back} metalness={0.9} roughness={0.32} />
          </mesh>
          <mesh geometry={g.bezel} position={[0, 0, lidFront]}>
            <meshStandardMaterial color="#060608" metalness={0.1} roughness={0.1} />
          </mesh>
          <Screen geometry={g.screen} layer={layer} texture={screen} width={W - 0.22} height={H - 0.3} z={lidFront + 0.001} />
          <mesh geometry={g.notch} position={[0, H / 2 - 0.05, lidFront + 0.003]}>
            <meshBasicMaterial color="#000000" />
          </mesh>
        </group>
      </group>
      {/* Menteşe ve gövde */}
      <mesh position={[0, -H / 2 - 0.02, -0.02]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, W - 0.9, 24]} />
        <meshStandardMaterial color="#1c1d20" metalness={0.8} roughness={0.4} />
      </mesh>
      <group position={[0, -H / 2 - 0.07, baseD / 2 - 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
        <mesh geometry={g.base}>
          <meshStandardMaterial color={finish.frame} metalness={0.9} roughness={0.32} />
        </mesh>
        <mesh geometry={g.well} position={[0, baseD / 2 - 0.9, 0.051]}>
          <meshStandardMaterial color="#0c0d0f" roughness={0.8} />
        </mesh>
        <group position={[0, baseD / 2 - 0.9, 0.06]} rotation={[Math.PI / 2, 0, 0]}>
          <Keyboard width={3.1} depth={1.02} />
        </group>
        <mesh geometry={g.trackpad} position={[0, -baseD / 2 + 0.62, 0.051]}>
          <meshStandardMaterial color={finish.frame} metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    </group>
  )
}

/** Telefon, tablet ve laptop maketleri: ekran rengi ya da ekran görüntüsü, gövde rengi. */
export function DeviceLayer({ layer, register }: LayerProps) {
  const node = useLayerNode(layer, register)
  const screen = useImageTexture(layer.image)?.texture ?? null
  return (
    <group {...node}>
      {layer.kind === 'laptop' ? <Laptop layer={layer} screen={screen} /> : layer.kind === 'tablet' ? <Tablet layer={layer} screen={screen} /> : <Phone layer={layer} screen={screen} />}
    </group>
  )
}
