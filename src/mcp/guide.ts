import { PRESETS } from '../engine/presets'
import { PROJECT_VERSION } from '../engine/types'
import { EASINGS, LAYER_KINDS } from './validate'

/** Yazı tipi kimlikleri; `render/fonts.ts` ile aynı olmalı (test kontrol eder; o dosya Vite'a bağlı, Worker'a giremez). */
export const FONT_IDS = [
  'inter', 'inter-medium', 'roboto', 'open-sans', 'dm-sans', 'manrope', 'plus-jakarta-sans', 'poppins', 'montserrat', 'outfit', 'sora', 'work-sans',
  'nunito', 'rubik', 'raleway', 'space-grotesk', 'syne', 'oswald', 'bebas-neue', 'playfair-display', 'fraunces', 'dm-serif-display', 'instrument-serif', 'jetbrains-mono',
]

/** Her bloğun ne yaptığı (model için, İngilizce). Yeni blok eklenince buraya da yazılır (test kontrol eder). */
export const PRESET_NOTES: Record<string, string> = {
  'fade-in': 'opacity 0 → 1',
  'slide-up': 'rises from `distance` below while fading in',
  'slide-down': 'drops from `distance` above while fading in',
  'slide-left': 'slides in from `distance` to the right while fading in',
  'scale-in': 'grows from 60% while fading in',
  pop: 'scales from 0 with a bouncy spring',
  'rotate-in': 'swings in around the Y axis from `angle` degrees',
  'fade-out': 'opacity 1 → 0',
  'scale-out': 'shrinks to 60% while fading out',
  float: 'gentle vertical bobbing: `amount` units, `cycles` full cycles over the block',
  sway: 'rocks left/right around its centre (plants in wind); integer `cycles` loops seamlessly',
  spin: 'one full turn around the Y axis',
  'light-sweep': 'image layer only: the image is visible only where `count` lights travel around a rounded-box outline (neon border); `turns` laps over the block',
  typewriter: 'text appears letter by letter; `trail` colours the last N letters with `trailHue`',
  caret: 'shows a "|" cursor at the end of the text during the block; `blink` per second',
  move: 'keyframe-like: moves by dx/dy/dz, rotates by rotate (Z) / rotX / rotY degrees and scales by `scaleBy`, then STAYS there; consecutive move blocks accumulate',
  'word-reveal': 'text appears word by word',
  'wipe-in': 'text is revealed left to right with a hard edge',
  'soft-reveal': 'text is revealed left to right with a soft edge (`softness`)',
  'glow-sweep': 'a wave of light crosses the text left to right in hue `glowHue`, then letters return to their colour',
  'tracking-in': 'letters start spread apart by `amount` and settle while fading in',
  'tracking-out': 'letters squeeze together by `amount` and fade out at the end',
  'count-up': 'text layer shows a number counting `from` → `to` with `decimals`',
  'camera-push': 'camera moves `distance` units closer',
  'camera-pull': 'camera moves `distance` units away',
  'camera-orbit': 'camera orbits its target to `angle` degrees (absolute per block)',
  'focus-pull': 'depth of field: focus plane moves from z=`from` to z=`to`; `blur` multiplies blur from this block on (0 = everything sharp). Needs effects.dof.enabled',
  'fade-black': 'transition: screen dips to black at the middle of the block',
  'fade-white': 'transition: screen dips to white at the middle of the block',
  flash: 'short white flash that decays',
  'camera-shake': 'handheld shake: `amount` units, `speed`',
  'lens-punch': 'beat hit: brief zoom (`zoom`) with chromatic aberration (`amount`)',
  'flare-sweep': 'lens flare crosses the screen from x=`from` to x=`to` (-1..1) at height `y`',
  'light-leak': 'warm light leak burst',
  'camera-move': 'keyframe-like: camera AND its target shift by dx/dy and the z=0 plane is magnified `zoom` times, then it STAYS; consecutive blocks accumulate. Use this (not camera.position) to pan/zoom',
  'camera-spin': 'orbits the target by `angle` degrees on top of the current angle (accumulates)',
  'camera-pan': 'camera and target slide `distance` units along x',
}

