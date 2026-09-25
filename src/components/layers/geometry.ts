import { ExtrudeGeometry, Shape, ShapeGeometry } from 'three'

/** Merkezde duran yuvarlatılmış dikdörtgen şekli. */
export function roundedRect(w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  const s = new Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + radius, y)
  s.lineTo(x + w - radius, y)
  s.quadraticCurveTo(x + w, y, x + w, y + radius)
  s.lineTo(x + w, y + h - radius)
  s.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
  s.lineTo(x + radius, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - radius)
  s.lineTo(x, y + radius)
  s.quadraticCurveTo(x, y, x + radius, y)
  return s
}

/**
 * Düz yuvarlatılmış dikdörtgen; doku koordinatları 0..1'e yayılır (ekran görüntüsü köşelerden
 * kırpılarak tam oturur).
 */
export function roundedPlane(w: number, h: number, r: number, segments = 10) {
  const g = new ShapeGeometry(roundedRect(w, h, r), segments)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h)
  uv.needsUpdate = true
  return g
}

/** Kalın yuvarlatılmış gövde: ortası z=0'da, kenarları hafif pahlı. */
export function roundedSlab(w: number, h: number, r: number, depth: number, bevel = 0.02) {
  const g = new ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, Math.max(0.001, r - bevel)), {
    depth: Math.max(0.001, depth - bevel * 2),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 4,
    curveSegments: 16,
  })
  g.translate(0, 0, -(depth - bevel * 2) / 2)
  return g
}
