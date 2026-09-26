import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Uniform, Vector2 } from 'three'

// Kendi lens efektlerimiz. Hepsi yalnızca bizim verdiğimiz değerlerle çizer: postprocessing'in
// `time` sayacını ya da fareyi kullanmazlar, böylece aynı proje anı her seferinde aynı kareyi verir
// (video çıktısı ve hareket bulanıklığı alt kareleri buna güvenir). Değerleri Stage her karede yazar.

// c: merkezden uzaklık, en-boy oranı düzeltilmiş (16:9'da köşede ~1).
const LENS_FRAG = /* glsl */ `
uniform float distortion;
uniform float aberration;

vec2 toUv(vec2 c) {
  c.x /= aspect;
  return c + 0.5;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  c.x *= aspect;
  float r2 = dot(c, c);
  float corner2 = 0.25 * (aspect * aspect + 1.0);
  // fıçı bükülmesi; köşeler görüntünün dışına taşmasın diye aynı oranda yakınlaştırılır
  c *= (1.0 + distortion * r2) / (1.0 + max(distortion, 0.0) * corner2);
  // kromatik sapma: kırmızı dışa, mavi içe; kayma merkezden uzaklıkla büyür
  float ca = aberration * 0.01;
  vec4 g = texture2D(inputBuffer, toUv(c));
  float r = texture2D(inputBuffer, toUv(c * (1.0 + ca))).r;
  float b = texture2D(inputBuffer, toUv(c * (1.0 - ca))).b;
  outputColor = vec4(r, g.g, b, g.a);
}
`

/** Lens bükülmesi ve kromatik sapma tek geçişte. */
export class LensEffect extends Effect {
  constructor() {
    super('LensEffect', LENS_FRAG, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['distortion', new Uniform(0)],
        ['aberration', new Uniform(0)],
      ]),
    })
  }
  setValues({ distortion, aberration }: { distortion: number; aberration: number }) {
    this.uniforms.get('distortion')!.value = distortion
    this.uniforms.get('aberration')!.value = aberration
  }
}

const FLARE_FRAG = /* glsl */ `
uniform vec2 flarePos;
uniform float flareIntensity;
uniform float flareStreak;

float glow(vec2 p, float size) {
  return exp(-dot(p, p) / (size * size));
}

float ring(vec2 p, float radius, float width) {
  float d = abs(length(p) - radius);
  return exp(-(d * d) / (width * width));
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (flareIntensity <= 0.0) { outputColor = inputColor; return; }
  vec2 asp = vec2(aspect, 1.0);
  vec2 p = (uv * 2.0 - 1.0) * asp;
  vec2 src = flarePos * asp;
  vec2 d = p - src;

  vec3 warm = vec3(1.0, 0.82, 0.62);
  vec3 col = vec3(0.0);
  // kaynak: parlak çekirdek ve geniş hale
  col += warm * (glow(d, 0.05) * 1.6 + glow(d, 0.28) * 0.35);
  // anamorfik yatay çizgi
  col += vec3(0.75, 0.85, 1.0) * flareStreak * exp(-abs(d.y) * 90.0) * exp(-abs(d.x) * 1.4) * 0.9;
  // hayaletler: kaynaktan merkeze ve ötesine uzanan hat üzerinde, lens camlarının yansımaları
  col += vec3(0.55, 0.75, 1.0) * glow(p + src * 0.45, 0.07) * 0.35;
  col += vec3(1.0, 0.6, 0.35) * glow(p + src * 0.9, 0.12) * 0.22;
  col += vec3(0.6, 1.0, 0.75) * glow(p - src * 0.35, 0.04) * 0.3;
  col += vec3(0.9, 0.55, 1.0) * glow(p + src * 1.35, 0.2) * 0.12;
  // merkez etrafında soluk halka
  col += vec3(0.9, 0.8, 1.0) * ring(p - src * 0.15, 0.62, 0.09) * 0.035;

  outputColor = vec4(inputColor.rgb + col * flareIntensity, inputColor.a);
}
`

/** Lens parlaması: ekranda bir ışık kaynağı, yatay çizgi ve renkli yansımalar. */
export class FlareEffect extends Effect {
  constructor() {
    super('FlareEffect', FLARE_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['flarePos', new Uniform(new Vector2())],
        ['flareIntensity', new Uniform(0)],
        ['flareStreak', new Uniform(0.6)],
      ]),
    })
  }
  setValues({ x, y, intensity, streak }: { x: number; y: number; intensity: number; streak: number }) {
    ;(this.uniforms.get('flarePos')!.value as Vector2).set(x, y)
    this.uniforms.get('flareIntensity')!.value = intensity
    this.uniforms.get('flareStreak')!.value = streak
  }
}

const LEAK_FRAG = /* glsl */ `
uniform float leakTime;
uniform float leakIntensity;

float blob(vec2 uv, vec2 center, float radius) {
  vec2 d = (uv - center) * vec2(aspect, 1.0);
  float k = clamp(1.0 - length(d) / radius, 0.0, 1.0);
  return k * k;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  if (leakIntensity <= 0.0) { outputColor = inputColor; return; }
  float t = leakTime;
  // kenarlarda yavaşça gezinen üç sıcak ışık lekesi
  vec3 leak = vec3(1.0, 0.42, 0.12) * blob(uv, vec2(-0.08 + 0.12 * sin(t * 0.23), 0.8 + 0.18 * sin(t * 0.31 + 1.0)), 0.95);
  leak += vec3(1.0, 0.22, 0.32) * blob(uv, vec2(1.1 + 0.08 * sin(t * 0.17 + 2.0), 0.3 + 0.25 * sin(t * 0.27)), 0.8);
  leak += vec3(1.0, 0.72, 0.3) * blob(uv, vec2(0.5 + 0.55 * sin(t * 0.11 + 4.0), 1.12), 0.7);
  leak = clamp(leak * leakIntensity, 0.0, 1.0);
  // ekran karışımı: koyu yerleri aydınlatır, beyazı patlatmaz
  outputColor = vec4(1.0 - (1.0 - inputColor.rgb) * (1.0 - leak), inputColor.a);
}
`

/** Işık sızması: kenarlardan süzülen sıcak renkli ışık. */
export class LightLeakEffect extends Effect {
  constructor() {
    super('LightLeakEffect', LEAK_FRAG, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['leakTime', new Uniform(0)],
        ['leakIntensity', new Uniform(0)],
      ]),
    })
  }
  setValues({ time, intensity }: { time: number; intensity: number }) {
    this.uniforms.get('leakTime')!.value = time
    this.uniforms.get('leakIntensity')!.value = intensity
  }
}
