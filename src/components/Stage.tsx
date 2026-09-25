import { Line, RoundedBox, Text, TransformControls } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SRGBColorSpace, TextureLoader, type Group, type Material, type Mesh, type Object3D, type PerspectiveCamera, type Texture } from 'three'
import { displayText, evaluate } from '../engine/evaluate'
import { manualTransformPatch, snapToGuides } from '../engine/manualTransform'
import type { Layer, LayerState, Project } from '../engine/types'
import { exportBridge, pendingTextSyncs, renderTimeOverride } from '../export/bridge'
import { resolveAssetUrl } from '../persistence/assets'
import { fontUrl } from '../render/fonts'
import { gizmoJustReleased, manualDrag, useEditorStore } from '../store/editorStore'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

// troika-three-text'in (drei <Text>) tipleri yok; kullandığımız alanları tanımlıyoruz.
interface TroikaText extends Mesh {
  text: string
  fillOpacity: number
  sync: (callback?: () => void) => void
}

type Applier = (state: LayerState) => void
type Register = (id: string, fn: Applier) => void

/**
 * Katman sırası ve görünürlüğü: listede üstteki katman aynı derinlikte önde çizilir
 * (renderOrder), gizli katman hiç çizilmez. Troika metni sonradan eklediği için her karede uygulanır.
 */
function applyLayerOrder(group: Object3D, order: number, hidden: boolean) {
  if (hidden) group.visible = false
  group.traverse((o) => {
    o.renderOrder = order
  })
}

function applyTransform(group: Group, s: LayerState, layerId: string) {
  group.visible = s.opacity > 0.001 && s.scale > 0.001
  // Elle sürüklenen katmanın konumunu sürükleme bitene kadar tutamaç belirler.
  if (manualDrag.layerId === layerId) return
  group.position.set(s.x, s.y, s.z)
  group.rotation.set(s.rotX, s.rotY, s.rotZ)
  group.scale.setScalar(Math.max(0.0001, s.scale))
}

/**
 * Önizlemede tıklayınca katmanı seçer. Görünmeyen katman tıklamayı arkasındakine bırakır;
 * kilitli katman önizlemeden seçilmez (listeden seçilebilir).
 */
function selectOnClick(layer: Layer) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (!e.eventObject.visible || layer.locked) return
    e.stopPropagation()
    useProjectStore.getState().selectTrack(layer.id)
  }
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
    // url bir data/http adresi ya da dosya deposu referansı (asset:<id>) olabilir.
    void resolveAssetUrl(url).then((src) => {
      if (!alive || !src) return
      new TextureLoader().load(src, (texture) => {
        texture.colorSpace = SRGBColorSpace
        const img = texture.image as { width: number; height: number }
        if (alive) setLoaded({ url, texture, aspect: img.width / img.height })
        else texture.dispose()
      })
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
      applyTransform(group.current, s, layer.id)
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
    <group ref={group} name={`layer:${layer.id}`} onClick={selectOnClick(layer)}>
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
      applyTransform(group.current, s, layer.id)
      applyOpacity(group.current, s.opacity)
    })
  })

  return (
    <group ref={group} name={`layer:${layer.id}`} onClick={selectOnClick(layer)}>
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
      applyTransform(group.current, s, layer.id)
      applyOpacity(group.current, s.opacity)
    })
  })

  return (
    <group ref={group} name={`layer:${layer.id}`} onClick={selectOnClick(layer)}>
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
      applyTransform(group.current, s, layer.id)
      applyOpacity(group.current, s.opacity)
    })
  })
  return (
    <group ref={group} name={`layer:${layer.id}`} onClick={selectOnClick(layer)}>
      <RoundedBox args={[1, 1, 0.2]} radius={0.1}>
        <meshStandardMaterial color={layer.color} />
      </RoundedBox>
    </group>
  )
}

const SNAP_THRESHOLD = 0.12
/** Tutamaç ve kılavuzların toplandığı grup; tek karelik yakalamalarda gizlenir. */
const EDITOR_HELPERS = 'editor-helpers'
const GUIDE_COLOR = '#ff4fd8'

/**
 * Seçili katmana taşı / döndür / ölçekle tutamacı. Bırakınca sonuç, animasyon etkisi
 * korunarak katmanın temel değerlerine yazılır (manualTransformPatch).
 */
