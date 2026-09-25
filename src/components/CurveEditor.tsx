import { useRef, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { EasingFn } from '../engine/easing'

const SIZE = 180
const PAD = 14
// Dikey eksende taşma (overshoot) için yer: y = -0.5 .. 1.5
const Y_MIN = -0.5
const Y_MAX = 1.5
const toX = (x: number) => PAD + x * (SIZE - 2 * PAD)
const toY = (y: number) => PAD + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * (SIZE - 2 * PAD)
const fromX = (px: number) => (px - PAD) / (SIZE - 2 * PAD)
const fromY = (py: number) => Y_MAX - ((py - PAD) / (SIZE - 2 * PAD)) * (Y_MAX - Y_MIN)
const round = (v: number) => Math.round(v * 100) / 100

type Bezier = [number, number, number, number]

function curvePath(fn: EasingFn) {
  const points: string[] = []
  for (let i = 0; i <= 60; i++) {
    const p = i / 60
    points.push(`${i === 0 ? 'M' : 'L'}${toX(p).toFixed(1)},${toY(fn(p)).toFixed(1)}`)
  }
  return points.join(' ')
}

/**
 * Hız eğrisi grafiği. `bezier` verilirse iki tutamaç sürüklenebilir (özel eğri);
 * verilmezse sadece `fn`'in önizlemesi çizilir.
 */
export function CurveEditor({ fn, bezier, onChange }: { fn: EasingFn; bezier?: Bezier; onChange?: (b: Bezier) => void }) {
  const { t } = useTranslation()
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef<0 | 1 | null>(null)

  const move = (e: PointerEvent) => {
    if (dragging.current === null || !bezier || !onChange || !svg.current) return
    const rect = svg.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * SIZE
    const py = ((e.clientY - rect.top) / rect.height) * SIZE
    const x = round(Math.min(1, Math.max(0, fromX(px))))
    const y = round(Math.min(Y_MAX, Math.max(Y_MIN, fromY(py))))
    const next: Bezier = [...bezier]
    next[dragging.current * 2] = x
    next[dragging.current * 2 + 1] = y
    onChange(next)
  }

  const handle = (index: 0 | 1) => {
    if (!bezier) return null
    const hx = toX(bezier[index * 2])
    const hy = toY(bezier[index * 2 + 1])
    const [ax, ay] = index === 0 ? [toX(0), toY(0)] : [toX(1), toY(1)]
    return (
      <g key={index}>
        <line x1={ax} y1={ay} x2={hx} y2={hy} className="curve-arm" />
        <circle
          cx={hx}
          cy={hy}
          r={7}
          className="curve-handle"
          role="slider"
          aria-label={t(index === 0 ? 'curve.handleStart' : 'curve.handleEnd')}
          aria-valuetext={`${bezier[index * 2]}, ${bezier[index * 2 + 1]}`}
          onPointerDown={(e) => {
            dragging.current = index
            ;(e.target as Element).setPointerCapture(e.pointerId)
          }}
        />
      </g>
    )
  }

  return (
    <div className="curve">
      <svg
        ref={svg}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerMove={move}
        onPointerUp={() => (dragging.current = null)}
        onPointerCancel={() => (dragging.current = null)}
      >
        <rect x={toX(0)} y={toY(1)} width={toX(1) - toX(0)} height={toY(0) - toY(1)} className="curve-box" />
        <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} className="curve-diagonal" />
        <path d={curvePath(fn)} className="curve-line" />
        {handle(0)}
        {handle(1)}
      </svg>
      {bezier && onChange && (
        <div className="curve-values">
          {bezier.map((v, i) => (
            <input
              key={i}
              id={`bezier-${i}`}
              aria-label={['x1', 'y1', 'x2', 'y2'][i]}
              type="number"
              step={0.05}
              value={v}
              onChange={(e) => {
                const next: Bezier = [...bezier]
                const raw = Number(e.target.value)
                next[i] = i % 2 === 0 ? Math.min(1, Math.max(0, raw)) : Math.min(Y_MAX, Math.max(Y_MIN, raw))
                onChange(next)
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
