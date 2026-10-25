import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { SceneNode } from "../../utilities/scene.ts";

export function SceneViewer(
  handle: Handle<{
    scene?: SceneNode;
    onSave?: (content: string) => void;
    onMount: (canvas: HTMLCanvasElement, scene?: SceneNode) => void | Promise<void>;
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
        ref(async (node) => {
          if (!(node instanceof HTMLCanvasElement)) return;
          if (node.dataset.mounted === "true") return;
          node.dataset.mounted = "true";
          await handle.props.onMount(node, handle.props.scene);
        }),
      ]}
    />
  );
}
