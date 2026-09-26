import { Environment, Lightformer, Line, TransformControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, Noise, Vignette, wrapEffect } from '@react-three/postprocessing'
import { BlendFunction, EffectPass, type DepthOfFieldEffect } from 'postprocessing'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Color, DoubleSide, PMREMGenerator, SRGBColorSpace, Vector3, type Mesh, type MeshBasicMaterial, type Object3D, type PerspectiveCamera } from 'three'
import { lensFrame, lensPasses, resolveEffects, type ProjectEffects } from '../engine/effects'
import { evaluate } from '../engine/evaluate'
import { manualTransformPatch, snapToGuides } from '../engine/manualTransform'
import type { Layer, LayerState, Project } from '../engine/types'
import * as bridgeModule from '../export/bridge'
import { exportBridge, renderTimeOverride } from '../export/bridge'
import { gizmoJustReleased, manualDrag, useEditorStore } from '../store/editorStore'
import { overscanFov, previewFrame, previewView } from '../editor/previewFrame'
import { FlareEffect, LensEffect, LightLeakEffect } from '../render/lensEffects'
import { LayerNode } from './layers/LayerNode'
import { applyLayerOrder, type Applier, type Register } from './layers/shared'
import { useProjectStore, usePlaybackStore } from '../store/projectStore'

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

const Flare = wrapEffect(FlareEffect, { blendFunction: BlendFunction.NORMAL, opacity: 1 })
const LightLeak = wrapEffect(LightLeakEffect, { blendFunction: BlendFunction.NORMAL, opacity: 1 })

/**
 * Lens bükülmesi ve renk kayması kendi geçişinde çalışır: aynı geçişe birleşince postprocessing
 * efektleri özelliklerine göre yeniden sıralıyor ve lens, alan derinliğinin önüne geçip onun
 * tarafından siliniyordu. Ayrı geçiş, önceki efektlerin bitmiş görüntüsünü okur.
 */
function LensPass({ ref }: { ref: React.Ref<LensEffect> }) {
  const camera = useThree((s) => s.camera)
  const [effect] = useState(() => new LensEffect())
  const pass = useMemo(() => new EffectPass(camera, effect), [camera, effect])
  useImperativeHandle(ref, () => effect, [effect])
  useEffect(() => () => pass.dispose(), [pass])
  return <primitive object={pass} dispose={null} />
}

interface EffectRefs {
  dofRef: React.RefObject<DepthOfFieldEffect | null>
  lensRef: React.RefObject<LensEffect | null>
  flareRef: React.RefObject<FlareEffect | null>
  sweepRef: React.RefObject<FlareEffect | null>
  leakRef: React.RefObject<LightLeakEffect | null>
}

/**
 * Proje ayarlarından efekt zinciri. EffectComposer çocukları değişince zinciri yeniden kurar;
 * kapalı efektler hiç eklenmez (performans).
 */
function SceneEffects({ effects, passes, dofRef, lensRef, flareRef, sweepRef, leakRef }: { effects: ProjectEffects; passes: ReturnType<typeof lensPasses> } & EffectRefs) {
  const { bloom, vignette, dof, grain, color } = effects
  const hasColor = color.saturation !== 0 || color.contrast !== 0 || color.brightness !== 0
  // Alan derinliği derinlik dokusu ister; açıkken zincire geçiş eklenip çıkarılınca (ya da kendisi
  // açılıp kapanınca) zincir baştan kurulmazsa çizim donuyor (glBlitFramebuffer derinlik biçimi hatası).
  // Bu yüzden hangi efektlerin açık olduğu key'e girer; ayar değerleri girmez.
  const chainKey = [dof.enabled, bloom.enabled, hasColor, grain.enabled, vignette.enabled, passes.lens, passes.flare, passes.sweep, passes.leak].map(Number).join('')
  // Sıra: ışık ekleyenler (parlama, sızma) → renk → lens (bükülme ve renk kayması tüm görüntüye) → gren → vinyet.
  return (
    <EffectComposer key={chainKey}>
      <>{dof.enabled && <DepthOfField ref={dofRef} target={[0, 0, 0]} focusRange={dof.range} bokehScale={dof.bokeh} />}</>
      <>{bloom.enabled && <Bloom intensity={bloom.intensity} luminanceThreshold={bloom.threshold} mipmapBlur />}</>
      <>{passes.leak && <LightLeak ref={leakRef} />}</>
      <>{passes.flare && <Flare ref={flareRef} />}</>
      <>{passes.sweep && <Flare ref={sweepRef} />}</>
      <>{hasColor && <HueSaturation saturation={color.saturation} />}</>
      <>{hasColor && <BrightnessContrast brightness={color.brightness} contrast={color.contrast} />}</>
      <>{passes.lens && <LensPass ref={lensRef} />}</>
      <>{grain.enabled && <Noise opacity={grain.amount} premultiply />}</>
      <>{vignette.enabled && <Vignette darkness={vignette.darkness} offset={0.3} />}</>
    </EffectComposer>
  )
}

