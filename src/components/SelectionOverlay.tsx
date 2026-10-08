import { useFrame, useThree } from '@react-three/fiber'
import { ArrowUp, LoaderCircle, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Box3, Plane, Raycaster, Vector2, Vector3, type Camera, type Object3D, type Scene } from 'three'
import { AiRequestError, buildEditRequest, requestLayerEdit, type AiFailure } from '../ai/client'
import { MAX_MESSAGE, type EditRequest } from '../ai/edit'
import { evaluate } from '../engine/evaluate'
import { manualTransformPatch, snapToGuides } from '../engine/manualTransform'
import { routeToPath } from '../router'
import { sceneLink } from '../editor/sceneLink'
import { manualDrag, useEditorStore } from '../store/editorStore'
import { usePlanStore } from '../store/planStore'
import { usePlaybackStore, useProjectStore } from '../store/projectStore'

const SNAP_THRESHOLD = 0.12
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const
/** döndürürken imlecin 1 pikseli kaç radyan (yarım derece) */
const TURN_PER_PX = Math.PI / 360
/** Shift basılıyken dönüş bu adıma yapışır (15°) */
const TURN_STEP = Math.PI / 12
const stepped = (angle: number, on: boolean) => (on ? Math.round(angle / TURN_STEP) * TURN_STEP : angle)

/**
 * Kanvas (three.js) ile HTML seçim kutusu arasındaki bağ. Kutu kanvasın üstünde ayrı bir HTML katmanı:
 * videoya ve küçük resme girmez, sürüklemesi kolaydır. Konumu her karede `SelectionTracker` yazar.
 */
const link: { camera: Camera | null; scene: Scene | null; el: HTMLDivElement | null } = { camera: null, scene: null, el: null }

const box = new Box3()
const corner = new Vector3()

/** Nesnenin ekrandaki sınır kutusu (kanvas pikseli); kameranın arkasındaysa ya da boşsa null. */
function screenRect(object: Object3D, camera: Camera, width: number, height: number) {
  box.setFromObject(object)
  if (box.isEmpty()) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).project(camera)
    if (corner.z > 1) return null
    const x = ((corner.x + 1) / 2) * width
    const y = ((1 - corner.y) / 2) * height
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Kanvasın içinde durur: seçili katmanın ekrandaki kutusunu her karede HTML seçim kutusuna yazar. */
export function SelectionTracker() {
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const size = useThree((s) => s.size)
  useFrame(() => {
    link.camera = camera
    link.scene = scene
    sceneLink.camera = camera
    sceneLink.scene = scene
    const el = link.el
    if (!el) return
    const id = el.dataset.layer
    const object = id ? scene.getObjectByName(`layer:${id}`) : undefined
    const rect = object?.visible ? screenRect(object, camera, size.width, size.height) : null
    // Önizlemeden taşan nesnede kutu görünen alana sığdırılır: kenarları ve yapay zekâ düğmesi hep görünür kalır.
    const inset = 2
    const x0 = rect ? Math.max(rect.x, inset) : 0
    const y0 = rect ? Math.max(rect.y, inset) : 0
    const x1 = rect ? Math.min(rect.x + rect.w, size.width - inset) : 0
    const y1 = rect ? Math.min(rect.y + rect.h, size.height - inset) : 0
    if (!rect || x1 - x0 < 2 || y1 - y0 < 2) {
      el.style.visibility = 'hidden'
      return
    }
    el.style.visibility = 'visible'
    el.style.transform = `translate(${x0}px, ${y0}px)`
    el.style.width = `${x1 - x0}px`
    el.style.height = `${y1 - y0}px`
    // Sağda yer yoksa yapay zekâ düğmesi kutunun içine, sağ üst köşeye alınır.
    el.classList.toggle('is-tight', size.width - x1 < 40)
  })
  return null
}

/**
 * Kutunun içinden sürükleme taşır (nesnenin derinliğinde, kameraya dik düzlemde), köşeden sürükleme ölçekler.
 * `turn`: nesneyi tutup çevirir gibi, yatay sürükleme Y ekseninde, dikey sürükleme X ekseninde döndürür.
 * `roll`: imlecin nesnenin merkezi etrafındaki açısı kadar Z ekseninde (kendi düzleminde) döndürür.
 * Bırakınca sonuç, animasyon etkisi korunarak katmanın temel değerlerine yazılır (Stage'deki tutamaçla aynı yol).
 */
