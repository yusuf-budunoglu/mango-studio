import type { ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SRGBColorSpace, TextureLoader, type Group, type Material, type Mesh, type Object3D, type Texture } from 'three'
import type { Layer, LayerState } from '../../engine/types'
import { resolveAssetUrl } from '../../persistence/assets'
import { manualDrag } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

export type Applier = (state: LayerState) => void
export type Register = (id: string, fn: Applier) => void

export interface LayerProps {
  layer: Layer
  register: Register
  numberLocale?: string
}

/**
 * Katman sırası ve görünürlüğü: listede üstteki katman aynı derinlikte önde çizilir
 * (renderOrder), gizli katman hiç çizilmez. Troika metni sonradan eklediği için her karede uygulanır.
 */
export function applyLayerOrder(group: Object3D, order: number, hidden: boolean) {
  if (hidden) group.visible = false
  group.traverse((o) => {
    o.renderOrder = order
  })
}

export function applyTransform(group: Group, s: LayerState, layerId: string) {
  group.visible = s.opacity > 0.001 && s.scale > 0.001
  // Elle sürüklenen katmanın konumunu sürükleme bitene kadar tutamaç belirler.
  if (manualDrag.layerId === layerId) return
  group.position.set(s.x, s.y, s.z)
  group.rotation.set(s.rotX, s.rotY, s.rotZ)
  group.scale.setScalar(Math.max(0.0001, s.scale))
}

/** Grubun tüm malzemelerinin opaklığını, her malzemenin kendi temel opaklığıyla çarparak ayarlar. */
export function applyOpacity(group: Group, opacity: number) {
  group.traverse((obj) => {
    const material = (obj as Mesh).material as Material | undefined
    if (!material) return
    const base = (material.userData.baseOpacity ??= material.opacity) as number
    const baseTransparent = (material.userData.baseTransparent ??= material.transparent) as boolean
    // Tam görünürken opak malzemeler opak kalsın: hepsini saydam yapmak derinlik sıralamasını
    // bozuyor (modelin iç parçaları öne taşabiliyor) ve gereksiz yere yavaşlatıyor.
    const transparent = baseTransparent || opacity < 0.999
    // Saydamlık değişince malzeme yeniden derlenmeli: aksi halde bir kez opak çizilmiş malzeme
    // saydamlaşmıyor, sönme (fade-out) animasyonları tam görünür kalıp sonda birden kayboluyordu.
    if (material.transparent !== transparent) {
      material.transparent = transparent
      material.needsUpdate = true
    }
    material.opacity = base * opacity
  })
}

/**
 * Önizlemede tıklayınca katmanı seçer. Görünmeyen katman tıklamayı arkasındakine bırakır;
 * kilitli katman önizlemeden seçilmez (listeden seçilebilir).
 */
export function selectOnClick(layer: Layer) {
  return (e: ThreeEvent<MouseEvent>) => {
    if (!e.eventObject.visible || layer.locked) return
    e.stopPropagation()
    useProjectStore.getState().selectTrack(layer.id)
  }
}

/**
 * Metin dışındaki katmanların ortak kaydı: her karede dönüşüm ve opaklık uygulanır, `extra`
 * katmana özel işler içindir. Döndürülen değerler katmanın dış `<group>`'una verilir.
 */
export function useLayerNode(layer: Layer, register: Register, extra?: (group: Group, s: LayerState) => void) {
  const ref = useRef<Group>(null)
  useLayoutEffect(() => {
    register(layer.id, (s) => {
      if (!ref.current) return
      applyTransform(ref.current, s, layer.id)
      applyOpacity(ref.current, s.opacity)
      extra?.(ref.current, s)
    })
  })
  return { ref, name: `layer:${layer.id}`, onClick: selectOnClick(layer) }
}

/** Görsel dokusu: `asset:<id>`, data URL ya da adres olabilir. */
export function useImageTexture(url: string | undefined) {
  const [loaded, setLoaded] = useState<{ url: string; texture: Texture; aspect: number } | null>(null)
  useEffect(() => {
    if (!url) return
    let alive = true
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