function presetLines(target: 'layer' | 'camera') {
  return Object.entries(PRESETS)
    .filter(([, p]) => p.target === target)
    .map(([id, p]) => {
      const params = (p.params ?? []).map((s) => `${s.key}=${s.default}`).join(', ')
      return `- \`${id}\` [${p.category}; default ${p.defaultDuration}s, ${p.defaultEasing}] ${PRESET_NOTES[id] ?? ''}${params ? ` Params: ${params}.` : ''}`
    })
    .join('\n')
}

const EXAMPLE = {
  name: 'Sample',
  duration: 8,
  fps: 60,
  width: 1920,
  height: 1080,
  background: '#0d1117',
  layers: [
    { name: 'Title', kind: 'text', text: 'Make your videos in minutes', align: 'left', fontFamily: 'inter', fontWeight: 700, fontSize: 0.42, color: '#ffffff', position: [-4.6, 0.5, 0], start: 0.5, duration: 7.5, blocks: [{ preset: 'slide-up', start: 0, duration: 1.1 }, { preset: 'typewriter', start: 0, duration: 1.4 }] },
    { name: 'Counter', kind: 'text', text: '0', align: 'left', fontSize: 0.6, color: '#ffb86c', position: [-4.6, -0.9, 0], start: 2.2, duration: 5.8, blocks: [{ preset: 'fade-in', start: 0, duration: 0.4 }, { preset: 'count-up', start: 0, duration: 1.8, params: { from: 0, to: 10000 } }] },
    { name: 'Phone', kind: 'phone', image: 'asset:<id from create_upload>', deviceFinish: 'space', color: '#6c5ce7', position: [2.8, -0.2, 0], rotation: [0, -18, 0], start: 1.2, duration: 6.8, blocks: [{ preset: 'rotate-in', start: 0, duration: 1.4 }, { preset: 'float', start: 1.4, duration: 5, params: { amount: 0.1, cycles: 2 } }] },
  ],
  camera: { position: [0, 0, 9], fov: 40, blocks: [{ preset: 'camera-push', start: 0, duration: 8, params: { distance: 2 } }] },
}

