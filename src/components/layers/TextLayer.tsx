import { Text } from '@react-three/drei'
import { useLayoutEffect, useRef } from 'react'
import type { Group, Mesh } from 'three'
import { displayText } from '../../engine/evaluate'
import { pendingTextSyncs } from '../../export/bridge'
import { fontUrl } from '../../render/fonts'
import { applyTransform, selectOnClick, type LayerProps } from './shared'

// troika-three-text'in (drei <Text>) tipleri yok; kullandığımız alanları tanımlıyoruz.
interface TroikaText extends Mesh {
  text: string
  fillOpacity: number
  letterSpacing: number
  clipRect: [number, number, number, number] | null
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

export function TextLayer({ layer, register, numberLocale }: LayerProps) {
  const group = useRef<Group>(null)
  const text = useRef<TroikaText>(null)

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
      if (needsSync) syncText(mesh)
      // wipe-in: metnin soldan sağa görünen kısmı (kırpma dikdörtgeni, yeniden dizilim gerekmez)
      const bounds = mesh.textRenderInfo?.blockBounds
      if (s.wipe < 1 && bounds) {
        const [minX, minY, maxX, maxY] = bounds
        mesh.clipRect = [minX, minY - 1, minX + (maxX - minX) * s.wipe, maxY + 1]
      } else if (mesh.clipRect) {
        mesh.clipRect = null
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
