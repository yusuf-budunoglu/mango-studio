import type { Layer, Project } from '../engine/types'

/**
 * Marka kiti: üyenin bir kez kaydettiği marka adı, site adresi, renkleri, yazı tipi ve logosu. Editörde tek tıkla
 * açık projeye uygulanır (`brandPatch`). Pro ve Unlimited planlarda (`billing/plans.ts` `brandKit`); sunucuda
 * `brand_kits` tablosu. Saf modül: proje formatını değiştirmez, yalnızca var olan katman alanlarını yazar.
 */
export interface BrandKit {
  name: string
  /** şablonlardaki site adresinin yerine yazılır (ör. "acme.com") */
  website: string
  /** önem sırasıyla (ilk renk ana renk); en fazla `MAX_BRAND_COLORS` */
  colors: string[]
  /** yazı tipi kimliği (`render/fonts.ts`) ya da yüklenen font (`asset:<id>`); boşsa şablonun yazı tipleri kalır */
  fontFamily?: string
  /** logo görseli (`asset:<id>`) */
  logo?: string
}

export const MAX_BRAND_COLORS = 4
export const EMPTY_BRAND_KIT: BrandKit = { name: '', website: '', colors: [] }

const HEX = /^#[0-9a-f]{6}$/i
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

/** Kayıttan ya da formdan gelen değeri güvenli hale getirir (bilinmeyen alan, bozuk renk, aşırı uzun metin atılır). */
export function cleanBrandKit(value: unknown): BrandKit {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const colors = Array.isArray(raw.colors) ? raw.colors.filter((c): c is string => typeof c === 'string' && HEX.test(c)).map((c) => c.toLowerCase()) : []
  const kit: BrandKit = { name: text(raw.name, 60), website: text(raw.website, 80), colors: [...new Set(colors)].slice(0, MAX_BRAND_COLORS) }
  const font = text(raw.fontFamily, 120)
  if (font) kit.fontFamily = font
  const logo = text(raw.logo, 200)
  if (logo.startsWith('asset:')) kit.logo = logo
  return kit
}

export const isEmptyBrandKit = (kit: BrandKit) => !kit.name && !kit.website && !kit.colors.length && !kit.fontFamily && !kit.logo

/** Renk bir vurgu rengi mi? Beyaz, siyah ve griler (metin ve zemin tonları) markaya boyanmaz. */
export function isAccentColor(hex: string): boolean {
  if (!HEX.test(hex)) return false
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2
  const saturation = max === min ? 0 : (max - min) / (1 - Math.abs(2 * lightness - 1))
  return saturation >= 0.3 && lightness >= 0.15 && lightness <= 0.9
}

// Şablonlarımız örnek marka olarak Mango Studio'yu kullanır: bu metinler ve logo kullanıcının markasıyla değişir.
const PLACEHOLDER_NAME = 'Mango Studio'
const PLACEHOLDER_SITE = 'mangostudio.design'
const PLACEHOLDER_LOGO = /brand\/mango-(logo|mark)/
const COLORED_KINDS = new Set<Layer['kind']>(['text', 'shape'])

type LayerPatch = Partial<Omit<Layer, 'id' | 'blocks'>>

/**
 * Marka kitini projeye uygulamak için katman yamaları:
 * - vurgu renkleri: projede en çok kullanılan vurgu rengi kitin ana rengine, sonrakiler sıradaki renklere döner
 *   (metin ve şekil katmanları, boyanan SVG / görseller); beyaz, siyah ve griler olduğu gibi kalır
 * - yazı tipi: tüm metin katmanları
 * - logo: adı "logo" olan ya da Mango logosunu gösteren görsel katmanları
 * - marka adı ve site adresi: metni tam olarak örnek marka olan katmanlar (harf harf kurulan başlıklar değişmez)
 */
export function brandPatch(project: Project, kit: BrandKit): Record<string, LayerPatch> {
  const colored = (l: Layer) => COLORED_KINDS.has(l.kind) || ((l.kind === 'svg' || l.kind === 'image') && !!l.tint)
  const usage = new Map<string, number>()
  for (const l of project.layers) {
    const color = l.color.toLowerCase()
    if (colored(l) && isAccentColor(color)) usage.set(color, (usage.get(color) ?? 0) + 1)
  }
  const ranked = [...usage.entries()].sort((a, b) => b[1] - a[1]).map(([color]) => color)
  const colorFor = (color: string) => {
    const index = ranked.indexOf(color.toLowerCase())
    return index < 0 || !kit.colors.length ? undefined : kit.colors[Math.min(index, kit.colors.length - 1)]
  }

  const patches: Record<string, LayerPatch> = {}
  for (const l of project.layers) {
    const patch: LayerPatch = {}
    const color = colored(l) ? colorFor(l.color) : undefined
    if (color && color !== l.color.toLowerCase()) patch.color = color
    if (l.kind === 'text') {
      if (kit.fontFamily && l.fontFamily !== kit.fontFamily) patch.fontFamily = kit.fontFamily
      const content = l.text?.trim()
      if (kit.name && content === PLACEHOLDER_NAME) patch.text = kit.name
      if (kit.website && content === PLACEHOLDER_SITE) patch.text = kit.website
    }
    if (kit.logo && l.kind === 'image' && l.image !== kit.logo && (/logo/i.test(l.name) || PLACEHOLDER_LOGO.test(l.image ?? ''))) patch.image = kit.logo
    if (Object.keys(patch).length) patches[l.id] = patch
  }
  return patches
}