function startDrag(e: ReactPointerEvent<HTMLElement>, kind: 'move' | 'scale' | 'turn' | 'roll') {
  if (e.button !== 0) return
  e.stopPropagation()
  e.preventDefault()
  const { camera, scene } = link
  const store = useProjectStore.getState()
  const project = store.project
  const layer = project.layers.find((l) => l.id === store.selectedTrackId)
  const object = layer ? scene?.getObjectByName(`layer:${layer.id}`) : undefined
  const view = (e.currentTarget as HTMLElement).closest('.stage-view')
  if (!camera || !layer || !object || !view) return

  const frame = evaluate(project, usePlaybackStore.getState().time)
  const evaluated = frame.layers[layer.id]
  const others = project.layers.filter((l) => l.id !== layer.id).map((l) => frame.layers[l.id])
  const candidates = { x: [0, ...others.map((o) => o.x)], y: [0, ...others.map((o) => o.y)] }
  const rect = view.getBoundingClientRect()
  const ndc = (x: number, y: number) => new Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1)

  const worldStart = object.getWorldPosition(new Vector3())
  const plane = new Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new Vector3()), worldStart)
  const ray = new Raycaster()
  const hitAt = (x: number, y: number) => {
    ray.setFromCamera(ndc(x, y), camera)
    return ray.ray.intersectPlane(plane, new Vector3())
  }
  const startHit = hitAt(e.clientX, e.clientY)
  const startScale = object.scale.x
  const center = worldStart.clone().project(camera)
  const centerX = rect.left + ((center.x + 1) / 2) * rect.width
  const centerY = rect.top + ((1 - center.y) / 2) * rect.height
  const startDistance = Math.max(4, Math.hypot(e.clientX - centerX, e.clientY - centerY))
  const startX = e.clientX
  const startY = e.clientY
  const startRotation = object.rotation.clone()
  const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX)
  const snapping = useEditorStore.getState().snapping
  let moved = false
  manualDrag.layerId = layer.id

  const onMove = (ev: PointerEvent) => {
    moved = true
    if (kind === 'turn') {
      object.rotation.set(stepped(startRotation.x + (ev.clientY - startY) * TURN_PER_PX, ev.shiftKey), stepped(startRotation.y + (ev.clientX - startX) * TURN_PER_PX, ev.shiftKey), startRotation.z)
      return
    }
    if (kind === 'roll') {
      // ekranda y aşağı doğru: saat yönündeki sürükleme three.js'te negatif Z dönüşü
      object.rotation.z = stepped(startRotation.z - (Math.atan2(ev.clientY - centerY, ev.clientX - centerX) - startAngle), ev.shiftKey)
      return
    }
    if (kind === 'scale') {
      object.scale.setScalar(Math.max(0.01, (startScale * Math.hypot(ev.clientX - centerX, ev.clientY - centerY)) / startDistance))
      return
    }
    const hit = hitAt(ev.clientX, ev.clientY)
    if (!hit || !startHit) return
    const target = worldStart.clone().add(hit.sub(startHit))
    const local = object.parent ? object.parent.worldToLocal(target) : target
    const snapped = snapping ? snapToGuides(local.x, local.y, candidates, SNAP_THRESHOLD) : local
    object.position.set(snapped.x, snapped.y, local.z)
  }
  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    manualDrag.layerId = null
    manualDrag.releasedAt = performance.now()
    if (!moved) return
    const patch = manualTransformPatch(layer, evaluated, {
      position: [object.position.x, object.position.y, object.position.z],
      rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
      scale: object.scale.x,
    })
    useProjectStore.getState().updateLayer(layer.id, patch)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
}

type AiNote = { text: string; tone: 'reply' | 'error'; upgrade?: boolean }

/** Hata adı → kullanıcıya gösterilen metin; plan ve kredi hatalarında yükseltme bağlantısı da çıkar. */
const AI_ERRORS: Record<AiFailure, { key: 'paidOnly' | 'noCredits' | 'messageLimit' | 'rateLimited' | 'signIn' | 'unavailable' | 'refused' | 'busy' | 'failed'; upgrade?: boolean }> = {
  plan_required: { key: 'paidOnly', upgrade: true },
  no_credits: { key: 'noCredits', upgrade: true },
  message_limit: { key: 'messageLimit' },
  rate_limited: { key: 'rateLimited' },
  signin: { key: 'signIn' },
  unauthorized: { key: 'signIn' },
  unavailable: { key: 'unavailable' },
  not_configured: { key: 'unavailable' },
  refused: { key: 'refused' },
  busy: { key: 'busy' },
  failed: { key: 'failed' },
  bad_request: { key: 'failed' },
}

/**
 * Seçili katmanı yapay zekâyla düzenleme: kutunun sağ üstündeki simge, yanında tek satırlık sohbet kutusu açar.
 * İstek Worker'daki uca gider (`ai/client.ts`); dönen düzenleme `applyLayerEdit` ile tek geri alma adımında uygulanır,
 * modelin tek cümlelik yanıtı kutunun altında görünür. Plan ve kredi sunucuda denetlenir (ücretsizde yükseltme önerir).
 */
