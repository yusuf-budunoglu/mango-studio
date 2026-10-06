import { Suspense } from 'react'
import { ImageLayer, ShapeLayer, SvgLayer } from './BasicLayers'
import { DeviceLayer } from './DeviceLayer'
import type { LayerProps } from './shared'
import { TextLayer } from './TextLayer'
import { VideoLayer } from './VideoLayer'

/** Katman türüne göre doğru bileşeni seçer. */
export function LayerNode(props: LayerProps) {
  switch (props.layer.kind) {
    case 'text':
      return (
        // Font yüklenirken sadece bu katman beklesin, tüm sahne değil.
        <Suspense fallback={null}>
          <TextLayer {...props} />
        </Suspense>
      )
    case 'phone':
    case 'tablet':
    case 'laptop':
    case 'foldable':
      return <DeviceLayer {...props} />
    case 'image':
      return <ImageLayer {...props} />
    case 'svg':
      return <SvgLayer {...props} />
    case 'video':
      return <VideoLayer {...props} />
    default:
      return <ShapeLayer {...props} />
  }
}
