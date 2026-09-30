import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderer,
} from "three";

/**
 * The landing page's one WebGL object: a curl-ish flow field rendered as a
 * single additive point cloud.
 *
 * Deliberately no EffectComposer and no post-processing passes — a full-screen
 * quad pass would roughly double the fragment cost to produce a bloom the
 * additive blend already gives us for free. Everything below runs in the vertex
 * shader, so the per-frame CPU cost is one uniform upload and one draw call
 * regardless of particle count.
 *
 * The whole scene is driven by three uniforms — uTime, uProgress (scroll) and
 * uPointer — so GSAP only ever writes numbers; it never touches the scene graph.
 */

const PARTICLES = 9000;
const FIELD_DEPTH = 90;
const FIELD_SPREAD = 46;

const VERT = /* glsl */ `
  attribute float aSeed;
  attribute float aScale;
  attribute float aHeat;

  uniform float uTime;
  uniform float uProgress;
  uniform vec2  uPointer;
  uniform float uDepth;
  uniform float uSpread;
  uniform float uPixelRatio;

  varying float vHeat;
  varying float vFade;
  varying float vSpeed;

  // Cheap divergence-free-ish field. Three offset sine lobes beat a real curl
  // noise here: no simplex texture to upload, and it stays smooth at the
  // sampling density we actually use.
  vec3 flow(vec3 p, float t) {
    float a = sin(p.z * 0.14 + t * 0.55) + cos(p.y * 0.11 - t * 0.41);
    float b = sin(p.y * 0.13 - t * 0.37) + cos(p.x * 0.16 + t * 0.29);
    float c = sin(p.x * 0.10 + t * 0.33) + cos(p.z * 0.12 + t * 0.47);
    return normalize(vec3(a, b * 0.55, c) + 0.0001);
  }

  void main() {
    vec3 p = position;

    // Each particle keeps its own phase, so the field never pulses in unison.
    float phase = aSeed * 6.2831;
    float t = uTime + aSeed * 4.0;

    vec3 dir = flow(p, t);
    p += dir * (2.4 + aScale * 5.5) * (0.6 + 0.4 * sin(t * 0.7));

    // Scroll: stream the field toward the camera and wrap it, so the cloud
    // appears infinitely deep no matter how far down the page the user is.
    p.z += mod(uProgress * uDepth + aSeed * uDepth, uDepth) - uDepth * 0.5;

    // Pointer parallax, weighted down with depth so it reads as a camera nudge
    // rather than the whole cloud sliding.
    float near = 1.0 - clamp(abs(p.z) / (uDepth * 0.5), 0.0, 1.0);
    p.xy += uPointer * near * 2.6;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    // Perspective-correct sizing, with a floor so distant motes stay sub-pixel
    // bright instead of flickering in and out as they cross the threshold.
    float depthScale = 46.0 / max(-mv.z, 0.6);
    gl_PointSize = clamp(aScale * uPixelRatio * depthScale, 1.0, 9.0);

    vHeat = clamp(aHeat + dir.y * 0.35, 0.0, 1.0);
    vSpeed = 0.55 + 0.45 * sin(t * 0.9 + phase);
    // Fade both ends of the depth range so the wrap-around is invisible.
    vFade = smoothstep(uDepth * 0.5, uDepth * 0.16, abs(p.z - 0.0)) *
            smoothstep(0.0, 6.0, -mv.z);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uCalm;
  uniform vec3 uHot;

  varying float vHeat;
  varying float vFade;
  varying float vSpeed;

  void main() {
    // Round, soft-edged sprite computed from gl_PointCoord — cheaper than
    // sampling a generated texture and resolution-independent.
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;

    float core = pow(1.0 - r, 2.4);
    float halo = (1.0 - r) * 0.35;

    vec3 tint = mix(uCalm, uHot, smoothstep(0.25, 0.9, vHeat));
    float alpha = (core + halo) * vFade * (0.35 + vSpeed * 0.5);

    gl_FragColor = vec4(tint, alpha);
  }
`;

export interface Field {
  /** Scroll progress, 0 at the top of the page, 1 at the bottom. */
  setProgress: (value: number) => void;
  /** Pointer position in normalised device coords (-1..1). */
  setPointer: (x: number, y: number) => void;
  resize: () => void;
  render: (elapsed: number) => void;
  dispose: () => void;
}

export function createField(canvas: HTMLCanvasElement): Field | null {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    // No WebGL: the page is still fully readable and scrollable without it.
    return null;
  }
  if (!renderer.getContext()) return null;

  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 1, 0.1, 200);
  camera.position.set(0, 0, 26);

  // Deterministic PRNG so the field is identical between reloads — a landing
  // page that reshuffles its own background on every refresh reads as a bug.
  let seedState = 0x2f6e2b1;
  const rand = () => {
    seedState ^= seedState << 13;
    seedState ^= seedState >>> 17;
    seedState ^= seedState << 5;
    return ((seedState >>> 0) % 100000) / 100000;
  };

  const positions = new Float32Array(PARTICLES * 3);
  const seeds = new Float32Array(PARTICLES);
  const scales = new Float32Array(PARTICLES);
  const heats = new Float32Array(PARTICLES);

  for (let i = 0; i < PARTICLES; i++) {
    positions[i * 3] = (rand() - 0.5) * FIELD_SPREAD;
    positions[i * 3 + 1] = (rand() - 0.5) * FIELD_SPREAD;
    positions[i * 3 + 2] = (rand() - 0.5) * FIELD_DEPTH;
    seeds[i] = rand();
    // Skew toward small: a few large motes read as depth cues, thousands of
    // large ones read as noise.
    scales[i] = 0.35 + Math.pow(rand(), 3) * 1.5;
    heats[i] = Math.pow(rand(), 1.8);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1));
  geometry.setAttribute("aScale", new BufferAttribute(scales, 1));
  geometry.setAttribute("aHeat", new BufferAttribute(heats, 1));

  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPointer: { value: new Vector2(0, 0) },
      uPixelRatio: { value: 1 },
      uDepth: { value: FIELD_DEPTH },
      uSpread: { value: FIELD_SPREAD },
      // Matches --color-accent and --color-critical in the shared tokens.
      uCalm: { value: new Color(0x6f78ff) },
      uHot: { value: new Color(0xff4c41) },
    },
  });

  const points = new Points(geometry, material);
  scene.add(points);

  let progress = 0;
  const pointer = new Vector2(0, 0);
  let pointerTarget = new Vector2(0, 0);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull the camera back on narrow viewports so the field still fills the
    // frame instead of showing its edges on a phone.
    camera.position.z = h > w ? 34 : 26;
    camera.updateProjectionMatrix();
    material.uniforms.uPixelRatio.value = dpr;
  };

  resize();
  window.addEventListener("resize", resize);

  return {
    setProgress: (value) => {
      progress = value;
    },
    setPointer: (x, y) => {
      pointerTarget.set(x, y);
    },
    resize,
    render: (elapsed) => {
      // Critically-damped-ish follow so the parallax never snaps.
      pointer.lerp(pointerTarget, 0.06);
      material.uniforms.uTime.value = elapsed;
      material.uniforms.uProgress.value = progress;
      material.uniforms.uPointer.value.copy(pointer);
      renderer.render(scene, camera);
    },
    dispose: () => {
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
