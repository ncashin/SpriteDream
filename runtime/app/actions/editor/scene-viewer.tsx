import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { SceneNode } from "../../utilities/scene.ts";

export function SceneViewer(
  handle: Handle<{
    scene?: SceneNode;
    onSave?: (content: string) => void;
    onMount: (
      canvas: HTMLCanvasElement,
      scene?: SceneNode,
    ) => void | (() => void) | Promise<void | (() => void)>;
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
          void Promise.resolve(handle.props.onMount(node, handle.props.scene)).then((cleanup) => {
            if (typeof cleanup !== "function") return;
            if (signal.aborted) cleanup();
            else signal.addEventListener("abort", cleanup, { once: true });
          });
        }),
      ]}
    />
  );
}
