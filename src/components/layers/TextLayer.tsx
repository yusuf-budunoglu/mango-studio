import { Text } from '@react-three/drei'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, MeshBasicMaterial, type Group, type Mesh } from 'three'
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
  outlineBlur: number | string
  outlineWidth: number | string
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
 * soft-reveal ve glow-sweep için temel malzeme: troika bunun onBeforeCompile'ını kendi shader'ından önce
 * çalıştırır. Harfin yerel x'i ile görünürlük kenarı arasındaki mesafe opaklığı belirler.
 * glow-sweep: ön (uGlowFront) ve arka (uGlowTail) kenar arasındaki harflerin içi beyaza yakın, nane tonlu olur (ön kenarda daha beyaz);
 * yaklaşır. Troika'nın kontur geçişi (bulanık kontur, uTroikaBlurRadius > 0) aynı bölgede ışıma olarak çizilir.
 */
const GLOW_FRAGMENT = `#include <opaque_fragment>
if (uGlowOn > 0.5) {
  float glowAmt = clamp((uGlowFront - vRevealX) / uGlowSoft, 0.0, 1.0) * clamp((vRevealX - uGlowTail) / uGlowSoft, 0.0, 1.0);
  if (uTroikaBlurRadius > 0.0) {
    gl_FragColor.rgb = uGlowEdge;
    gl_FragColor.a *= 1.5 * glowAmt * uGlowHalo; // kenara yakın ışıma dolsun (troika bulanık konturu kenarda ~%50)
  } else {
    float front = clamp(1.0 - (uGlowFront - vRevealX) / (2.0 * uGlowSoft), 0.0, 1.0);
    vec3 lit = mix(uGlowColor, vec3(1.0), 0.6 + 0.3 * front);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, lit, glowAmt);
  }
}`

function useRevealMaterial() {
  const uniforms = useMemo(
    () => ({
      uRevealEdge: { value: 1e6 },
      uRevealSoft: { value: 1e-3 },
      uHideEdge: { value: -1e6 },
      uHideSoft: { value: 1e-3 },
      uGlowOn: { value: 0 },
      uGlowFront: { value: 0 },
      uGlowTail: { value: 0 },
      uGlowSoft: { value: 1 },
      uGlowHalo: { value: 1 },
      uGlowColor: { value: new Color() },
      uGlowEdge: { value: new Color() },
    }),
    [],
  )
  const material = useMemo(() => {
    const m = new MeshBasicMaterial({ transparent: true })
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `varying float vRevealX;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvRevealX = transformed.x;')
      const defs = 'uniform float uRevealEdge;\nuniform float uRevealSoft;\nuniform float uHideEdge;\nuniform float uHideSoft;\nuniform float uGlowOn;\nuniform float uGlowFront;\nuniform float uGlowTail;\nuniform float uGlowSoft;\nuniform float uGlowHalo;\nuniform vec3 uGlowColor;\nuniform vec3 uGlowEdge;\nvarying float vRevealX;\n'
      shader.fragmentShader = `${defs}${shader.fragmentShader}`
        .replace('#include <opaque_fragment>', GLOW_FRAGMENT)
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.a *= clamp((uRevealEdge - vRevealX) / uRevealSoft, 0.0, 1.0) * clamp((vRevealX - uHideEdge) / uHideSoft, 0.0, 1.0);')
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
      // soft-hide: silme kenarı soldan sağa ilerler; kenarın solundaki harfler görünmez
      if (s.softHide > 0 && bounds) {
        const [minX, , maxX] = bounds
        const soft = Math.max(1e-3, (maxX - minX) * s.hideSoftness)
        reveal.uniforms.uHideEdge.value = minX - soft + (maxX - minX + soft) * s.softHide
        reveal.uniforms.uHideSoft.value = soft
      } else {
        reveal.uniforms.uHideEdge.value = -1e6
      }
      // glow-sweep: ön ve arka kenar metin genişliğine göre; ışıma troika'nın bulanık konturuyla (yalnızca dalga sürerken)
      const glowing = s.glow !== null && !!bounds
      if (glowing && bounds) {
        const [minX, , maxX] = bounds
        const width = Math.max(1e-3, maxX - minX)
        const soft = Math.max(1e-3, s.glowSoftness)
        const front = -soft + (s.glow ?? 0) * (1 + s.glowWidth + 2 * soft)
        const u = reveal.uniforms
        u.uGlowOn.value = 1
        u.uGlowFront.value = minX + front * width
        u.uGlowTail.value = minX + (front - s.glowWidth - soft) * width
        u.uGlowSoft.value = soft * width
        u.uGlowHalo.value = s.glowHalo
        u.uGlowColor.value.setHSL(s.glowHue / 360, 0.82, 0.64)
        // ışıma tam doygun: harf kenarındaki yumuşatılmış beyazla karışınca soluklaşıyordu
        u.uGlowEdge.value.setHSL(s.glowHue / 360, 1, 0.62)
      } else {
        reveal.uniforms.uGlowOn.value = 0
      }
      // harfin etrafında yumuşak ışıma (kontur genişliği 0: kalın kontur harfleri lekeye, ince kontur çizgiye çeviriyordu)
      const blur = glowing ? '12%' : 0
      if (mesh.outlineBlur !== blur) {
        mesh.outlineBlur = blur
        mesh.outlineWidth = 0
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
