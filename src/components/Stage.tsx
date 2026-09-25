import { RoundedBox, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SRGBColorSpace, TextureLoader, type Group, type Material, type Mesh, type PerspectiveCamera, type Texture } from 'three'
import { displayText, evaluate } from '../engine/evaluate'
import type { Layer, LayerState, Project } from '../engine/types'
import { exportBridge, pendingTextSyncs, renderTimeOverride } from '../export/bridge'
import { fontUrl } from '../render/fonts'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

// troika-three-text'in (drei <Text>) tipleri yok; kullandığımız alanları tanımlıyoruz.
interface TroikaText extends Mesh {
  text: string
  fillOpacity: number
  sync: (callback?: () => void) => void
}

type Applier = (state: LayerState) => void
type Register = (id: string, fn: Applier) => void

function applyTransform(group: Group, s: LayerState) {
  group.position.set(s.x, s.y, s.z)
  group.rotation.set(s.rotX, s.rotY, s.rotZ)
  group.scale.setScalar(Math.max(0.0001, s.scale))
  group.visible = s.opacity > 0.001 && s.scale > 0.001
}

/** Grubun tüm malzemelerinin opaklığını, her malzemenin kendi temel opaklığıyla çarparak ayarlar. */
function applyOpacity(group: Group, opacity: number) {
  group.traverse((obj) => {
    const material = (obj as Mesh).material as Material | undefined
    if (!material) return
    const base = (material.userData.baseOpacity ??= material.opacity) as number
    material.transparent = true
    material.opacity = base * opacity
  })
}

function useImageTexture(url: string | undefined) {
  const [loaded, setLoaded] = useState<{ url: string; texture: Texture; aspect: number } | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
    new TextureLoader().load(url, (texture) => {
      texture.colorSpace = SRGBColorSpace
      const img = texture.image as { width: number; height: number }
      if (alive) setLoaded({ url, texture, aspect: img.width / img.height })
      else texture.dispose()
    })
    return () => {
      alive = false
    }
  }, [url])
  useEffect(() => () => loaded?.texture.dispose(), [loaded])
  return url && loaded?.url === url ? loaded : null
}

function TextLayer({ layer, register, numberLocale }: { layer: Layer; register: Register; numberLocale?: string }) {
  const group = useRef<Group>(null)
  const text = useRef<TroikaText>(null)

  useLayoutEffect(() => {
    register(layer.id, (s) => {
      if (!group.current || !text.current) return
      applyTransform(group.current, s)
      const str = displayText(layer, s, numberLocale)
      text.current.fillOpacity = s.opacity
      if (text.current.text !== str) {
        text.current.text = str
        // Metin bir worker'da hazırlanır; video çıktısı kareyi yakalamadan önce bunu bekler.
        // troika sadece metin değiştiğinde geri çağırır; yine de takılmasın diye süre sınırı var.
        const mesh = text.current
        const done = new Promise<void>((resolve) => {
          mesh.sync(resolve)
          setTimeout(resolve, 2000)
        })
        pendingTextSyncs.add(done)
        void done.then(() => pendingTextSyncs.delete(done))
      }
    })
  })

  return (
    <group ref={group}>
      <Text
        ref={text}
        font={fontUrl(layer.fontFamily, layer.fontWeight)}
        fontSize={layer.fontSize ?? 0.4}
        color={layer.color}
        anchorX={layer.align ?? 'center'}
        textAlign={layer.align ?? 'center'}
        anchorY="middle"
        maxWidth={layer.textWidth ?? 5}
        letterSpacing={layer.letterSpacing ?? 0}
        lineHeight={layer.lineHeight ?? 1.2}
      >
        {layer.text ?? ''}
      </Text>
    </group>
  )
}

function PhoneLayer({ layer, register }: { layer: Layer; register: Register }) {
  const group = useRef<Group>(null)
  const screen = useImageTexture(layer.image)

  useLayoutEffect(() => {
    register(layer.id, (s) => {
      if (!group.current) return
      applyTransform(group.current, s)
      applyOpacity(group.current, s.opacity)
    })
  })

  return (
    <group ref={group}>
      <RoundedBox args={[1.7, 3.4, 0.16]} radius={0.16} smoothness={6}>
        <meshStandardMaterial color="#15171c" metalness={0.7} roughness={0.25} />
      </RoundedBox>
      <mesh position={[0, 0, 0.082]}>
        <planeGeometry args={[1.52, 3.2]} />
        {screen ? (
          <meshBasicMaterial key={screen.url} map={screen.texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color={layer.color} toneMapped={false} />
        )}
      </mesh>
      {!screen && (
        <>
          {[0.9, 0.55, 0.2].map((y, i) => (
            <mesh key={y} position={[0, y, 0.085]}>
              <planeGeometry args={[1.2 - i * 0.25, 0.16]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.85} />
            </mesh>
          ))}
          <mesh position={[0, -0.8, 0.085]}>
            <planeGeometry args={[1.2, 0.9]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.25} />
          </mesh>
        </>
      )}
    </group>
  )
}

function ImageLayer({ layer, register }: { layer: Layer; register: Register }) {
  const group = useRef<Group>(null)
  const image = useImageTexture(layer.image)
  const width = 3
  const height = image ? width / image.aspect : width * 0.6

  useLayoutEffect(() => {
    register(layer.id, (s) => {
      if (!group.current) return
      applyTransform(group.current, s)
      applyOpacity(group.current, s.opacity)
    })
  })

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[width, height]} />
        {image ? (
          <meshBasicMaterial key={image.url} map={image.texture} toneMapped={false} />
        ) : (
          <meshBasicMaterial color="#2a303a" />
        )}
      </mesh>
    </group>
  )
}

