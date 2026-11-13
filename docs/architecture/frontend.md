# Kaleidoscope frontend architecture

Status: Accepted for the first implementation pass  
Last updated: 2026-11-10

## Scope of this pass

This document defines the first pass of the browser frontend: a full-page,
animated kaleidoscope on a black background.

Included:

- application scaffolding;
- canvas and renderer lifecycle;
- procedural kaleidoscope shader structure;
- visual parameter contract;
- responsive behavior;
- performance, accessibility, and fallback behavior; and
- validation of the standalone visual experience.

Explicitly deferred:

- chat UI;
- text and voice input;
- sentiment and emotion models;
- mood aggregation and message history;
- backend APIs;
- persistence and encryption;
- author and contact overlays; and
- mapping language-derived mood to visual parameters.

The visual parameter contract is defined now so later systems have a stable
integration point, but the frontend will use a fixed preset during this pass.

## Decisions

| Area | Choice | Reason |
| --- | --- | --- |
| Build tool | Vite | Fast, small SPA setup with first-class TypeScript support |
| UI framework | React | Suitable for the later chat and informational UI |
| Language | TypeScript | Makes the renderer boundary and parameter contract explicit |
| Graphics | Three.js directly | Strong shader support without another scene abstraction |
| Graphics API | WebGL through Three.js | Broad, sufficient support for this effect |
| Shader language | GLSL | Direct fit for the selected renderer |
| Styling | Plain CSS with custom properties | Small, bespoke interface without a styling dependency |
| State | Local React state and refs | No global state requirement in this pass |
| Rendering model | One full-screen triangle and one shader material | Minimal geometry and one draw call |

React Three Fiber, Next.js, a component library, a global state library,
post-processing packages, and WebGPU are deliberately excluded from the first
pass. They can be added later only in response to a demonstrated requirement.

Related research:
[Visualization library research](../research/visualization-libraries.md).

## System boundary

React owns the application lifecycle and normal document UI. Three.js owns the
GPU canvas and continuous animation loop.

```text
App
  └── KaleidoscopeCanvas
        ├── creates and disposes the Three.js renderer
        ├── observes canvas size and page visibility
        ├── owns the animation loop
        └── passes time, resolution, and parameters to shader uniforms
```

React must not update component state on every animation frame. Low-frequency
prop changes update target values, while mutable uniforms are updated inside the
renderer loop. This prevents the 60 FPS animation from causing React rerenders.

## Proposed source structure

```text
src/
  main.tsx
  App.tsx
  styles/
    global.css
  features/
    kaleidoscope/
      KaleidoscopeCanvas.tsx
      createKaleidoscopeRenderer.ts
      kaleidoscopeParameters.ts
      kaleidoscopePresets.ts
      shaders/
        fullscreen.vert.glsl
        kaleidoscope.frag.glsl
  types/
    glsl.d.ts
```

Responsibilities:

- `KaleidoscopeCanvas.tsx` mounts the canvas, manages resize observation, and
  connects React props to the renderer.
- `createKaleidoscopeRenderer.ts` creates Three.js resources and returns a small
  imperative API: `resize`, `setTargetParameters`, `start`, `stop`, and
  `dispose`.
- `kaleidoscopeParameters.ts` defines ranges, defaults, normalization, and
  interpolation behavior.
- `kaleidoscopePresets.ts` contains deterministic visual presets for development
  and later integration testing.
- the shader files contain GPU-specific visual logic without React concerns.

GLSL will live in separate files and be imported as source text by Vite. This
keeps the shader readable and makes the graphics work visible in the public
repository.

## Renderer lifecycle

`KaleidoscopeCanvas` creates the renderer once after the canvas mounts. The
renderer is not reconstructed when visual parameters change.

Initialization:

1. Obtain the canvas element from a React ref.
2. Create a `THREE.WebGLRenderer` using that canvas.
3. Create the full-screen triangle geometry.
4. Create one `ShaderMaterial` with the initial uniforms.
5. Create a minimal scene and mesh.
6. attach a `ResizeObserver` to the canvas container.
7. Start one `requestAnimationFrame` loop.

Each frame:

1. Calculate elapsed time from a monotonic clock.
2. Move current visual values toward their target values.
3. Update time, resolution, and visual uniforms.
4. Render the scene once.

Cleanup:

1. Cancel the animation frame.
2. Disconnect observers and visibility listeners.
3. Dispose the geometry and material.
4. Dispose the renderer.
5. Clear retained references.

Cleanup is part of the renderer API rather than being scattered across React
effects. This is important during development, where React may mount and unmount
components more than once to detect unsafe lifecycle behavior.

## Full-screen geometry

Use one oversized triangle that covers normalized device coordinates rather
than two triangles forming a quad. The vertex shader only needs to output clip
space position and any coordinates required by the fragment shader.

The fragment shader performs almost all visual work. There are no textures,
models, lights, cameras with perspective, or per-object animation in the first
pass.

## Shader pipeline

The fragment shader should be built in understandable stages:

1. **Coordinate normalization** — convert the fragment coordinate into a
   centered, aspect-correct coordinate system.
2. **Polar conversion** — calculate radius and angle from the center.
3. **Kaleidoscope folding** — repeat and mirror the angle into a wedge according
   to the symmetry count.
4. **Domain warping** — distort the folded coordinates with slow procedural
   motion.
5. **Fractal detail** — combine a bounded number of noise octaves to create
   recursive-looking structure.
6. **Shape construction** — create bands, cells, edges, and dark negative space.
7. **Palette mapping** — convert the scalar pattern into interpolated colors.
8. **Finishing** — apply contrast, restrained glow, vignette, and the final color
   transformation.

