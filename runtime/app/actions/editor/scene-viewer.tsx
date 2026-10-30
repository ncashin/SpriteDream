import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { GameMessage } from "../../../game/protocol.ts";
import type { RoomMessage } from "../../../room/protocol.ts";
import type { Room } from "../../../room/room.tsx";
import type { SceneNode } from "../../utilities/scene.ts";
import type { EditorMessage } from "./protocol.ts";

export type SceneRoom = Room<RoomMessage | GameMessage | EditorMessage>;

export type SceneDocument = {
  read(): string;
  write(text: string): void;
  subscribe(listener: () => void): () => void;
};

export type SceneContext = {
  canvas: HTMLCanvasElement;
  scene: SceneNode;
  room: SceneRoom;
  sceneKey: string;
  signal: AbortSignal;
  document: SceneDocument;
};

export function SceneViewer(
  handle: Handle<{
    scene: SceneNode;
    room: SceneRoom;
    sceneKey: string;
    document: SceneDocument;
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
          void handle.props.onMount({
            canvas: node,
            scene: handle.props.scene,
            room: handle.props.room,
            sceneKey: handle.props.sceneKey,
            signal,
            document: handle.props.document,
          });
        }),
      ]}
    />
  );
}
