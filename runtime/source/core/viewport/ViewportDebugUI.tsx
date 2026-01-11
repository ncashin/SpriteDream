import { useState, useEffect, useRef } from "react";
import { getViewport, resetViewport } from "./viewport";

export function ViewportDebugUI() {
  const [viewport, setViewport] = useState(getViewport());
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    // Use requestAnimationFrame to ensure the UI is always up to date
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

  const handleReset = () => {
    resetViewport();
    // Force immediate update
    setViewport(getViewport());
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        zIndex: 10000,
        padding: "0.25rem 0.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        fontFamily:
          "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
        fontSize: "0.65rem",
        color: "var(--vscode-descriptionForeground, rgba(255, 255, 255, 0.5))",
        userSelect: "none",
        pointerEvents: "auto",
        lineHeight: "1.4em",
      }}
    >
      <div style={{ pointerEvents: "none" }}>
        X: {viewport.x.toFixed(2)}, Y: {viewport.y.toFixed(2)}, Zoom: {(viewport.scale * 100).toFixed(0)}%
      </div>
      <button
        onClick={handleReset}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        style={{
          padding: "0.125rem 0.375rem",
          fontSize: "0.65rem",
          fontWeight: "normal",
          border: "none",
          borderRadius: "2px",
          cursor: "pointer",
          backgroundColor: isPressed
            ? "rgba(128, 128, 128, 0.4)"
            : isHovered
            ? "rgba(128, 128, 128, 0.35)"
            : "rgba(128, 128, 128, 0.3)",
          color: "var(--vscode-button-foreground, rgba(255, 255, 255, 0.9))",
          fontFamily:
            "var(--vscode-font-family, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif)",
          outline: "none",
          minHeight: "16px",
          lineHeight: "1.4em",
          transition: "background-color 0.1s ease-out",
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline =
            "1px solid var(--vscode-focusBorder, #007acc)";
          e.currentTarget.style.outlineOffset = "-1px";
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = "none";
        }}
      >
        Reset
      </button>
    </div>
  );
}