function AiPrompt({ layerId, name }: { layerId: string; name: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<AiNote | null>(null)
  const [flip, setFlip] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  // Bu kutudaki önceki istekler: "biraz daha" gibi takip istekleri anlaşılsın diye modele gider.
  const history = useRef<EditRequest['history']>([])
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    // Önizleme alanı taşmayı gizliyor; odak onu kaydırmasın.
    if (open) input.current?.focus({ preventScroll: true })
  }, [open])

  const toggle = () => {
    // Sağda yer yoksa sohbet kutusu sola açılır (önizleme kenarında kesilmesin).
    const view = wrap.current?.closest('.stage-view')?.getBoundingClientRect()
    const own = wrap.current?.getBoundingClientRect()
    setFlip(!!view && !!own && view.right - own.right < 320)
    setOpen((o) => !o)
    setNote(null)
  }

  const send = async () => {
    const message = text.trim()
    const { project } = useProjectStore.getState()
    const layer = project.layers.find((l) => l.id === layerId)
    const request = layer && message && !busy ? buildEditRequest(project, layer, usePlaybackStore.getState().time, message, history.current) : null
    if (!request) return
    setBusy(true)
    setNote(null)
    try {
      const result = await requestLayerEdit(request)
      // Seçim bu arada değişmiş olsa da düzenleme istenen katmana uygulanır: kredisi düştü, geri alınabilir.
      if (result.edit) {
        useProjectStore.getState().applyLayerEdit(layerId, result.edit)
        usePlanStore.getState().spendCredits(1)
      }
      if (!mounted.current) return
      history.current = [...history.current, { user: message, reply: result.reply }].slice(-3)
      setText('')
      setNote({ text: result.reply || t(result.edit ? 'aiEdit.done' : 'aiEdit.noChange'), tone: 'reply' })
    } catch (err) {
      if (!mounted.current) return
      const { key, upgrade } = AI_ERRORS[err instanceof AiRequestError ? err.code : 'failed']
      setNote({ text: t(`aiEdit.${key}`), tone: 'error', upgrade })
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  return (
    <div ref={wrap} className={`sel-ai${flip ? ' is-flipped' : ''}`} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" className={`sel-ai-btn${open ? ' is-on' : ''}`} onClick={toggle} title={t('aiEdit.button')} aria-label={t('aiEdit.button')} aria-expanded={open}>
        <Sparkles size={12} strokeWidth={2.25} />
      </button>
      {open && (
        <form
          className="sel-ai-chat"
          aria-busy={busy}
          onSubmit={(e) => {
            e.preventDefault()
            void send()
          }}
        >
          <div className="sel-ai-row">
            <Sparkles size={14} strokeWidth={2} aria-hidden="true" />
            <input
              ref={input}
              value={text}
              placeholder={busy ? t('aiEdit.thinking') : t('aiEdit.placeholder', { name })}
              aria-label={t('aiEdit.button')}
              maxLength={MAX_MESSAGE}
              // yanıt beklenirken odak kutuda kalsın diye kapatmak yerine salt okunur
              readOnly={busy}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') setOpen(false)
              }}
            />
            <button type="submit" className="sel-ai-send" disabled={busy || !text.trim()} aria-label={t('aiEdit.send')}>
              {busy ? <LoaderCircle className="sel-ai-spin" size={14} strokeWidth={2.5} /> : <ArrowUp size={14} strokeWidth={2.5} />}
            </button>
          </div>
          {note && (
            <p className={`sel-ai-note is-${note.tone}`} role="status">
              {note.text}
              {note.upgrade && (
                <>
                  {' '}
                  <a href={routeToPath({ screen: 'pricing' })}>{t('aiEdit.upgrade')}</a>
                </>
              )}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

/**
 * Önizlemedeki seçili katmanın mavi düzenleme kutusu: taşı, köşelerden ölçekle, sağ üstte yapay zekâ.
 * Üstteki yuvarlak tutamaç her modda nesneyi X/Y ekseninde çevirir. Döndürme aracı (E) seçiliyken kutunun içi de
 * çevirir, köşeler Z ekseninde döndürür.
 */
export function SelectionOverlay() {
  const layers = useProjectStore((s) => s.project.layers)
  const selectedId = useProjectStore((s) => s.selectedTrackId)
  const isPlaying = usePlaybackStore((s) => s.isPlaying)
  const clean = useEditorStore((s) => s.cleanRenders > 0)
  const rotating = useEditorStore((s) => s.transformMode === 'rotate')
  const { t } = useTranslation()
  const layer = layers.find((l) => l.id === selectedId)
  if (!layer || layer.locked || layer.hidden || isPlaying || clean) return null

  return (
    <div
      key={layer.id}
      ref={(el) => {
        link.el = el
      }}
      className={`sel-box${rotating ? ' is-rotate' : ''}`}
      data-layer={layer.id}
      onPointerDown={(e) => startDrag(e, rotating ? 'turn' : 'move')}
    >
      {CORNERS.map((c) => (
        <span key={c} className={`sel-handle sel-handle--${c}`} onPointerDown={(e) => startDrag(e, rotating ? 'roll' : 'scale')} />
      ))}
      <span className="sel-handle sel-handle--turn" title={t('editor.tools.turn')} onPointerDown={(e) => startDrag(e, 'turn')} />
      <AiPrompt key={layer.id} layerId={layer.id} name={layer.name} />
    </div>
  )
}
