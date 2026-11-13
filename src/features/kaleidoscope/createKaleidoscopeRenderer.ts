import {
  BufferGeometry,
  Camera,
  Color,
  Float32BufferAttribute,
  MathUtils,
  Mesh,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  WebGLRenderer,
} from "three";

import fragmentShader from "./shaders/kaleidoscope.frag.glsl?raw";
import vertexShader from "./shaders/fullscreen.vert.glsl?raw";
import {
  normalizeParameters,
  type KaleidoscopeParameters,
} from "./kaleidoscopeParameters";

export type KaleidoscopeRenderer = {
  resize: (width: number, height: number, pixelRatio: number) => void;
  setReducedMotion: (reduced: boolean) => void;
  setTargetParameters: (parameters: KaleidoscopeParameters) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
};

const scalarParameterKeys = [
  "speed",
  "scale",
  "warp",
  "detail",
  "contrast",
  "glow",
  "vignette",
] as const;

function createFullscreenTriangle() {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  );
  return geometry;
}

export function createKaleidoscopeRenderer(
  canvas: HTMLCanvasElement,
  initialParameters: KaleidoscopeParameters,
): KaleidoscopeRenderer {
  const initial = normalizeParameters(initialParameters);
  let current = normalizeParameters(initial);
  let target = normalizeParameters(initial);
  let targetColors = target.palette.map((color) => new Color(color));
  const currentColors = current.palette.map((color) => new Color(color));

  const renderer = new WebGLRenderer({
    canvas,
    alpha: false,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x020204, 1);
  renderer.outputColorSpace = SRGBColorSpace;

  const uniforms = {
    uResolution: { value: new Vector2(1, 1) },
    uTime: { value: 0 },
    uSymmetry: { value: initial.symmetry },
    uSpeed: { value: initial.speed },
    uScale: { value: initial.scale },
    uWarp: { value: initial.warp },
    uDetail: { value: initial.detail },
    uContrast: { value: initial.contrast },
    uGlow: { value: initial.glow },
    uVignette: { value: initial.vignette },
    uPalette0: { value: currentColors[0] },
    uPalette1: { value: currentColors[1] },
    uPalette2: { value: currentColors[2] },
    uPalette3: { value: currentColors[3] },
  };

  const material = new ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  const geometry = createFullscreenTriangle();
  const mesh = new Mesh(geometry, material);
  mesh.frustumCulled = false;

  const scene = new Scene();
  scene.add(mesh);
  const camera = new Camera();

  let animationFrame: number | null = null;
  let running = false;
  let reducedMotion = false;
  let lastRenderedAt = performance.now();
  let elapsedTime = 0;

  function updateParameters(deltaSeconds: number) {
    const smoothing = 1 - Math.exp(-3.4 * deltaSeconds);

    for (const key of scalarParameterKeys) {
      current[key] = MathUtils.lerp(current[key], target[key], smoothing);
    }

    current.symmetry = target.symmetry;

    currentColors.forEach((color, index) => {
      const targetColor = targetColors[index];
      if (targetColor) {
        color.lerp(targetColor, smoothing);
      }
    });

    uniforms.uSymmetry.value = current.symmetry;
    uniforms.uSpeed.value = current.speed;
    uniforms.uScale.value = current.scale;
    uniforms.uWarp.value = current.warp;
    uniforms.uDetail.value = current.detail;
    uniforms.uContrast.value = current.contrast;
    uniforms.uGlow.value = current.glow;
    uniforms.uVignette.value = current.vignette;
  }

  function renderFrame(now: number) {
    if (!running) {
      return;
    }

    const minimumFrameDuration = reducedMotion ? 100 : 0;
    const durationSinceRender = now - lastRenderedAt;

    if (durationSinceRender >= minimumFrameDuration) {
      const deltaSeconds = Math.min(durationSinceRender / 1000, 0.1);
      lastRenderedAt = now;
      elapsedTime += deltaSeconds * (reducedMotion ? 0.045 : 1);
      updateParameters(deltaSeconds);
      uniforms.uTime.value = elapsedTime;
      renderer.render(scene, camera);
    }

    animationFrame = requestAnimationFrame(renderFrame);
  }

  function resize(width: number, height: number, pixelRatio: number) {
    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));
    renderer.setPixelRatio(Math.min(Math.max(pixelRatio, 1), 1.5));
    renderer.setSize(safeWidth, safeHeight, false);
    renderer.getDrawingBufferSize(uniforms.uResolution.value);
    renderer.render(scene, camera);
  }

  function setTargetParameters(parameters: KaleidoscopeParameters) {
    target = normalizeParameters(parameters);
    targetColors = target.palette.map((color) => new Color(color));
  }

  function setReducedMotion(reduced: boolean) {
    reducedMotion = reduced;
  }

  function start() {
    if (running) {
      return;
    }

    running = true;
    lastRenderedAt = performance.now();
    animationFrame = requestAnimationFrame(renderFrame);
  }

  function stop() {
    running = false;
    if (animationFrame !== null) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  }

  function dispose() {
    stop();
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  }

  return {
    resize,
    setReducedMotion,
    setTargetParameters,
    start,
    stop,
    dispose,
  };
}