The black background should participate in the pattern. The shader should
produce genuinely dark negative space rather than covering every pixel with a
bright gradient.

The first pass should avoid multi-pass blur and bloom. A restrained analytic
glow inside the shader is cheaper and easier to tune. Post-processing should be
considered only after the single-pass result has been evaluated.

## Visual parameter contract

The renderer accepts visual parameters, not emotions or message content:

```ts
export type KaleidoscopeParameters = {
  symmetry: number;
  speed: number;
  scale: number;
  warp: number;
  detail: number;
  contrast: number;
  glow: number;
  vignette: number;
  palette: readonly [string, string, string, string];
};
```

Each property will have a documented safe range. Inputs are normalized before
they reach shader uniforms. `symmetry` is integer-valued; continuous parameters
are interpolated in the renderer; colors are interpolated in a perceptually
reasonable color space on the CPU or through a shader-safe representation.

The first pass uses one curated preset. Additional presets may be used for
development checks, but their names must describe visual qualities rather than
claiming to represent human emotions. The mood-mapping layer will own that
interpretation later.

## Animation and interpolation

The renderer maintains separate current and target parameter values. A
frame-rate-independent damping function moves current values toward targets.
This makes later mood updates smooth without coupling the renderer to message
history or sentiment logic.

Discrete structural values such as symmetry require special handling. Rather
than interpolating through fractional wedge counts, the initial implementation
will either:

- change symmetry only when the rest of the scene is visually quiet; or
- cross-fade between two pattern evaluations if testing shows that direct
  changes are too abrupt.

The simple quiet-point transition should be attempted first. A dual evaluation
costs more fragment-shader work and should be added only if necessary.

## Sizing and pixel density

The canvas fills the viewport through CSS. The renderer's drawing buffer follows
the observed CSS size rather than assuming `window.innerWidth` and
`window.innerHeight`.

Pixel ratio will be capped initially at `1.5`. Very high-density screens can
otherwise multiply fragment-shader work without a proportionate visual benefit.
The cap should become a measured setting rather than a permanent assumption.

The resize path updates:

- the renderer drawing-buffer size;
- the resolution uniform;
- aspect-correction calculations; and
- any quality tier derived from viewport size.

## Performance strategy

Initial performance constraints:

- one renderer;
- one scene;
- one mesh;
- one draw call per frame;
- no input textures;
- no offscreen render targets;
- no post-processing pass;
- a fixed, bounded fractal octave count; and
- a capped device pixel ratio.

Development builds should expose frame time and effective drawing-buffer size.
Performance must be checked on both an ordinary laptop and a representative
mobile device before adding more shader complexity.

If performance is insufficient, reduce work in this order:

1. pixel ratio;
2. fractal octave count;
3. domain-warp evaluations;
4. analytic glow complexity; and
5. target frame rate.

The animation should pause when the document is hidden. A later enhancement may
reduce quality dynamically based on measured frame time, but the first pass
should keep quality selection deterministic.

## Color handling

Palette values are application data and should be converted consistently before
being sent to the shader. The renderer and shader must use an explicit output
color-space path so colors do not differ unexpectedly between development and
production.

The design target is saturated color surrounded by deep black, not uniformly
maximum brightness. Contrast and glow must be bounded to avoid clipping large
areas of the image.

## Accessibility and user preferences

The first pass must respect `prefers-reduced-motion`.

Reduced-motion behavior:

- render a stable or extremely slow version of the current pattern;
- disable pulses and rapid domain movement; and
- retain the complete color and geometric composition.

The canvas is decorative and should not enter the accessibility tree. Future
interactive controls will be ordinary semantic HTML layered above it.

## Failure and fallback behavior

If WebGL initialization or shader compilation fails:

- keep the page background black;
- show a static CSS radial-gradient treatment;
- display a concise, accessible message if the failure prevents the intended
  experience; and
- report diagnostic details in development without exposing noisy errors to end
  users.

WebGL context loss should stop the animation loop. Context restoration support
can recreate renderer resources if practical; at minimum, it must fail without
leaking additional loops or GPU resources.

## Validation plan

The first pass is complete when:

- the kaleidoscope fills the viewport with no scrollbars or layout flash;
- radial repetition and mirroring read unmistakably as a kaleidoscope;
- fractal detail remains crisp without overwhelming the geometry;
- the composition contains intentional black negative space;
- resize and orientation changes do not distort the pattern;
- animation speed is frame-rate independent;
- reduced-motion mode is usable;
- mounting and unmounting do not create duplicate animation loops;
- GPU resources are disposed during cleanup;
- the effect remains smooth at the chosen quality tier on representative desktop
  and mobile hardware; and
- a WebGL failure produces the defined fallback instead of a blank or broken
  page.

Visual regression screenshots should cover at least one desktop viewport, one
mobile viewport, and reduced-motion mode. Pure functions for parameter clamping
and interpolation can be unit tested independently of WebGL.

## Implementation sequence

1. Scaffold Vite, React, and TypeScript with a black full-viewport page.
2. Implement the isolated Three.js lifecycle and render a diagnostic gradient.
3. Add aspect-correct polar coordinates and mirrored radial symmetry.
4. Add procedural warp and bounded fractal detail.
5. Add the initial palette, negative space, contrast, glow, and vignette.
6. Add parameter normalization and frame-rate-independent interpolation.
7. Add resize, page-visibility, reduced-motion, and fallback behavior.
8. Profile desktop and mobile rendering, then tune the quality defaults.
9. Add automated lifecycle tests and visual smoke tests.

Only after this pass is visually and technically stable should the architecture
expand to chat input and mood determination.

