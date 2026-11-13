export type KaleidoscopePalette = readonly [string, string, string, string];

export type KaleidoscopeParameters = {
  symmetry: number;
  speed: number;
  scale: number;
  warp: number;
  detail: number;
  contrast: number;
  glow: number;
  vignette: number;
  palette: KaleidoscopePalette;
};

const limits = {
  symmetry: [4, 18],
  speed: [0, 1.5],
  scale: [0.5, 2.5],
  warp: [0, 1.5],
  detail: [0, 1],
  contrast: [0.75, 1.75],
  glow: [0, 1],
  vignette: [0, 1],
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function normalizeParameters(
  parameters: KaleidoscopeParameters,
): KaleidoscopeParameters {
  return {
    symmetry: Math.round(
      clamp(parameters.symmetry, limits.symmetry[0], limits.symmetry[1]),
    ),
    speed: clamp(parameters.speed, limits.speed[0], limits.speed[1]),
    scale: clamp(parameters.scale, limits.scale[0], limits.scale[1]),
    warp: clamp(parameters.warp, limits.warp[0], limits.warp[1]),
    detail: clamp(parameters.detail, limits.detail[0], limits.detail[1]),
    contrast: clamp(
      parameters.contrast,
      limits.contrast[0],
      limits.contrast[1],
    ),
    glow: clamp(parameters.glow, limits.glow[0], limits.glow[1]),
    vignette: clamp(
      parameters.vignette,
      limits.vignette[0],
      limits.vignette[1],
    ),
    palette: [...parameters.palette] as KaleidoscopePalette,
  };
}
