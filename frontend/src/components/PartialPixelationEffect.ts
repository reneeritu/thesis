import { Effect } from 'postprocessing'
import { Uniform } from 'three'

/**
 * Patch pixelation: only a few small screen regions are blocky; patch centres
 * drift on independent paths so the “damage” never blankets the whole crystal.
 * (The prior noise-threshold pass tended to smear into most of the frame.)
 */
export class PartialPixelationEffect extends Effect {
  constructor(options: {
    /** How many large “screen blocks” the image is split into (higher = smaller pixels). */
    cellCount?: number
    /** 0..1 strength of the pixelated layer inside a patch. */
    pixelIntensity?: number
    /** Approx. radius of each patch in UV space (0.08–0.2 typical). */
    patchRadius?: number
    /** How many separate patches (4–8). */
    numPatches?: number
  } = {}) {
    const {
      cellCount = 64,
      pixelIntensity = 0.88,
      patchRadius = 0.14,
    } = options

    const fragmentShader = `
uniform float uTime;
uniform float uCellCount;
uniform float uPixelIntensity;
uniform float uPatchRadius;

// Soft moving blob: high at centre, 0 outside radius (most of the frame stays sharp)
float patchMask(vec2 uv, float t, float id) {
  float fi = id * 2.718;
  float sp = 0.35 + 0.11 * mod(id, 3.0);
  vec2 c = vec2(0.5) + 0.44 * vec2(
    sin(t * sp + fi * 1.9),
    cos(t * (sp * 0.9) + fi * 1.2)
  );
  c += 0.07 * vec2(
    sin(t * 0.8 + id * 4.0),
    cos(t * 0.75 + id * 3.0)
  );
  float d = distance(uv, c);
  return smoothstep(uPatchRadius, uPatchRadius * 0.28, d);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float t = uTime;
  float m = 0.0;
  m = max(m, patchMask(uv, t, 0.0));
  m = max(m, patchMask(uv, t, 1.0));
  m = max(m, patchMask(uv, t, 2.0));
  m = max(m, patchMask(uv, t, 3.0));
  m = max(m, patchMask(uv, t, 4.0));
  m = max(m, patchMask(uv, t, 5.0));
  m = max(m, patchMask(uv, t, 6.0));
  m = max(m, patchMask(uv, t, 7.0));

  float cells = max(8.0, uCellCount);
  vec2 q = floor(uv * cells) / cells;
  vec4 blocky = texture2D(inputBuffer, q);
  outputColor = mix(inputColor, blocky, m * uPixelIntensity);
}
    `

    super('PartialPixelationEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uCellCount', new Uniform(cellCount)],
        ['uPixelIntensity', new Uniform(pixelIntensity)],
        ['uPatchRadius', new Uniform(patchRadius)],
      ]),
    })
  }

  update(_renderer: unknown, _inputBuffer: unknown, deltaTime?: number) {
    const u = this.uniforms.get('uTime')
    if (u) u.value += deltaTime ?? 0.016
  }

  setCellCount(value: number) {
    const u = this.uniforms.get('uCellCount')
    if (u) u.value = value
  }

  setPixelIntensity(value: number) {
    const u = this.uniforms.get('uPixelIntensity')
    if (u) u.value = Math.max(0, Math.min(1, value))
  }

  setPatchRadius(value: number) {
    const u = this.uniforms.get('uPatchRadius')
    if (u) u.value = value
  }
}
