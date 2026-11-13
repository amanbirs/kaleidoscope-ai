# Kaleidoscope frontend architecture

Status: Implemented and validated for the first visual pass
Last updated: 2026-11-13

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
integration point. The frontend uses a fixed preset during this pass.

## Implementation snapshot

The first pass is implemented in Vite, React, TypeScript, Three.js, and GLSL.
The browser renders one oversized triangle with one `ShaderMaterial`; all visible
detail is produced procedurally in the fragment shader without textures, models,
lights, render targets, or post-processing packages.

Implemented behavior:

- 12-way mirrored radial symmetry;
- value noise and bounded fractal Brownian motion;
- two-dimensional domain warping;
- radial and diagonal wave fields;
- black fissures and negative space created by analytic masks;
- a four-color pink, orange, cyan, and purple palette;
- frame-rate-independent parameter damping;
- viewport and orientation resize handling with `ResizeObserver`;
- a maximum device pixel ratio of `1.5`;
- slower animation and a lower render rate for reduced-motion users;
- animation suspension while the document is hidden;
- Three.js resource disposal during React cleanup; and
- a CSS fallback when WebGL initialization or context operation fails.

The underlying equations and their relationship to the GLSL implementation are
documented in [Kaleidoscope mathematics](kaleidoscope-math.md).

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

## Implemented source structure

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

GLSL lives in separate files and is imported as source text by Vite. This
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

The fragment shader is built in understandable stages:

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

The black background participates in the pattern. The shader produces genuinely
dark negative space rather than covering every pixel with a bright gradient.

The first pass avoids multi-pass blur and bloom. A restrained analytic glow
inside the shader is cheaper and easier to tune. Post-processing remains a
future option if the single-pass result becomes insufficient.

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

Inputs are normalized before they reach shader uniforms. `symmetry` is
integer-valued; continuous parameters are interpolated in the renderer; colors
are interpolated as Three.js `Color` values before being passed to the shader.

| Parameter | Accepted range | Initial preset |
| --- | ---: | ---: |
| `symmetry` | 4–18, rounded to an integer | 12 |
| `speed` | 0–1.5 | 0.28 |
| `scale` | 0.5–2.5 | 1.16 |
| `warp` | 0–1.5 | 0.82 |
| `detail` | 0–1 | 0.78 |
| `contrast` | 0.75–1.75 | 1.08 |
| `glow` | 0–1 | 0.58 |
| `vignette` | 0–1 | 0.62 |

The initial palette is `#ff2f92`, `#ff9a3d`, `#35d7ff`, and `#7656ff`.

The first pass uses one curated preset. Additional presets may be used for
development checks, but their names must describe visual qualities rather than
claiming to represent human emotions. The mood-mapping layer will own that
interpretation later.

## Animation and interpolation

The renderer maintains separate current and target parameter values. A
frame-rate-independent damping function moves current values toward targets.
This makes later mood updates smooth without coupling the renderer to message
history or sentiment logic.

The current implementation damps continuous parameters using an exponential
factor of `1 - exp(-3.4 * deltaSeconds)`. Palette colors use the same factor.
Symmetry changes immediately to the next integer target because the first pass
uses a fixed symmetry value. A quiet-point transition or dual-pattern cross-fade
remains an option if live mood mapping makes structural changes feel abrupt.

## Sizing and pixel density

The canvas fills the viewport through CSS. The renderer's drawing buffer follows
the observed CSS size rather than assuming `window.innerWidth` and
`window.innerHeight`.

Pixel ratio is capped at `1.5`. Very high-density screens can
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

The animation pauses when the document is hidden. A later enhancement may
reduce quality dynamically based on measured frame time, but the first pass
should keep quality selection deterministic.

## Color handling

Palette values are application data and are converted to Three.js `Color`
objects before being sent to the shader. The renderer uses the sRGB output color
space and the shader includes Three.js's output conversion chunk.

The design target is saturated color surrounded by deep black, not uniformly
maximum brightness. Contrast and glow must be bounded to avoid clipping large
areas of the image.

## Accessibility and user preferences

The first pass must respect `prefers-reduced-motion`.

Implemented reduced-motion behavior:

- render at no more than approximately 10 frames per second;
- advance shader time at `4.5%` of the normal rate; and
- retain the complete color and geometric composition.

The canvas is decorative and should not enter the accessibility tree. Future
interactive controls will be ordinary semantic HTML layered above it.

## Failure and fallback behavior

If WebGL initialization fails or the context is lost:

- keep the page background black;
- show a static CSS radial-gradient treatment;
- display a concise, accessible message if the failure prevents the intended
  experience; and
- report diagnostic details in development without exposing noisy errors to end
  users.

WebGL context loss stops the animation loop and replaces the canvas with the
fallback. Automatic context restoration is not implemented in this pass. Shader
compilation failures are reported by Three.js in the development console and are
covered by browser QA before release.

## Validation results

Verified manually in the browser:

- the kaleidoscope fills the viewport with no scrollbars or layout flash;
- radial repetition and mirroring read unmistakably as a kaleidoscope;
- fractal detail remains crisp without overwhelming the geometry;
- the composition contains intentional black negative space;
- desktop and `390 × 844` viewport sizes preserve the center and aspect ratio;
- the pattern evolves continuously over time; and
- the final shader reload produced no new browser runtime or compilation errors.

Verified through type checking, production build, and source inspection:

- animation uses elapsed time rather than frame count;
- reduced-motion behavior lowers both frame rate and time advancement;
- document visibility pauses and resumes the loop;
- React cleanup cancels the loop and disposes GPU resources; and
- WebGL initialization and context-loss paths render the CSS fallback.

The implementation passes `npm run typecheck` and `npm run build`. It was
visually checked in a desktop viewport and at `390 × 844`; both layouts preserved
the center, aspect ratio, symmetry, negative space, and animation. Browser console
inspection after the final shader reload showed no new runtime or shader errors.

Remaining validation work is intentionally deferred: testing on physical mobile
hardware, visual regression images, unit tests for parameter normalization, and
automated WebGL lifecycle coverage.

## Implementation outcome

Completed:

1. Scaffolded Vite, React, and TypeScript with a black full-viewport page.
2. Implemented an isolated Three.js lifecycle and full-screen triangle.
3. Added aspect-correct polar coordinates and mirrored radial symmetry.
4. Added procedural warp and bounded fractal detail.
5. Added the initial palette, negative space, contrast, glow, and vignette.
6. Added parameter normalization and frame-rate-independent interpolation.
7. Added resize, page-visibility, reduced-motion, cleanup, and fallback behavior.
8. Validated and tuned the renderer at desktop and mobile dimensions.

Deferred to a later engineering pass:

1. automated lifecycle and visual regression tests;
2. optional development-only parameter controls; and
3. bundle splitting if later UI features make the initial download materially
   larger.

Only after this pass is visually and technically stable should the architecture
expand to chat input and mood determination.

