# Visualization library research

Status: Complete for the initial frontend decision  
Researched: 2026-11-09 to 2026-11-10

## Research question

Which open-source browser graphics technology is the best fit for a full-page,
procedurally generated kaleidoscope whose geometry, color, and motion will later
respond to a mood signal?

This research focuses on the visualization layer only. Chat, voice input,
sentiment analysis, model selection, storage, and backend architecture are out of
scope.

## Project requirements

The selected technology should:

- render a continuously animated, full-viewport experience;
- support custom fragment shaders and GPU-accelerated per-pixel effects;
- make radial symmetry, fractal noise, domain warping, and palette changes
  practical;
- integrate cleanly with a conventional React user interface;
- work well on current desktop and mobile browsers;
- be understandable and maintainable in a side project;
- avoid unnecessary runtime services and recurring cost;
- be open source and suitable for a public portfolio project; and
- leave room for future visual complexity without requiring an engine rewrite.

## Evaluation criteria

The options were compared on:

1. shader control;
2. suitability for a single full-screen procedural surface;
3. integration with React and TypeScript;
4. learning curve and amount of framework-specific knowledge;
5. runtime and dependency overhead;
6. documentation, examples, and ecosystem maturity;
7. WebGL/WebGPU support and migration risk; and
8. long-term maintenance cost.

## Options considered

### Three.js directly

Three.js provides the WebGL renderer, GPU resource lifecycle, geometry,
materials, uniforms, and browser integration while still allowing custom GLSL
vertex and fragment shaders through `ShaderMaterial`.

For this project, Three.js can render one full-screen triangle using one custom
shader. React only needs to mount the canvas and pass low-frequency parameter
changes to it. The animation loop and shader uniforms can remain outside the
React render cycle.

Advantages:

- direct support for custom GLSL shaders and uniforms;
- large set of official documentation and examples;
- enough abstraction to avoid raw WebGL setup and state management;
- does not require adopting a game-engine architecture;
- easy to expand later with render targets, textures, or post-processing; and
- MIT-licensed and actively maintained.

Tradeoffs:

- renderer creation, resize handling, animation, and disposal are imperative;
- custom shader color management and GPU cleanup must be handled deliberately;
- the project still needs some knowledge of WebGL concepts and GLSL.

Sources:

