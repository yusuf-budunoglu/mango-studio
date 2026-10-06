import { useLayerNode, type LayerProps } from './shared'
import { useVideoFrames } from './videoFrames'

/** Video klip katmanı: video, klibe eşlenmiş bir kanvas dokusundan düz bir yüzeye çizilir (`useVideoFrames`). */
export function VideoLayer({ layer, register }: LayerProps) {
  const { view, tick } = useVideoFrames(layer, layer.media)
  const node = useLayerNode(layer, register, tick)

  const width = 3
  const height = view ? width / view.aspect : width * 0.5625
  return (
    <group {...node}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {view ? <meshBasicMaterial key={view.texture.uuid} map={view.texture} toneMapped={false} /> : <meshBasicMaterial color="#2a303a" />}
      </mesh>
    </group>
  )
}
