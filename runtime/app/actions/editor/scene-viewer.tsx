import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { Room } from "../../room/room.tsx";
import type { SceneNode, ScenePatch } from "../../utilities/scene.ts";

export type SceneContext = {
  canvas: HTMLCanvasElement;
  scene: SceneNode;
  room: Room;
  signal: AbortSignal;
  onPatch: (patch: ScenePatch) => void;
};

export function SceneViewer(
  handle: Handle<{
    scene: SceneNode;
    room: Room;
    onMount: (context: SceneContext) => void | Promise<void>;
    onPatch: (patch: ScenePatch) => void;
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
          void handle.props.onMount({
            canvas: node,
            scene: handle.props.scene,
            room: handle.props.room,
            signal,
            onPatch: handle.props.onPatch,
          });
        }),
      ]}
    />
  );
}
