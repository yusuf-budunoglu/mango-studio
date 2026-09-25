import { Line, TransformControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, BrightnessContrast, DepthOfField, EffectComposer, HueSaturation, Noise, Vignette } from '@react-three/postprocessing'
import type { DepthOfFieldEffect } from 'postprocessing'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CanvasTexture, Color, SRGBColorSpace, Vector3, type Object3D, type PerspectiveCamera } from 'three'
import { resolveEffects, type ProjectEffects } from '../engine/effects'
import { evaluate } from '../engine/evaluate'
import { manualTransformPatch, snapToGuides } from '../engine/manualTransform'
import type { Layer, LayerState, Project } from '../engine/types'
import { exportBridge, renderTimeOverride } from '../export/bridge'
import { gizmoJustReleased, manualDrag, useEditorStore } from '../store/editorStore'
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

/**
 * Proje ayarlarından efekt zinciri. EffectComposer çocukları değişince zinciri yeniden kurar;
 * kapalı efektler hiç eklenmez (performans).
 */
function SceneEffects({ effects, dofRef }: { effects: ProjectEffects; dofRef: React.RefObject<DepthOfFieldEffect | null> }) {
  const { bloom, vignette, dof, grain, color } = effects
  const hasColor = color.saturation !== 0 || color.contrast !== 0 || color.brightness !== 0
  return (
    <EffectComposer>
      <>{dof.enabled && <DepthOfField ref={dofRef} target={[0, 0, 0]} focusRange={dof.range} bokehScale={dof.bokeh} />}</>
      <>{bloom.enabled && <Bloom intensity={bloom.intensity} luminanceThreshold={bloom.threshold} mipmapBlur />}</>
      <>{hasColor && <HueSaturation saturation={color.saturation} />}</>
      <>{hasColor && <BrightnessContrast brightness={color.brightness} contrast={color.contrast} />}</>
      <>{grain.enabled && <Noise opacity={grain.amount} premultiply />}</>
      <>{vignette.enabled && <Vignette darkness={vignette.darkness} offset={0.3} />}</>
    </EffectComposer>
  )
}

const focusTarget = new Vector3()

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
  const dofRef = useRef<DepthOfFieldEffect | null>(null)
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
    if (dofRef.current) dofRef.current.target = focusTarget.set(c.targetX, c.targetY, c.focusZ)
    camera.position.set(c.x, c.y, c.z)
    camera.lookAt(c.targetX, c.targetY, 0)
    if (camera.fov !== c.fov) {
      camera.fov = c.fov
      camera.updateProjectionMatrix()
    }
  })

  return (
    <>
      <Background project={project} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[3, 4, 5]} intensity={2} />
      <pointLight position={[-4, -2, 3]} intensity={30} color="#6c5ce7" />
      {project.layers.map((layer) => (
        <LayerNode key={layer.id} layer={layer} register={register} numberLocale={project.numberLocale} />
      ))}
      <SceneEffects effects={resolveEffects(project.effects)} dofRef={dofRef} />
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