- [Three.js documentation](https://threejs.org/docs/)
- [Three.js `ShaderMaterial`](https://threejs.org/docs/pages/ShaderMaterial.html)
- [Three.js repository](https://github.com/mrdoob/three.js/)

### React Three Fiber

React Three Fiber is a React renderer for Three.js. It represents Three.js
objects as JSX and supplies React-oriented lifecycle and frame-loop hooks.

Its documentation states that Three.js capabilities remain available and that
the rendering work runs outside React. It also explicitly recommends being
comfortable with both React and Three.js. That extra conceptual layer is useful
for component-heavy 3D scenes, but less useful for a visualization made from one
full-screen shader.

Advantages:

- declarative scene construction;
- convenient canvas, frame-loop, and component lifecycle integration;
- access to the broader pmndrs ecosystem; and
- a good fit if the experience later becomes a multi-object interactive scene.

Tradeoffs:

- requires learning React, Three.js, and React Three Fiber conventions;
- introduces another compatibility relationship between React and the renderer;
- most of its component model is unnecessary for a single shader surface; and
- the current v10/WebGPU documentation is marked alpha, so it should not be the
  basis of the initial stable implementation.

Sources:

- [React Three Fiber introduction](https://r3f.docs.pmnd.rs/getting-started/introduction)
- [React Three Fiber repository](https://github.com/pmndrs/react-three-fiber)

### OGL

OGL is a small, zero-dependency WebGL library intended for developers who want
minimal abstraction and custom shaders. Its official examples explicitly show a
full-screen shader without a camera or full scene graph, making it a close
technical match.

Advantages:

- minimal API and dependency footprint;
- stays close to native WebGL;
- designed around custom shaders; and
- includes a directly relevant full-screen shader example.

Tradeoffs:

- smaller ecosystem and fewer learning resources than Three.js;
- more low-level WebGL responsibility remains with the application; and
- fewer ready-made paths if the visual experience grows beyond the initial
  procedural surface.

Source: [OGL repository and examples](https://github.com/oframe/ogl)

### p5.js

p5.js is designed for creative coding and offers an approachable sketch model.
It supports GLSL shaders, custom uniforms, and fragment-shader fractals.

Advantages:

- very fast visual experimentation;
- approachable documentation for creative coding;
- built-in draw loop and canvas management; and
- direct examples of animated fractal shaders.

Tradeoffs:

- its sketch lifecycle is less natural inside a conventional application UI;
- its custom shader path is still an advanced feature;
- production code can become organized around global sketch concerns; and
- it provides less architectural value once the shader itself becomes the main
  implementation.

Sources:

- [p5.js `createShader`](https://p5js.org/reference/p5/createShader/)
- [p5.js introduction to GLSL](https://p5js.org/tutorials/intro-to-glsl/)

### PixiJS

PixiJS is a mature 2D rendering engine with a scene graph, sprites, meshes,
filters, and both WebGL and WebGPU renderers. Version 8 supports custom shader
programs for both backends.

Advantages:

- strong 2D rendering and asset pipeline;
- capable filters, meshes, particles, and blend modes;
- WebGL and WebGPU support; and
- useful if the experience becomes sprite- or asset-heavy.

Tradeoffs:

- its primary strengths are not required by one full-screen procedural shader;
- the scene graph and asset systems add concepts without immediate benefit; and
- supporting both renderer backends makes custom shader setup more involved.

Sources:

- [PixiJS architecture](https://pixijs.com/8.x/guides/concepts/architecture)
- [PixiJS v8 migration and shader changes](https://pixijs.com/8.x/guides/migrations/v8)
- [PixiJS filters](https://pixijs.com/8.x/guides/components/filters)

### Babylon.js

Babylon.js is a broad 3D/game engine with materials, scene tooling, asset
systems, inspection tools, and mature WebGPU support. It can implement the
kaleidoscope, but most of the engine would not be used.

Advantages:

- extensive engine and debugging features;
- strong WebGPU and WGSL support;
- supports both GLSL and WGSL workflows; and
- appropriate for a much larger interactive 3D experience.

Tradeoffs:

- substantially broader than the problem requires;
- introduces engine concepts unrelated to a single procedural surface; and
- dual WebGL/WebGPU shader considerations increase initial complexity.

Sources:

- [Babylon.js WebGPU shader documentation](https://doc.babylonjs.com/setup/support/webGPU/webGPUWGSL/)
- [Babylon.js repository](https://github.com/BabylonJS/Babylon.js/)

### regl

regl is a functional abstraction over WebGL based on resources and commands. It
removes much of WebGL's shared-state handling while remaining deliberately
low-level and dependency-free.

Advantages:

- concise and predictable draw-command model;
- little runtime overhead;
- strong validation and testing claims; and
- useful for developers who prefer functional, low-level graphics code.

Tradeoffs:

- fewer application-level conveniences than Three.js;
- smaller modern ecosystem for this style of creative frontend; and
- its low-level model does not materially reduce the shader knowledge required.

Source: [regl repository and documentation](https://github.com/regl-project/regl)

### Raw WebGL

Native WebGL provides complete control and no graphics-library dependency.
However, the application would own context creation, shader compilation,
program linking, buffers, uniforms, state changes, resize behavior, extensions,
error handling, and GPU resource cleanup.

This control is not valuable enough for the initial kaleidoscope to justify the
extra code and maintenance burden.

Source: [MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)

### SVG, Canvas 2D, and data-visualization libraries

SVG, Canvas 2D, and libraries such as D3 are strong choices for vector graphics,
charts, and data-driven interaction. They are not a good match for a continuously
animated per-pixel fractal effect. Reproducing the intended result on the CPU or
through large SVG trees would be less direct and less performant than a fragment
shader.

## WebGL versus WebGPU

WebGPU is attractive for future compute-heavy work, but the first implementation
does not need compute shaders or a modern 3D material pipeline. Starting with
WebGPU would add WGSL, backend compatibility, and browser fallback decisions
before they create user value.

The project should begin with Three.js's WebGL renderer and GLSL. The visual
engine boundary should remain small enough that a later renderer experiment is
possible. WebGPU should be reconsidered only if measured limitations or a new
visual requirement justify it.

Sources:

- [MDN WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
- [React Three Fiber WebGPU notes](https://r3f.docs.pmnd.rs/tutorials/v9-migration-guide#webgpu)

## Conclusion

Use **Three.js directly** for the first implementation.

It offers the best balance between shader control, browser integration,
documentation, ecosystem maturity, and maintainability. OGL is the closest
minimal alternative, while React Three Fiber becomes attractive only if the
visual layer grows into a component-heavy 3D scene.

The initial implementation should use one full-screen triangle, one custom GLSL
shader, and a small set of uniforms. This keeps the renderer simple while
preserving room for future textures, render targets, or post-processing.

