import { Effect } from 'postprocessing'
import { Uniform, Vector2, type WebGLRenderer } from 'three'

/**
 * Screen-print CMYK: AM halftone (dot size from local luminance), fixed grids,
 * spatial “plate slip” so misregistration comes and goes. No time, no film grain.
 */
export class HalftoneChromaPatchEffect extends Effect {
  private readonly _resScratch = new Vector2()

  constructor(options: {
    dotGrid?: number
    halftoneIntensity?: number
    patchRadius?: number
    reputationNorm?: number
    globalIridescence?: number
  } = {}) {
    const {
      dotGrid = 72,
      halftoneIntensity = 0.78,
      patchRadius = 0.12,
      reputationNorm = 0.35,
      globalIridescence = 0.22,
    } = options

    const fragmentShader = `
uniform float uDotGrid;
uniform float uHalftoneIntensity;
uniform float uPatchRadius;
uniform vec2 uResolution;
uniform float uRepNorm;
uniform float uGlobalIrid;

float luma(vec3 c) {
  return dot(clamp(c, 0.0, 1.0), vec3(0.299, 0.587, 0.114));
}

/* 0 = quiet press, 1 = heavy slip — varies slowly over the frame */
float slipField(vec2 uv, float seed) {
  vec2 p = uv * vec2(52.0, 47.0) + vec2(seed * 1.7, seed * 2.3);
  float s = sin(p.x) * sin(p.y * 1.07) * sin((uv.x - uv.y) * 38.0 + seed);
  return smoothstep(0.22, 0.82, 0.5 + 0.5 * s);
}

vec2 slipOffsets(vec2 onePx, vec2 uv, float seed, float rep) {
  float s = slipField(uv, seed);
  float mag = mix(0.75, 2.85, s) * mix(1.0, 1.35, rep);
  float s2 = slipField(uv * 1.28 + vec2(0.11, 0.19), seed + 3.1);
  return vec2(onePx.x * mag * mix(0.85, 1.15, s2), onePx.y * mag * mix(0.9, 1.1, 1.0 - s2 * 0.35));
}

float patchMaskFixed(vec2 uv, float id) {
  float fi = id * 2.718;
  vec2 c = vec2(0.5) + 0.4 * vec2(sin(fi * 1.9), cos(fi * 1.2));
  float d = distance(uv, c);
  return smoothstep(uPatchRadius, uPatchRadius * 0.28, d);
}

float halftoneDot(vec2 uv, vec2 gridShift, float grid, float radiusCell, float rotAng) {
  vec2 p = (uv + gridShift) * grid;
  vec2 f = fract(p) - 0.5;
  float ca = cos(rotAng);
  float sa = sin(rotAng);
  f = vec2(ca * f.x - sa * f.y, sa * f.x + ca * f.y);
  float d = length(f);
  return step(d, radiusCell);
}

float amRadius(float rBase, float toneDark01, float rep) {
  float lo = mix(0.05, 0.11, rep);
  return rBase * mix(lo, 1.0, toneDark01);
}

vec3 cmyScreenAM(vec3 base, vec2 uv, vec2 onePx, float grid, float rBase,
               float ink, float rotC, float rotM, float rotY,
               vec2 offM, vec2 offY, float Lpre) {
  float t = 1.0 - smoothstep(0.06, 0.97, Lpre);
  float r = amRadius(rBase, t, uRepNorm);
  float cDot = halftoneDot(uv, vec2(0.0), grid, r, rotC);
  float mDot = halftoneDot(uv, offM, grid, r, rotM);
  float yDot = halftoneDot(uv, offY, grid, r, rotY);
  vec3 o = base;
  o.r *= 1.0 - ink * cDot;
  o.g *= 1.0 - ink * mDot;
  o.b *= 1.0 - ink * yDot;
  return o;
}

vec3 kScreenAM(vec3 base, vec2 uv, vec2 onePx, float grid, float rBase,
              float inkK, float rotK, vec2 offK, float Lpre) {
  float t = 1.0 - smoothstep(0.02, 0.9, Lpre);
  float r = amRadius(rBase * 1.05, t, uRepNorm);
  float kDot = halftoneDot(uv, offK, grid, r, rotK);
  float km = 1.0 - inkK * kDot;
  return base * km;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 onePx = vec2(1.0) / res;
  float rep = clamp(uRepNorm, 0.0, 1.0);
  float grid = max(18.0, mix(32.0, uDotGrid, 0.35 + rep * 0.65));
  float radiusCell = mix(0.14, 0.48, rep);

  const float bdM = 0.261799;
  const float bdY = 1.308996939;
  const float scC = 0.785398163;
  const float scM = -0.436332313;
  const float scY = 0.174532925;
  const float kAng = 0.663225115;

  vec3 base = inputColor.rgb;
  float L0 = luma(base);

  vec2 offBDm = slipOffsets(onePx, uv, 0.0, rep);
  vec2 offBDy = slipOffsets(onePx, uv + vec2(0.03, -0.02), 1.4, rep);
  float inkBD = uGlobalIrid * (0.32 + 0.3 * rep);
  float gridBD = grid * 0.5;
  float rBD = radiusCell * 1.08;

  vec3 col = cmyScreenAM(
    base, uv, onePx, gridBD, rBD, inkBD,
    0.0, bdM, bdY,
    vec2(offBDm.x, 0.0),
    vec2(0.0, offBDy.y),
    L0
  );

  vec2 offSm = slipOffsets(onePx, uv * 1.05 + 0.07, 2.8, rep);
  vec2 offSy = slipOffsets(onePx, uv * 1.05 - 0.04, 4.1, rep);
  float inkScr = uGlobalIrid * (0.24 + 0.22 * rep);
  float gridScr = grid * 1.32;
  float rScr = radiusCell * 0.55;
  col = cmyScreenAM(
    col, uv, onePx, gridScr, rScr, inkScr,
    scC, scM, scY,
    vec2(offSm.x, 0.0),
    vec2(0.0, offSy.y),
    L0
  );

  float inkK = uGlobalIrid * (0.34 + 0.36 * rep);
  vec2 offK = slipOffsets(onePx * 1.1, uv + vec2(-0.06, 0.05), 5.2, rep);
  col = kScreenAM(col, uv, onePx, grid * 0.88, radiusCell, inkK, kAng, offK, L0);

  float m = 0.0;
  m = max(m, patchMaskFixed(uv, 0.0));
  m = max(m, patchMaskFixed(uv, 1.0));
  m = max(m, patchMaskFixed(uv, 2.0));
  m = max(m, patchMaskFixed(uv, 3.0));
  m = max(m, patchMaskFixed(uv, 4.0));
  m = max(m, patchMaskFixed(uv, 5.0));
  m = max(m, patchMaskFixed(uv, 6.0));
  m = max(m, patchMaskFixed(uv, 7.0));

  vec2 offP = slipOffsets(onePx * 1.35, uv, 6.7, rep);
  vec3 pCol = base;
  pCol = cmyScreenAM(
    pCol, uv, onePx, gridBD, rBD, inkBD * 1.42,
    0.0, bdM, bdY,
    vec2(offP.x * 1.25, 0.0),
    vec2(0.0, offP.y * 1.2),
    L0
  );
  pCol = cmyScreenAM(
    pCol, uv, onePx, gridScr, rScr, inkScr * 1.34,
    scC, scM, scY,
    vec2(offP.x * 0.95, 0.0),
    vec2(0.0, offP.y * 0.92),
    L0
  );
  pCol = kScreenAM(pCol, uv, onePx, grid * 0.88, radiusCell, inkK * 1.2, kAng, offP * 1.1, L0);

  col = mix(col, pCol, m * uHalftoneIntensity);
  outputColor = vec4(col, inputColor.a);
}
`

    super('HalftoneChromaPatchEffect', fragmentShader, {
      uniforms: new Map<string, Uniform>([
        ['uDotGrid', new Uniform(dotGrid)],
        ['uHalftoneIntensity', new Uniform(halftoneIntensity)],
        ['uPatchRadius', new Uniform(patchRadius)],
        ['uResolution', new Uniform(new Vector2(1920, 1080))],
        ['uRepNorm', new Uniform(reputationNorm)],
        ['uGlobalIrid', new Uniform(globalIridescence)],
      ]),
    })
  }

  update(renderer: WebGLRenderer, _inputBuffer: unknown, _deltaTime?: number) {
    renderer.getDrawingBufferSize(this._resScratch)
    const uRes = this.uniforms.get('uResolution')
    if (uRes) (uRes.value as Vector2).copy(this._resScratch)
  }

  setDotGrid(value: number) {
    const u = this.uniforms.get('uDotGrid')
    if (u) u.value = value
  }

  setHalftoneIntensity(value: number) {
    const u = this.uniforms.get('uHalftoneIntensity')
    if (u) u.value = Math.max(0, Math.min(1, value))
  }

  setPatchRadius(value: number) {
    const u = this.uniforms.get('uPatchRadius')
    if (u) u.value = value
  }

  setReputationNorm(value: number) {
    const u = this.uniforms.get('uRepNorm')
    if (u) u.value = Math.max(0, Math.min(1, value))
  }

  setGlobalIridescence(value: number) {
    const u = this.uniforms.get('uGlobalIrid')
    if (u) u.value = Math.max(0, Math.min(1, value))
  }
}
