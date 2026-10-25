import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { SceneNode } from "../../utilities/scene.ts";

export type SceneContext = {
  canvas: HTMLCanvasElement;
  scene: SceneNode;
  signal: AbortSignal;
};

export function SceneViewer(
  handle: Handle<{
    scene: SceneNode;
    onMount: (context: SceneContext) => void | Promise<void>;
  }>,
) {
  return () => (
    <canvas
      aria-label="Scene view"
      tabIndex={-1}
      mix={[
        css({
          display: "block",
          width: "100%",
          height: "100%",
          touchAction: "none",
          background: "#1c1c1e",
          outline: "none",
        }),
        ref((node, signal) => {
          if (!(node instanceof HTMLCanvasElement)) return;
          if (node.dataset.mounted === "true") return;
          node.dataset.mounted = "true";
          void handle.props.onMount({ canvas: node, scene: handle.props.scene, signal });
        }),
      ]}
    />
  );
}