function ShapeLayer({ layer, register }: { layer: Layer; register: Register }) {
  const group = useRef<Group>(null)
  useLayoutEffect(() => {
    register(layer.id, (s) => {
      if (!group.current) return
      applyTransform(group.current, s)
      applyOpacity(group.current, s.opacity)
    })
  })
  return (
    <group ref={group}>
      <RoundedBox args={[1, 1, 0.2]} radius={0.1}>
        <meshStandardMaterial color={layer.color} />
      </RoundedBox>
    </group>
  )
}

/** Video çıktısının sahneyi kare kare, istenen çözünürlükte çizmesini sağlar. */
function ExportBridge() {
  const gl = useThree((s) => s.gl)
  const advance = useThree((s) => s.advance)
  const setFrameloop = useThree((s) => s.setFrameloop)
  const setSize = useThree((s) => s.setSize)
  const setDpr = useThree((s) => s.setDpr)
  const size = useThree((s) => s.size)
  const viewport = useThree((s) => s.viewport)

  useEffect(() => {
    exportBridge.current = {
      canvas: gl.domElement,
      begin: (width, height) => {
        const previous = { width: size.width, height: size.height, dpr: viewport.dpr }
        setFrameloop('never')
        setDpr(1)
        setSize(width, height)
        return () => {
          setDpr(previous.dpr)
          setSize(previous.width, previous.height)
          setFrameloop('always')
        }
      },
      renderFrame: () => advance(performance.now()),
    }
    return () => {
      exportBridge.current = null
    }
  }, [gl, advance, setFrameloop, setSize, setDpr, size, viewport.dpr])

  return null
}

function Scene({ project }: { project: Project }) {
  const appliers = useRef(new Map<string, Applier>())
  const register: Register = (id, fn) => {
    appliers.current.set(id, fn)
  }

  // Her karede: zamanı oku → motoru çalıştır → sonucu nesnelere uygula.
  // React yeniden çizilmez; sadece three.js nesneleri güncellenir.
  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera
    const frame = evaluate(project, renderTimeOverride.current ?? usePlaybackStore.getState().time)
    for (const layer of project.layers) appliers.current.get(layer.id)?.(frame.layers[layer.id])
    const c = frame.camera
    camera.position.set(c.x, c.y, c.z)
    camera.lookAt(c.targetX, c.targetY, 0)
    if (camera.fov !== c.fov) {
      camera.fov = c.fov
      camera.updateProjectionMatrix()
    }
  })

  return (
    <>
      <color attach="background" args={[project.background]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <pointLight position={[-4, -2, 3]} intensity={30} color="#6c5ce7" />
      {project.layers.map((layer) => {
        if (layer.kind === 'text')
          return (
            // Font yüklenirken sadece bu katman beklesin, tüm sahne değil.
            <Suspense key={layer.id} fallback={null}>
              <TextLayer layer={layer} register={register} numberLocale={project.numberLocale} />
            </Suspense>
          )
        if (layer.kind === 'phone') return <PhoneLayer key={layer.id} layer={layer} register={register} />
        if (layer.kind === 'image') return <ImageLayer key={layer.id} layer={layer} register={register} />
        return <ShapeLayer key={layer.id} layer={layer} register={register} />
      })}
      <EffectComposer>
        <Bloom intensity={0.7} luminanceThreshold={0.6} mipmapBlur />
        <Vignette darkness={0.55} offset={0.3} />
      </EffectComposer>
      <ExportBridge />
    </>
  )
}

export function Stage() {
  const project = useProjectStore((s) => s.project)
  return (
    <div className="stage" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
      <Canvas
        camera={{ position: project.camera.position, fov: project.camera.fov }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
      >
        <Scene project={project} />
      </Canvas>
    </div>
  )
}