const focusTarget = new Vector3()

/**
 * Metal ve cam yüzeyler için yansıma ortamı. Kodla üretilen bir oda sahnesinden oluşturulur;
 * internetten HDR dosyası indirmez (drei'nin hazır ortamları CDN'den çeker).
 */
function StudioEnvironment() {
  const gl = useThree((s) => s.gl)
  const texture = useMemo(() => {
    const pmrem = new PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()
    return env
  }, [gl])
  useEffect(() => () => texture.dispose(), [texture])
  return <Environment map={texture} environmentIntensity={0.55} />
}

/**
 * Ürün çekimi stüdyosu: ortam, kodla yerleştirilen softbox/şerit ışıklardan oluşur (CDN yok).
 * Metal kasa ve camda parlak şerit yansımalar, arkadan gelen kenar ışıkları siluet çizer.
 */
function ProductStudio({ accent }: { accent: string }) {
  return (
    <>
      <Environment resolution={256} frames={1} environmentIntensity={1}>
        {/* tepe softbox'ları */}
        <Lightformer intensity={2.5} rotation-x={Math.PI / 2} position={[0, 5, -6]} scale={[10, 1.2, 1]} />
        <Lightformer intensity={2.5} rotation-x={Math.PI / 2} position={[0, 5, -2]} scale={[10, 1.2, 1]} />
        <Lightformer intensity={1.5} rotation-x={Math.PI / 2} position={[0, 5, 2]} scale={[10, 1.2, 1]} />
        {/* yan şeritler: kasa kenarında uzun parlama */}
        <Lightformer intensity={4} rotation-y={Math.PI / 2} position={[-12, 1, 0]} scale={[30, 1.5, 1]} />
        <Lightformer intensity={3} rotation-y={-Math.PI / 2} position={[12, 1, 0]} scale={[30, 1.5, 1]} />
        {/* öndeki büyük yumuşak ışık ve halka */}
        <Lightformer form="rect" intensity={0.8} position={[0, 0, 12]} scale={[12, 6, 1]} />
        <Lightformer form="ring" intensity={6} scale={3} position={[8, 6, 8]} onUpdate={(self) => self.lookAt(0, 0, 0)} />
      </Environment>
      <ambientLight intensity={0.15} />
      {/* ana ışık ve arkadan iki kenar ışığı */}
      <directionalLight position={[-3, 5, 6]} intensity={1.6} />
      <directionalLight position={[-6, 3, -6]} intensity={3} />
      <directionalLight position={[6, -2, -5]} intensity={2.2} />
      <pointLight position={[-4, -2, 3]} intensity={18} color={accent} />
    </>
  )
}

