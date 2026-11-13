precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform float uSymmetry;
uniform float uSpeed;
uniform float uScale;
uniform float uWarp;
uniform float uDetail;
uniform float uContrast;
uniform float uGlow;
uniform float uVignette;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform vec3 uPalette3;

const float PI = 3.141592653589793;
const float TAU = 6.283185307179586;

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

float hash21(vec2 point) {
  point = fract(point * vec2(123.34, 456.21));
  point += dot(point, point + 45.32);
  return fract(point.x * point.y);
}

float valueNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  vec2 curve = local * local * (3.0 - 2.0 * local);

  float bottomLeft = hash21(cell);
  float bottomRight = hash21(cell + vec2(1.0, 0.0));
  float topLeft = hash21(cell + vec2(0.0, 1.0));
  float topRight = hash21(cell + vec2(1.0, 1.0));

  return mix(
    mix(bottomLeft, bottomRight, curve.x),
    mix(topLeft, topRight, curve.x),
    curve.y
  );
}

float fractalNoise(vec2 point) {
  float value = 0.0;
  float amplitude = 0.52;
  mat2 transform = rotate2d(0.58) * 2.03;

  for (int octave = 0; octave < 6; octave++) {
    float enabled = step(float(octave), 2.0 + uDetail * 3.0);
    value += valueNoise(point) * amplitude * enabled;
    point = transform * point + vec2(3.17, 7.31);
    amplitude *= 0.51;
  }

  return value;
}

vec3 palette(float position) {
  float scaled = clamp(position, 0.0, 0.9999) * 3.0;

  if (scaled < 1.0) {
    return mix(uPalette0, uPalette1, smoothstep(0.0, 1.0, scaled));
  }

  if (scaled < 2.0) {
    return mix(uPalette1, uPalette2, smoothstep(0.0, 1.0, scaled - 1.0));
  }

  return mix(uPalette2, uPalette3, smoothstep(0.0, 1.0, scaled - 2.0));
}

void main() {
  vec2 screenUv = gl_FragCoord.xy / uResolution;
  vec2 centered = (2.0 * gl_FragCoord.xy - uResolution) /
    min(uResolution.x, uResolution.y);

  float radius = length(centered);
  float angle = atan(centered.y, centered.x);
  float sector = TAU / max(uSymmetry, 3.0);
  float foldedAngle = abs(mod(angle + sector * 0.5, sector) - sector * 0.5);

  vec2 folded = vec2(cos(foldedAngle), sin(foldedAngle));
  folded *= radius * (2.4 * uScale);

  float time = uTime * uSpeed;
  folded += vec2(
    sin(radius * 2.7 - time * 0.38),
    cos(radius * 2.2 + time * 0.31)
  ) * 0.055;

  float broadNoise = fractalNoise(folded * 0.72 + vec2(time * 0.09, -time * 0.07));
  vec2 domainWarp = vec2(
    fractalNoise(folded * 1.28 + vec2(6.7, time * 0.11)),
    fractalNoise(rotate2d(1.43) * folded * 1.22 - vec2(time * 0.08, 2.9))
  );

  vec2 warped = folded + (domainWarp - 0.5) * (1.15 * uWarp);
  warped = rotate2d(0.08 * sin(time * 0.12)) * warped;

  float mediumNoise = fractalNoise(warped * (1.35 + 0.5 * uDetail));
  float fineNoise = fractalNoise(
    rotate2d(-0.73) * warped * (2.65 + 1.35 * uDetail) + broadNoise * 1.9
  );
  float ridge = 1.0 - abs(2.0 * fineNoise - 1.0);

  float radialWave = 0.5 + 0.5 * sin(
    radius * (20.0 + 4.0 * uDetail) - time * 0.72 + mediumNoise * 6.2
  );
  float diagonalWave = 0.5 + 0.5 * sin(
    (warped.x * 7.0 - warped.y * 4.4) + fineNoise * 5.3 + time * 0.28
  );

  float field = mediumNoise * 0.42 + ridge * 0.31 + radialWave * 0.17 +
    diagonalWave * 0.10;

  float fissure = abs(sin(
    warped.x * 6.5 + warped.y * 3.4 + broadNoise * 7.0 - time * 0.2
  ));
  float veinMask = smoothstep(0.075, 0.23, fissure);
  float fillMask = smoothstep(0.43, 0.63, field) * veinMask;
  float halo = exp(-22.0 * abs(field - 0.53)) * veinMask;

  float centerOpening = smoothstep(0.025, 0.15, radius);
  float outerFalloff = 1.0 - smoothstep(1.38, 2.2, radius);
  float structure = fillMask * centerOpening * outerFalloff;

  float colorPosition = fract(
    mediumNoise * 1.27 + fineNoise * 0.93 + radialWave * 0.41 +
      radius * 0.62 + time * 0.025
  );
  vec3 color = palette(colorPosition);

  float brightness = 0.95 + 1.02 * ridge + 0.32 * radialWave;
  color *= structure * brightness * 1.18;
  color += palette(fract(colorPosition + 0.12)) * halo * uGlow * 0.42 *
    centerOpening * outerFalloff;

  float vignette = pow(
    16.0 * screenUv.x * screenUv.y * (1.0 - screenUv.x) *
      (1.0 - screenUv.y),
    0.24
  );
  color *= mix(1.0, vignette, uVignette * 0.72);

  color = (color - 0.5) * uContrast + 0.5;
  color = max(color, vec3(0.0));
  color = pow(color, vec3(0.86));

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
