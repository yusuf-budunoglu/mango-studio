import { Text } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { MeshBasicMaterial, type Group, type Mesh } from 'three'
import { displayText } from '../../engine/evaluate'
import { pendingTextSyncs } from '../../export/bridge'
import { useTextFontUrl } from '../../render/fontFaces'
import { trailColorRanges } from '../../render/textTrail'
import { applyTransform, selectOnClick, type LayerProps } from './shared'

// troika-three-text'in (drei <Text>) tipleri yok; kullandığımız alanları tanımlıyoruz.
interface TroikaText extends Mesh {
  text: string
  fillOpacity: number
  letterSpacing: number
  clipRect: [number, number, number, number] | null
  colorRanges: Record<number, number> | null
  textRenderInfo?: { blockBounds: [number, number, number, number] }
  sync: (callback?: () => void) => void
}

/** Metin bir worker'da yeniden dizilir; video çıktısı kareyi yakalamadan önce bunu bekler. */
function syncText(mesh: TroikaText) {
  // troika sadece bir şey değiştiğinde geri çağırır; yine de takılmasın diye süre sınırı var.
  const done = new Promise<void>((resolve) => {
    mesh.sync(resolve)
    setTimeout(resolve, 2000)
  })
  pendingTextSyncs.add(done)
  void done.then(() => pendingTextSyncs.delete(done))
}

/**
 * soft-reveal için temel malzeme: troika bunun onBeforeCompile'ını kendi shader'ından önce
 * çalıştırır. Harfin yerel x'i ile görünürlük kenarı arasındaki mesafe opaklığı belirler.
 */
function useRevealMaterial() {
  const uniforms = useMemo(() => ({ uRevealEdge: { value: 1e6 }, uRevealSoft: { value: 1e-3 } }), [])
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({ transparent: true })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `varying float vRevealX;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRevealX = transformed.x;')
      shader.fragmentShader = `uniform float uRevealEdge;\nuniform float uRevealSoft;\nvarying float vRevealX;\n${shader.fragmentShader}`.replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragColor.a *= clamp((uRevealEdge - vRevealX) / uRevealSoft, 0.0, 1.0);',
      )
    }
    return m
  }, [uniforms])
  useEffect(() => () => material.dispose(), [material])
  return { material, uniforms }
}

export function TextLayer({ layer, register, numberLocale }: LayerProps) {
  const group = useRef<Group>(null)
  const text = useRef<TroikaText>(null)
  const reveal = useRevealMaterial()
  const font = useTextFontUrl(layer.fontFamily, layer.fontWeight ?? 400)

  useLayoutEffect(() => {
    register(layer.id, (s) => {
      const mesh = text.current
      if (!group.current || !mesh) return
      applyTransform(group.current, s, layer.id)
      mesh.fillOpacity = s.opacity
      let needsSync = false
      const str = displayText(layer, s, numberLocale)
      if (mesh.text !== str) {
        mesh.text = str
        needsSync = true
      }
      // tracking-in: harf aralığı animasyonu (yeniden dizilim gerektirir)
      const spacing = (layer.letterSpacing ?? 0) + s.letterSpacing
      if (Math.abs(mesh.letterSpacing - spacing) > 1e-4) {
        mesh.letterSpacing = spacing
        needsSync = true
      }
      // renkli iz: yalnızca değişince güncellenir (her karede yeni nesne yeniden dizilime yol açar)
      const ranges = trailColorRanges(str, layer.color, s.trail, s.trailHue)
      if (JSON.stringify(ranges) !== JSON.stringify(mesh.colorRanges ?? null)) {
        mesh.colorRanges = ranges
        needsSync = true
      }
      if (needsSync) syncText(mesh)
      // wipe-in: metnin soldan sağa görünen kısmı (kırpma dikdörtgeni, yeniden dizilim gerekmez)
      const bounds = mesh.textRenderInfo?.blockBounds
      if (s.wipe < 1 && bounds) {
        const [minX, minY, maxX, maxY] = bounds
        mesh.clipRect = [minX, minY - 1, minX + (maxX - minX) * s.wipe, maxY + 1]
      } else if (mesh.clipRect) {
        mesh.clipRect = null
      }
      // soft-reveal: kenar soldan sağa, yumuşaklık kadar genişlikte bir geçişle ilerler
      if (s.softReveal < 1 && bounds) {
        const [minX, , maxX] = bounds
        const soft = Math.max(1e-3, (maxX - minX) * s.revealSoftness)
        reveal.uniforms.uRevealEdge.value = minX + (maxX - minX + soft) * s.softReveal
        reveal.uniforms.uRevealSoft.value = soft
      } else {
        reveal.uniforms.uRevealEdge.value = 1e6
      }
    })
  })

  return (
    <group ref={group} name={`layer:${layer.id}`} onClick={selectOnClick(layer)}>
      {font && (
      <Text
        ref={text}
        material={reveal.material}
        font={font}
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
      )}
    </group>
  )
}