/** Arka plan: düz renk ya da iki renkli (doğrusal / merkezden) degrade; ekran boyunca sabit. */
function Background({ project }: { project: Project }) {
  const { background, background2, backgroundStyle = 'solid' } = project
  const texture = useMemo(() => {
    if (backgroundStyle === 'solid' || !background2) return null
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const gradient =
      backgroundStyle === 'radial'
        ? ctx.createRadialGradient(256, 256, 0, 256, 256, 362)
        : ctx.createLinearGradient(0, 0, 0, 512)
    gradient.addColorStop(0, backgroundStyle === 'radial' ? background2 : background)
    gradient.addColorStop(1, backgroundStyle === 'radial' ? background : background2)
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 512, 512)
    const t = new CanvasTexture(canvas)
    t.colorSpace = SRGBColorSpace
    return t
  }, [background, background2, backgroundStyle])

  const color = useMemo(() => new Color(background), [background])
  useEffect(() => () => texture?.dispose(), [texture])
  return <primitive attach="background" object={texture ?? color} />
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
    // __bridge: tek kare çizimi (sahnenin kullandığı modül örneği; HMR'de başka kopya olabiliyor)
    if (import.meta.env.DEV) Object.assign(window, { __r3f: { scene, camera, canvas: gl.domElement }, __bridge: bridgeModule })
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
  const dofRef = useRef<DepthOfFieldEffect | null>(null)
  const effects = resolveEffects(project.effects)
  const dofBokeh = effects.dof.bokeh
  const passes = lensPasses(effects, project)
  const lensRef = useRef<LensEffect | null>(null)
  const flareRef = useRef<FlareEffect | null>(null)
  const sweepRef = useRef<FlareEffect | null>(null)
  const leakRef = useRef<LightLeakEffect | null>(null)
  const overlayRef = useRef<Mesh>(null)
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
    // Alan derinliği: netlik düzlemi kamera satırındaki odak animasyonunu izler.
    if (dofRef.current) {
      dofRef.current.target = focusTarget.set(c.targetX, c.targetY, c.focusZ)
      dofRef.current.bokehScale = dofBokeh * c.focusBlur
    }
    const lens = lensFrame(effects, c, frame.time)
    lensRef.current?.setValues(lens)
    flareRef.current?.setValues(lens.flare)
    sweepRef.current?.setValues(lens.sweep)
    leakRef.current?.setValues(lens.leak)
    camera.position.set(c.x, c.y, c.z)
    camera.lookAt(c.targetX, c.targetY, 0)
    // Önizlemede kadraj dışı da görünsün diye açı genişler (kadraj içi aynı kalır); video çıktısında
    // ve temiz çizimlerde (cleanRenders) genişleme yok.
    const k = useEditorStore.getState().cleanRenders > 0 ? 1 : previewView.k
    const fov = overscanFov(c.fov, k)
    if (Math.abs(camera.fov - fov) > 1e-6) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    // Geçiş örtüsü: kameranın hemen önünde, görüş alanını tam kaplayan düz renk.
    const overlay = overlayRef.current
    if (overlay) {
      overlay.visible = c.overlayOpacity > 0.001
      if (overlay.visible) {
        const distance = camera.near * 2
        const height = 2 * distance * Math.tan((camera.fov * Math.PI) / 360) * 1.05
        overlay.position.copy(camera.position)
        overlay.quaternion.copy(camera.quaternion)
        overlay.translateZ(-distance)
        overlay.scale.set(height * camera.aspect, height, 1)
        const material = overlay.material as MeshBasicMaterial
        material.opacity = c.overlayOpacity
        material.color.setScalar(c.overlayWhite)
      }
    }
  })

  return (
    <>
      <Background project={project} />
      {project.lighting === 'studio' ? (
        <ProductStudio accent={project.accentLight ?? '#6c5ce7'} />
      ) : (
        <>
          <StudioEnvironment />
          <ambientLight intensity={0.5} />
          <directionalLight position={[3, 4, 5]} intensity={2} />
          <pointLight position={[-4, -2, 3]} intensity={30} color={project.accentLight ?? '#6c5ce7'} />
        </>
      )}
      {project.layers.map((layer) => (
        <LayerNode key={layer.id} layer={layer} register={register} numberLocale={project.numberLocale} />
      ))}
      {/* Geçiş örtüsü. three.js önce grup sırasına bakar ve katman gruplarının sırası var; örtü en sonda
          çizilsin diye kendisi de en yüksek sıralı bir grubun içinde. */}
      <group renderOrder={100000}>
        <mesh ref={overlayRef} visible={false} renderOrder={100000} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#000000" transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} side={DoubleSide} />
        </mesh>
      </group>
      <SceneEffects effects={effects} passes={passes} dofRef={dofRef} lensRef={lensRef} flareRef={flareRef} sweepRef={sweepRef} leakRef={leakRef} />
      <LayerGizmo project={project} />
      <ExportBridge />
    </>
  )
}

/** Önizleme alanının boyutu (kadraj dikdörtgenini hesaplamak için). */
function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, ...size }
}

export function Stage() {
  const project = useProjectStore((s) => s.project)
  const showGuides = useEditorStore((s) => s.showGuides)
  const showOverscan = useEditorStore((s) => s.showOverscan)
  const { ref, width, height } = useElementSize()
  const frame = previewFrame(width, height, project.width / project.height, showOverscan)
  const measured = width > 0 && height > 0
  // sahne her karede okur; küçük resim bu bölgeden kırpılır
  useEffect(() => {
    previewView.k = measured ? frame.k : 1
    previewView.frame = measured ? { x: frame.x / width, y: frame.y / height, w: frame.w / width, h: frame.h / height } : { x: 0, y: 0, w: 1, h: 1 }
  }, [measured, frame.k, frame.x, frame.y, frame.w, frame.h, width, height])
  return (
    <div ref={ref} className={`stage${showOverscan ? ' is-overscan' : ''}`}>
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
      {/* Video kadrajı: dışı karartılır (taşma kapalıyken tamamen örtülür). HTML katmanı, videoya girmez. */}
      <div className="stage-frame" style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }} aria-hidden="true">
        {showGuides && (
          // Güvenli alanlar: %90 (hareket) ve %80 (metin).
          <div className="safe-guides">
            <div className="safe-action" />
            <div className="safe-title" />
            <div className="safe-center" />
          </div>
        )}
      </div>
    </div>
  )
}
