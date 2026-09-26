import { Box, Clapperboard, Image, Laptop, PenTool, Smartphone, Tablet, Type, type LucideIcon } from 'lucide-react'
import type { LayerKind } from '../engine/types'

/** Katman türünün simgesi: timeline listesi ve klip çubuğu paylaşır. */
export const KIND_ICON: Record<LayerKind, LucideIcon> = { text: Type, phone: Smartphone, laptop: Laptop, tablet: Tablet, image: Image, shape: Box, svg: PenTool, video: Clapperboard }
