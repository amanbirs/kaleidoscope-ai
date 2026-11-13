# Kaleidoscope mathematics

Status: Matches the first implemented shader pass
Last updated: 2026-11-13

## Purpose

The kaleidoscope is generated entirely in a fragment shader. Every visible pixel
is computed from its screen position, time, and a small set of visual parameters.
There are no source images or input textures.

The implementation lives in:

- `src/features/kaleidoscope/shaders/kaleidoscope.frag.glsl`;
- `src/features/kaleidoscope/shaders/fullscreen.vert.glsl`; and
- `src/features/kaleidoscope/createKaleidoscopeRenderer.ts`.

This document uses ordinary mathematical notation where it makes the behavior
clear and includes the constants used by the current shader.

## Notation and resolution

Let a fragment have drawing-buffer coordinates `(x, y)`. Let:

- `w` be the WebGL drawing-buffer width in physical pixels;
- `h` be the WebGL drawing-buffer height in physical pixels;
- `t` be elapsed animation time in seconds; and
- `N` be the number of symmetry segments.

The renderer passes `(w, h)` to GLSL as `uResolution`. These values are the CSS
canvas dimensions multiplied by the effective device pixel ratio, capped at
`1.5`. They are not necessarily the CSS width and height.

The normalized screen coordinate used for the vignette is:

```text
u = (x / w, y / h)
```

The aspect-correct centered coordinate is:

```text
p = (2(x, y) - (w, h)) / min(w, h)
```

Dividing both axes by the smaller dimension ensures that circles remain circular
on both landscape and portrait screens.

## Polar coordinates

The shader converts the centered coordinate into radius and angle:

```text
r = sqrt(px² + py²)
θ = atan2(py, px)
```

The radius creates concentric structure. The angle is folded to produce radial
repetition and reflection.

## Kaleidoscope folding

For `N` segments, one angular sector has width:

```text
Δ = 2π / N
```

The original angle is repeated into that sector and mirrored around its center:

```text
φ = abs(mod(θ + Δ/2, Δ) - Δ/2)
```

The folded coordinate is reconstructed as:

```text
q = 2.4 × scale × r × (cos φ, sin φ)
```

The initial preset uses `N = 12`, so every source wedge is repeated and mirrored
twelve times around the center.

## Slow coordinate motion

Shader time is scaled by the `speed` parameter:

```text
τ = t × speed
```

Before fractal evaluation, the folded coordinate receives a small oscillating
offset:

```text
qx += 0.055 sin(2.7r - 0.38τ)
qy += 0.055 cos(2.2r + 0.31τ)
```

This prevents the underlying texture from appearing mechanically fixed to the
radial geometry.

## Deterministic value noise

The noise function divides the coordinate plane into integer grid cells. A
deterministic hash assigns a pseudo-random value to every corner. Neighboring
corner values are interpolated using the cubic Hermite curve:

```text
g(a) = a²(3 - 2a)
```

For local position `l = fract(q)`, `g(lx)` and `g(ly)` blend the four cell-corner
hashes. The curve has zero slope at both endpoints, avoiding visible hard seams
between cells.

The hash itself is deterministic rather than cryptographically random. Its GLSL
constants are `123.34`, `456.21`, and `45.32`, chosen to decorrelate nearby grid
coordinates cheaply.

## Fractal Brownian motion

Organic detail is produced by adding several transformed noise layers:

```text
F(q) = Σ ai n(Mi q + bi)
```

The current implementation begins with amplitude `a0 = 0.52`; every subsequent
amplitude is multiplied by `0.51`. Coordinates are rotated by `0.58` radians and
scaled by `2.03` between layers.

The loop has a maximum of six layers. `detail` activates approximately three to
six of them:

```text
active threshold = 2 + 3 × detail
```

Large layers establish broad regions, while higher-frequency layers add finer
fractal boundaries.

## Domain warping

Two independent fractal evaluations form a vector field:

```text
W(q) = (F1(q), F2(q))
```

The coordinate is displaced before further sampling:

```text
q' = q + 1.15 × warp × (W(q) - 0.5)
```

Subtracting `0.5` centers the noise vector around zero. This operation is domain
warping: instead of merely coloring by noise, it bends the coordinate space that
later noise functions observe. It produces the marbled, fluid forms visible
inside each mirrored wedge.

## Pattern fields

The warped coordinate is sampled at medium and fine scales. The fine value is
also converted into a ridge field:

```text
ridge = 1 - abs(2 × fineNoise - 1)
```

Values near the middle of the noise range become bright ridges, while values
near zero or one become dark.

