import { useEffect, useRef, useState } from "react";

import { createKaleidoscopeRenderer } from "./createKaleidoscopeRenderer";
import type { KaleidoscopeParameters } from "./kaleidoscopeParameters";

type KaleidoscopeCanvasProps = {
  parameters: KaleidoscopeParameters;
};

export function KaleidoscopeCanvas({ parameters }: KaleidoscopeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<ReturnType<
    typeof createKaleidoscopeRenderer
  > | null>(null);
  const [hasWebGlFailure, setHasWebGlFailure] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let renderer: ReturnType<typeof createKaleidoscopeRenderer>;

    try {
      renderer = createKaleidoscopeRenderer(canvas, parameters);
      rendererRef.current = renderer;
    } catch (error) {
      console.error("Unable to initialize the kaleidoscope renderer.", error);
      setHasWebGlFailure(true);
      return;
    }

    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updateMotionPreference = () => {
      renderer.setReducedMotion(motionPreference.matches);
    };

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      renderer.resize(bounds.width, bounds.height, window.devicePixelRatio);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    motionPreference.addEventListener("change", updateMotionPreference);
    updateMotionPreference();
    resize();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        renderer.stop();
      } else {
        renderer.start();
      }
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      renderer.stop();
      setHasWebGlFailure(true);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    renderer.start();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      motionPreference.removeEventListener("change", updateMotionPreference);
      resizeObserver.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setTargetParameters(parameters);
  }, [parameters]);

  if (hasWebGlFailure) {
    return (
      <section className="kaleidoscope-fallback" role="status">
        <p>This browser could not start the live kaleidoscope.</p>
      </section>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="kaleidoscope-canvas"
      aria-hidden="true"
    />
  );
}
