# Kaleidoscope AI

An experimental, full-screen generative kaleidoscope that will eventually adapt
its colors, pace, and structure to the mood of a conversation.

The current implementation is the first visual pass: a standalone procedural
kaleidoscope rendered with Three.js and a custom GLSL fragment shader. Chat,
voice input, sentiment analysis, and mood mapping are intentionally deferred
until the visual engine is stable.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

## Validate

```bash
npm run typecheck
npm run build
```

## Current stack

- Vite
- React
- TypeScript
- Three.js
- GLSL

## Documentation

- [Frontend architecture](docs/architecture/frontend.md)
- [Kaleidoscope mathematics](docs/architecture/kaleidoscope-math.md)
- [Visualization library research](docs/research/visualization-libraries.md)