/** Claude'un proje kurarken okuduğu rehber: format, sahne ölçüleri, bloklar ve referans videodan çalışma yöntemi. */
export function buildGuide(siteUrl: string): string {
  return `# Mango Studio project guide (format version ${PROJECT_VERSION})

A Mango Studio video is one JSON project: layers (text, devices, images, shapes, video) animated by timed blocks, plus a camera track. You build the JSON, call \`save_project\`, and the user opens it in the Studio at ${siteUrl}/studio to preview, edit and export (rendering happens in their browser, not here).

## Scene and units
- 3D scene, right-handed: +x right, +y up, +z towards the camera. Rotations are degrees [x, y, z].
- Default camera: position [0, 0, 9], fov 40 (vertical). At z=0 the visible frame is 6.551 units tall and 6.551 × (width / height) wide, centred on [0, 0]. So 1 unit = height_px / 6.551 (164.87 px at 1080 tall, 293.1 px at 1920 tall). Convert reference pixels: x = (px − width/2) / unit_px, y = (height/2 − py) / unit_px.
- Layers further back (z < 0) look smaller; keep flat graphics at z ≈ 0.

## Project fields
\`name\`, \`duration\` (s), \`fps\` (use 60), \`width\`, \`height\` (e.g. 1920×1080 or 1080×1920), \`background\` (hex), optional \`backgroundStyle\` ("solid" | "linear" | "radial") with \`background2\`, \`lighting\` ("soft" | "studio" for product shots), \`accentLight\` (hex), \`numberLocale\`, \`effects\`, \`layers\`, \`camera\`, \`audio\`. Ids are generated for you; omit them on new items and keep them when editing a project from \`get_project\`.

## Layers
Every layer: \`name\`, \`kind\` (${LAYER_KINDS.join(' | ')}), \`position\` [x, y, z], \`rotation\`, \`scale\` (default 1), \`opacity\` (default 1), \`color\` (hex), \`start\` + \`duration\` (its clip, in seconds of the video), \`blocks\`.
- **Clip**: the layer is drawn only inside [start, start + duration). A hard cut is one clip ending on the frame the next begins. Use frame-exact times (n / fps).
- **List order**: the first layer in the array is in front when layers share a depth. Overlapping flat layers also need slightly different z (0.01 apart, front one larger) or they flicker.
- \`text\`: \`text\`, \`fontSize\` (units, default 0.4), \`fontFamily\`, \`fontWeight\` (400 | 700), \`align\` (left | center | right — the position is that edge/centre), \`textWidth\` (wrap width, default 5), \`letterSpacing\`, \`lineHeight\`. Use \\n for line breaks.
- \`image\`: \`image\` reference; 3 units wide at scale 1, height from the image's aspect ratio (scale = wanted_width / 3). Transparent PNGs work. \`tint: true\` multiplies a white image by \`color\` so users can recolour it.
- \`phone\` (1.7 × 3.5 units), \`tablet\` (3.6 × 2.6), \`laptop\` (3.8 wide; \`lidAngle\` degrees): real 3D models. \`image\` is the screenshot shown on the screen; \`deviceFinish\` is silver | space | titanium | blue.
- \`shape\`: \`shape\` (cube | rect | rounded | circle), \`shapeWidth\`, \`shapeHeight\` in units, filled with \`color\`.
- \`svg\`: \`media\` reference; \`tint\` paints it with \`color\`; \`extrude\` gives 3D thickness.
- \`video\`: \`media\` reference; 3 units wide; \`mediaOffset\` seconds into the source. Its sound is not used (add an audio clip).
- File references are \`"asset:<id>"\` from \`create_upload\`. Do not embed base64.

## Blocks
A block is \`{ preset, start, duration, easing?, bezier?, params? }\`.
- **Layer block \`start\` is relative to the layer's clip start. Camera block \`start\` is relative to the video start.**
- Entrance blocks (category "in", and the text reveals) keep the layer hidden from the clip start until they begin; exit blocks keep it hidden after they end.
- \`easing\`: ${EASINGS.join(', ')}, or "custom" with \`bezier: [x1, y1, x2, y2]\` (CSS cubic-bezier). Fit a custom bezier to measured positions when matching a reference.
- For a cinematic device shot use ONE long \`move\` with a decelerating bezier, not a short entrance followed by a separate drift (the speed visibly breaks between two blocks).

### Layer blocks
${presetLines('layer')}

### Camera blocks
${presetLines('camera')}

## Effects
\`effects\` overrides defaults per group: bloom {enabled, intensity, threshold} (ON by default), vignette {enabled, darkness} (ON by default), dof {enabled, bokeh, range}, grain, color {saturation, contrast, brightness: -1..1}, motionBlur {enabled, samples, shutter} (export only), chromatic, distortion, lensFlare, lightLeak. For flat UI on a light background turn bloom and vignette off: \`"effects": { "bloom": { "enabled": false }, "vignette": { "enabled": false } }\`. Depth of field blurs text too: in shots with text add a \`focus-pull\` with \`blur: 0\`.

## Fonts
${FONT_IDS.join(', ')}. "inter-medium" (500/600) is the closest to SF Pro.

## Audio
\`audio\`: [{ name, asset: "asset:<id>", start, offset, duration, sourceDuration, volume (0..1), fadeIn, fadeOut }]. Upload music / sound effects with \`create_upload\` (kind "audio").

## Working from a reference video
1. Probe it (ffprobe) and extract every frame at its native rate with ffmpeg; look at the frames, do not guess.
2. List the shots: cut frames, what is on screen, text, colours, fonts, devices, small details (glows, borders, cursors).
3. Measure timing and motion in frames: when each element enters/exits, its position at several frames, camera zoom/pan. Convert pixels to units and frames to seconds (n / fps).
4. Recreate the design with the user's own content, logo and brand. Do not copy another company's assets, logos or screenshots; ask the user for theirs.
5. Build the JSON, \`save_project\`, and give the user the link. Ask them to check it in the Studio and iterate on their feedback with \`get_project\` → edit → \`save_project\` (same id).

## Example
\`\`\`json
${JSON.stringify(EXAMPLE, null, 1)}
\`\`\`
`
}