The radial wave is:

```text
radial = 0.5 + 0.5 sin(r(20 + 4 × detail) - 0.72τ + 6.2 × mediumNoise)
```

The diagonal wave in warped space is:

```text
diagonal = 0.5 + 0.5 sin(7q'x - 4.4q'y + 5.3 × fineNoise + 0.28τ)
```

The main scalar field is a weighted combination:

```text
field = 0.42 × mediumNoise
      + 0.31 × ridge
      + 0.17 × radial
      + 0.10 × diagonal
```

## Fissures and black negative space

A separate oscillating function constructs dark veins:

```text
fissure = abs(sin(6.5q'x + 3.4q'y + 7 × broadNoise - 0.2τ))
veinMask = smoothstep(0.075, 0.23, fissure)
fillMask = smoothstep(0.43, 0.63, field) × veinMask
```

`smoothstep` turns continuous fields into antialiased soft masks. Pixels outside
the fill mask remain black, so negative space is part of the geometry rather than
a background placed behind an opaque pattern.

The center and outside are also bounded:

```text
centerOpening = smoothstep(0.025, 0.15, r)
outerFalloff = 1 - smoothstep(1.38, 2.2, r)
structure = fillMask × centerOpening × outerFalloff
```

## Palette mapping

A color position is assembled from spatial fields and wrapped into `[0, 1)`:

```text
c = fract(
    1.27 × mediumNoise
  + 0.93 × fineNoise
  + 0.41 × radial
  + 0.62r
  + 0.025τ
)
```

The larger coefficients make the value wrap repeatedly and distribute all four
colors across the image. `c` is mapped piecewise through the initial palette:

1. `#ff2f92` — pink;
2. `#ff9a3d` — orange;
3. `#35d7ff` — cyan; and
4. `#7656ff` — purple.

Adjacent palette values are blended with `smoothstep` rather than selected as
hard bands.

## Brightness and analytic glow

Local brightness depends on ridge and radial values:

```text
brightness = 0.95 + 1.02 × ridge + 0.32 × radial
```

Glow is calculated without a separate blur pass. It is strongest around a chosen
field contour:

```text
halo = exp(-22 × abs(field - 0.53)) × veinMask
```

This exponential falloff creates a narrow luminous region while retaining a
single draw call.

## Vignette and output transformation

The edge vignette uses normalized screen coordinate `u`:

```text
v = (16ux uy (1 - ux)(1 - uy))^0.24
```

The product approaches one near the center and zero at every edge. It is blended
with the unmodified color according to the `vignette` parameter.

Contrast is applied around a midpoint of `0.5`:

```text
color = (color - 0.5) × contrast + 0.5
```

Negative values are clamped to zero and a final exponent of `0.86` lifts
midtones. Three.js then performs the configured sRGB output conversion.

## Frame-rate-independent interpolation

The renderer stores current and target visual parameters separately. For a frame
duration `dt`, the interpolation factor is:

```text
α = 1 - exp(-3.4 × dt)
```

Every continuous value and palette color advances by:

```text
current = (1 - α) × current + α × target
```

Because `α` depends on elapsed time rather than frame count, transitions have
approximately the same speed on 30 Hz, 60 Hz, and high-refresh displays.
Symmetry currently changes directly to its integer target.

When reduced motion is requested, drawing is limited to approximately 10 frames
per second and shader time advances at `0.045` times the normal rate.

## Full-screen geometry and cost

The vertex shader draws one oversized triangle with clip-space vertices:

```text
(-1, -1), (3, -1), (-1, 3)
```

That triangle covers the complete viewport without the diagonal seam of a
two-triangle quad. The scene therefore uses one mesh, one material, and one draw
call per rendered frame. Most cost is proportional to:

```text
drawing-buffer pixels × active fractal layers
```

This is why device pixel ratio and fractal detail are the first quality controls
to reduce on slower hardware.

## Current parameter values

| Parameter | Current value | Mathematical role |
| --- | ---: | --- |
| `symmetry` | 12 | Number of repeated angular sectors |
| `speed` | 0.28 | Scales animation time |
| `scale` | 1.16 | Scales folded coordinates |
| `warp` | 0.82 | Domain-warp displacement strength |
| `detail` | 0.78 | Enables higher fractal layers and frequencies |
| `contrast` | 1.08 | Expands color distance around `0.5` |
| `glow` | 0.58 | Scales analytic halo contribution |
| `vignette` | 0.62 | Controls screen-edge darkening |

These are visual controls rather than emotion labels. The future mood layer will
map its output into this parameter space without changing the renderer's
mathematics.
