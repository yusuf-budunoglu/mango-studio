import { RoundedBox } from '@react-three/drei'
import type { Texture } from 'three'
import type { Layer } from '../../engine/types'
import { useImageTexture, useLayerNode, type LayerProps } from './shared'

/** Cihazların ölçüleri (sahne birimi): gövde ve ekran. */
const DEVICES = {
  phone: { body: [1.7, 3.4, 0.16], radius: 0.16, screen: [1.52, 3.2] },
  tablet: { body: [3.4, 2.5, 0.14], radius: 0.14, screen: [3.18, 2.28] },
  laptop: { body: [3.6, 2.3, 0.08], radius: 0.06, screen: [3.4, 2.1] },
} as const

type DeviceKind = keyof typeof DEVICES

/** Ekran görüntüsü yokken ekranda duran temsili arayüz çubukları. */
function Placeholder({ width, height }: { width: number; height: number }) {
  const bar = (w: number, y: number, key: number, opacity = 0.85) => (
    <mesh key={key} position={[0, y, 0.003]}>
      <planeGeometry args={[w, height * 0.05]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={opacity} />
    </mesh>
  )
  return (
    <>
      {bar(width * 0.78, height * 0.28, 0)}
      {bar(width * 0.62, height * 0.17, 1)}
      {bar(width * 0.46, height * 0.06, 2)}
      <mesh position={[0, -height * 0.24, 0.003]}>
        <planeGeometry args={[width * 0.78, height * 0.3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
      </mesh>
    </>
  )
}

function Screen({ layer, texture, width, height }: { layer: Layer; texture: Texture | null; width: number; height: number }) {
  return (
    <group>
      <mesh>
        <planeGeometry args={[width, height]} />
        {texture ? <meshBasicMaterial key={texture.uuid} map={texture} toneMapped={false} /> : <meshBasicMaterial color={layer.color} toneMapped={false} />}
      </mesh>
      {!texture && <Placeholder width={width} height={height} />}
    </group>
  )
}

/** Telefon, tablet ve laptop maketleri: ekran rengi ya da ekran görüntüsü. */
export function DeviceLayer({ layer, register }: LayerProps) {
  const node = useLayerNode(layer, register)
  const screen = useImageTexture(layer.image)
  const kind = (layer.kind in DEVICES ? layer.kind : 'phone') as DeviceKind
  const d = DEVICES[kind]
  const [bw, bh, bd] = d.body
  const [sw, sh] = d.screen
  const shell = <meshStandardMaterial color="#15171c" metalness={0.7} roughness={0.25} />

  if (kind === 'laptop') {
    // Kapak hafif geriye yatık; klavye tabanı kapağın alt kenarından öne doğru uzanır.
    return (
      <group {...node}>
        <group position={[0, -bh / 2, 0]} rotation={[-0.18, 0, 0]}>
          <group position={[0, bh / 2, 0]}>
            <RoundedBox args={[bw, bh, bd]} radius={d.radius} smoothness={4}>
              {shell}
            </RoundedBox>
            <group position={[0, 0, bd / 2 + 0.002]}>
              <Screen layer={layer} texture={screen?.texture ?? null} width={sw} height={sh} />
            </group>
          </group>
        </group>
        <mesh position={[0, -bh / 2 - 0.05, 1.2]}>
          <boxGeometry args={[bw + 0.3, 0.1, 2.5]} />
          <meshStandardMaterial color="#1b1e24" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, -bh / 2 + 0.002, 1.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[bw * 0.8, 1.1]} />
          <meshStandardMaterial color="#0f1115" roughness={0.8} />
        </mesh>
      </group>
    )
  }

  return (
    <group {...node}>
      <RoundedBox args={[bw, bh, bd]} radius={d.radius} smoothness={6}>
        {shell}
      </RoundedBox>
      <group position={[0, 0, bd / 2 + 0.002]}>
        <Screen layer={layer} texture={screen?.texture ?? null} width={sw} height={sh} />
      </group>
    </group>
  )
}
