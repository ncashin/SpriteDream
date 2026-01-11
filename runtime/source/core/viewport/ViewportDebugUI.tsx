import { useState, useEffect, useRef } from "react";
import { getViewport, resetViewport } from "./viewport";

export function ViewportDebugUI() {
  const [viewport, setViewport] = useState(getViewport());
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const updateViewport = () => {
      setViewport(getViewport());
      animationFrameRef.current = requestAnimationFrame(updateViewport);
    };
    animationFrameRef.current = requestAnimationFrame(updateViewport);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        zIndex: 10000,
        padding: "0.5rem",
        fontSize: "0.75rem",
        color: "rgba(255, 255, 255, 0.6)",
        fontFamily: "system-ui, sans-serif",
        userSelect: "none",
        lineHeight: 1.5,
      }}
    >
      <div
        onClick={() => {
          resetViewport();
          setViewport(getViewport());
        }}
        style={{
          cursor: "pointer",
          marginBottom: "0.25rem",
        }}
      >
        Reset Viewport
      </div>
      <div>
        {viewport.x.toFixed(1)}, {viewport.y.toFixed(1)}, {(viewport.scale * 100).toFixed(0)}%
      </div>
    </div>
  );
}

