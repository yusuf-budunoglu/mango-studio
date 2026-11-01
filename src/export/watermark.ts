/**
 * Ücretsiz plan çıktılarının sağ alt köşesindeki küçük etiket: Mango işareti + site adresi. Ücretli planlarda
 * çizilmez (`billing/plans.ts` `watermark`). Etiket çıktı boyutuna göre bir kez hazırlanır, her kareye kopyalanır.
 */
export const WATERMARK_TEXT = 'mangostudio.design'

export interface Watermark {
  /** Etiketi karenin sağ alt köşesine çizer (karenin kendi piksel boyutunda). */
  draw: (ctx: CanvasRenderingContext2D) => void
}

/** Etiketin ölçüleri (piksel): kısa kenarın yüzdesi; küçük çıktılarda okunaklı kalsın diye alt sınırlı. */
export function watermarkLayout(width: number, height: number) {
  const short = Math.min(width, height)
  const pill = Math.max(20, Math.round(short * 0.044))
  return {
    pill,
    margin: Math.max(8, Math.round(short * 0.022)),
    padding: Math.round(pill * 0.32),
    mark: Math.round(pill * 0.62),
    gap: Math.round(pill * 0.22),
    fontSize: Math.round(pill * 0.44),
  }
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function createWatermark(width: number, height: number): Promise<Watermark> {
  const { pill, margin, padding, mark, gap, fontSize } = watermarkLayout(width, height)
  const font = `600 ${fontSize}px "Mango UI", system-ui, sans-serif`
  // Yazı tipi ve işaret yüklenemezse etiket yine çizilir (sistem yazı tipi, işaretsiz).
  const [logo] = await Promise.all([loadImage(`${import.meta.env.BASE_URL}brand/mango-mark-96.png`), document.fonts.load(font).catch(() => undefined)])

  const stamp = document.createElement('canvas')
  const probe = stamp.getContext('2d')
  if (!probe) return { draw: () => undefined }
  probe.font = font
  const textWidth = Math.ceil(probe.measureText(WATERMARK_TEXT).width)
  stamp.width = padding * 2 + (logo ? mark + gap : 0) + textWidth
  stamp.height = pill
  const ctx = stamp.getContext('2d')
  if (!ctx) return { draw: () => undefined }
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
  ctx.beginPath()
  ctx.roundRect(0, 0, stamp.width, stamp.height, pill / 2)
  ctx.fill()
  let x = padding
  if (logo) {
    ctx.drawImage(logo, x, (pill - mark) / 2, mark, mark)
    x += mark + gap
  }
  ctx.font = font
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)'
  ctx.textBaseline = 'middle'
  ctx.fillText(WATERMARK_TEXT, x, pill / 2 + fontSize * 0.04)

  return {
    draw: (target) => {
      target.globalAlpha = 1
      target.drawImage(stamp, width - margin - stamp.width, height - margin - stamp.height)
    },
  }
}
