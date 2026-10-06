import { useEffect, useRef } from 'react'
import { useUiStore } from '../store/uiStore'
import { reducedMotion } from './useAutoplay'

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`

/**
 * Hafif ışık bantları: zemini çaprazlama kesen geniş, yumuşak şeritler ağır ağır kayar; şeritlerin içi zeminden bir ton
 * açık, kenarlarında ince bir renk saçağı (kırmızı → turuncu → sarı → limon) var. Bilerek silik: yazının arkasında durur.
 */
const FRAGMENT = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_base;
uniform vec3 u_lift;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_fringe;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 11.7; a *= 0.5; }
  return v;
}
vec3 palette(float k) {
  vec3 c = mix(u_c0, u_c1, smoothstep(0.0, 0.34, k));
  c = mix(c, u_c2, smoothstep(0.3, 0.68, k));
  return mix(c, u_c3, smoothstep(0.66, 1.0, k));
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
  float t = u_time * 0.03;
  float lift = 0.0;
  float amount = 0.0;
  vec3 fringe = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    vec2 dir = normalize(vec2(0.62 - fi * 0.3, 1.0));
    float warp = fbm(p * (0.55 + fi * 0.25) + vec2(t * 1.2, -t) + fi * 7.0);
    float s = dot(p, dir) * (1.05 + fi * 0.6) + warp * 1.5 + t * (0.9 + fi * 0.5) + fi * 2.3;
    float wave = 0.5 + 0.5 * sin(s * 3.14159);
    // Şeridin içi (düzlük) ve kenarındaki dar saçak.
    float inside = smoothstep(0.46, 0.66, wave);
    float edge = smoothstep(0.34, 0.54, wave) * (1.0 - smoothstep(0.54, 0.74, wave));
    float weight = 0.65 - fi * 0.3;
    lift += inside * weight;
    fringe += palette(clamp((wave - 0.34) / 0.4, 0.0, 1.0)) * edge * weight;
    amount += edge * weight;
  }
  vec3 col = mix(u_base, u_lift, clamp(lift, 0.0, 1.0));
  col = mix(col, fringe / max(amount, 0.001), clamp(amount, 0.0, 1.0) * u_fringe);
  gl_FragColor = vec4(col, 1.0);
}
`

type Rgb = [number, number, number]

/** CSS renk değerini (#rrggbb) 0..1 üçlüsüne çevirir; okunamayanı siyah sayar. */
function rgb(value: string): Rgb {
  const hex = value.trim().replace('#', '')
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const n = Number.parseInt(full, 16)
  return Number.isFinite(n) && full.length === 6 ? [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255] : [0, 0, 0]
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

/**
 * Ana sayfanın hareketli zemini (WebGL, yarım çözünürlük): sayfa kaydırılırken yerinde durur, tüm sayfanın arkasındadır.
 * Renkler tokenlardan; hareketi azaltan kullanıcıda tek kare. WebGL yoksa hiçbir şey çizilmez (düz zemin).
 */
export function AuroraBackground() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const el = canvas.current
    const gl = el?.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!el || !gl) return
    const vs = compile(gl, gl.VERTEX_SHADER, VERTEX)
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
    const program = gl.createProgram()
    if (!vs || !fs || !program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const pos = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(pos)
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0)

    // Renkler tokenlardan: tema değişince bu etki yeniden kurulur.
    const style = getComputedStyle(el)
    const token = (name: string) => rgb(style.getPropertyValue(name))
    const set3 = (name: string, value: Rgb) => gl.uniform3fv(gl.getUniformLocation(program, name), value)
    const bg = token('--bg')
    const light = theme === 'light'
    // Koyu temada şeritler zeminden az açık, sıcak; açık temada zemin bir ton koyulur, şeritler beyaza yaklaşır.
    set3('u_base', light ? (bg.map((v) => v * 0.94) as Rgb) : bg)
    set3('u_lift', light ? (bg.map((v) => v + (1 - v) * 0.55) as Rgb) : [bg[0] + 0.075, bg[1] + 0.052, bg[2] + 0.034])
    set3('u_c0', token('--mango-red'))
    set3('u_c1', token('--accent'))
    set3('u_c2', token('--gold'))
    set3('u_c3', token('--lime'))
    gl.uniform1f(gl.getUniformLocation(program, 'u_fringe'), light ? 0.3 : 0.2)
    const uRes = gl.getUniformLocation(program, 'u_res')
    const uTime = gl.getUniformLocation(program, 'u_time')

    const draw = () => {
      // Yarım çözünürlük: bantlar zaten yumuşak, ekran kartını yormaz.
      const w = Math.max(2, Math.min(1280, Math.round(el.clientWidth / 2)))
      const h = Math.max(2, Math.round((w * el.clientHeight) / Math.max(1, el.clientWidth)))
      if (el.width !== w || el.height !== h) {
        el.width = w
        el.height = h
        gl.viewport(0, 0, w, h)
      }
      gl.uniform2f(uRes, w, h)
      gl.uniform1f(uTime, performance.now() / 1000)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    draw()
    el.classList.add('is-live')
    if (reducedMotion()) return

    let frame = requestAnimationFrame(function loop() {
      draw()
      frame = requestAnimationFrame(loop)
    })
    return () => cancelAnimationFrame(frame)
  }, [theme])

  return (
    <div className="h-aurora" aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}