function LayerGizmo({ project }: { project: Project }) {
  const selectedId = useProjectStore((s) => s.selectedTrackId)
  const mode = useEditorStore((s) => s.transformMode)
  const snapping = useEditorStore((s) => s.snapping)
  const clean = useEditorStore((s) => s.cleanRenders > 0)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const scene = useThree((s) => s.scene)
  const [target, setTarget] = useState<Object3D | null>(null)
  // three.js nesneleri değiştirilebilir; tutamaç işlemleri nesneyi her seferinde sahneden bulur.
  const object = () => (layer ? scene.getObjectByName(`layer:${layer.id}`) : undefined)
  const [guides, setGuides] = useState<{ x: number | null; y: number | null; z: number } | null>(null)
  const drag = useRef<{ layer: Layer; evaluated: LayerState; candidates: { x: number[]; y: number[] } } | null>(null)
  const layer = project.layers.find((l) => l.id === selectedId)

  // Katmanın three.js nesnesi React çiziminden sonra oluşur; o yüzden efektte bulunur.
  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect -- three.js sahnesiyle eşitleme: nesne ancak çizimden sonra var.
    setTarget(layer ? (scene.getObjectByName(`layer:${layer.id}`) ?? null) : null)
  }, [layer, scene])

  if (!layer || !target || clean || isPlaying || layer.locked || layer.hidden) return null

  const onStart = () => {
    const frame = evaluate(project, usePlaybackStore.getState().time)
    const others = project.layers.filter((l) => l.id !== layer.id).map((l) => frame.layers[l.id])
    drag.current = {
      layer,
      evaluated: frame.layers[layer.id],
      // Yapışma çizgileri: ekran ortası ve diğer katmanların o anki konumları.
      candidates: { x: [0, ...others.map((o) => o.x)], y: [0, ...others.map((o) => o.y)] },
    }
    manualDrag.layerId = layer.id
  }

  const onChange = () => {
    const d = drag.current
    const obj = object()
    if (!d || !obj) return
    if (mode === 'scale') obj.scale.setScalar(Math.max(0.01, obj.scale.x))
    if (mode === 'translate' && snapping) {
      const snapped = snapToGuides(obj.position.x, obj.position.y, d.candidates, SNAP_THRESHOLD)
      obj.position.x = snapped.x
      obj.position.y = snapped.y
      setGuides(snapped.guideX !== null || snapped.guideY !== null ? { x: snapped.guideX, y: snapped.guideY, z: obj.position.z } : null)
    }
  }

  const onEnd = () => {
    const d = drag.current
    drag.current = null
    manualDrag.layerId = null
    manualDrag.releasedAt = performance.now()
    setGuides(null)
    const obj = object()
    if (!d || !obj) return
    const patch = manualTransformPatch(d.layer, d.evaluated, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: obj.scale.x,
    })
    useProjectStore.getState().updateLayer(d.layer.id, patch)
  }

  return (
    <group name={EDITOR_HELPERS}>
      <TransformControls
        object={target}
        mode={mode}
        size={0.8}
        rotationSnap={snapping ? Math.PI / 12 : null}
        showY={mode !== 'scale'}
        showZ={mode !== 'scale'}
        onMouseDown={onStart}
        onObjectChange={onChange}
        onMouseUp={onEnd}
      />
      {guides?.x != null && <Line points={[[guides.x, -20, guides.z], [guides.x, 20, guides.z]]} color={GUIDE_COLOR} lineWidth={1} dashed dashSize={0.1} gapSize={0.06} />}
      {guides?.y != null && <Line points={[[-40, guides.y, guides.z], [40, guides.y, guides.z]]} color={GUIDE_COLOR} lineWidth={1} dashed dashSize={0.1} gapSize={0.06} />}
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
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  // Otomatik tarayıcı testleri için sahneye erişim (sadece geliştirmede).
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __r3f: { scene, camera, canvas: gl.domElement } })
  }, [scene, camera, gl])

  useEffect(() => {
    exportBridge.current = {
      canvas: gl.domElement,
      begin: (width, height) => {
        const previous = { width: size.width, height: size.height, dpr: viewport.dpr }
        // Tutamaç ve kılavuzlar videoya girmesin.
        useEditorStore.getState().beginCleanRender()
        setFrameloop('never')
        setDpr(1)
        setSize(width, height)
        return () => {
          setDpr(previous.dpr)
          setSize(previous.width, previous.height)
          setFrameloop('always')
          useEditorStore.getState().endCleanRender()
        }
      },
      renderFrame: () => advance(performance.now()),
      setHelpersVisible: (visible) => {
        const helpers = scene.getObjectByName(EDITOR_HELPERS)
        if (helpers) helpers.visible = visible
      },
    }
    return () => {
      exportBridge.current = null
    }
  }, [gl, advance, setFrameloop, setSize, setDpr, size, viewport.dpr, scene])

  return null
}

function Scene({ project }: { project: Project }) {
  const appliers = useRef(new Map<string, Applier>())
  const groups = useRef(new Map<string, Object3D>())
  const scene = useThree((s) => s.scene)
  const register: Register = (id, fn) => {
    appliers.current.set(id, fn)
    const group = scene.getObjectByName(`layer:${id}`)
    if (group) groups.current.set(id, group)
  }

  // Her karede: zamanı oku → motoru çalıştır → sonucu nesnelere uygula.
  // React yeniden çizilmez; sadece three.js nesneleri güncellenir.
  useFrame((state) => {
    const camera = state.camera as PerspectiveCamera
    const frame = evaluate(project, renderTimeOverride.current ?? usePlaybackStore.getState().time)
    project.layers.forEach((layer, index) => {
      appliers.current.get(layer.id)?.(frame.layers[layer.id])
      const group = groups.current.get(layer.id)
      if (group) applyLayerOrder(group, project.layers.length - index, !!layer.hidden)
    })
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
      <LayerGizmo project={project} />
      <ExportBridge />
    </>
  )
}

export function Stage() {
  const project = useProjectStore((s) => s.project)
  const showGuides = useEditorStore((s) => s.showGuides)
  return (
    <div className="stage" style={{ aspectRatio: `${project.width} / ${project.height}` }}>
      <Canvas
        camera={{ position: project.camera.position, fov: project.camera.fov }}
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={(e) => {
          // Boşluğa tıklamak seçimi kaldırır; tutamaç sürüklemesinin sonundaki tıklama hariç.
          if (e.type === 'click' && !gizmoJustReleased()) useProjectStore.getState().selectTrack('')
        }}
      >
        <Scene project={project} />
      </Canvas>
      {showGuides && (
        // Güvenli alanlar: %90 (hareket) ve %80 (metin). HTML katmanı, videoya girmez.
        <div className="safe-guides" aria-hidden="true">
          <div className="safe-action" />
          <div className="safe-title" />
          <div className="safe-center" />
        </div>
      )}
    </div>
  )
}
