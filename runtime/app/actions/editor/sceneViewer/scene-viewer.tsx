import { css, ref } from "remix/component";
import type { Handle } from "remix/component";

import type { RoomMessage } from "../../../../room/protocol.ts";
import type { Room } from "../../../../room/room.tsx";
import type { SceneNode } from "../../../utilities/scene.ts";
import { currySelection, type Selection as SelectionAPI } from "../../../utilities/selection.ts";
import type { EditorMessage } from "../protocol.ts";
import { PresenceProvider, type Presence } from "../presence-provider.tsx";
import { Selection } from "./selection.tsx";
import { SceneSidebar } from "./scene-sidebar.tsx";

export type SceneRoom = Room<RoomMessage | EditorMessage>;

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
  selection: SelectionAPI;
  presence: Presence;
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
  const selection = currySelection();
  const presence = handle.context.get(PresenceProvider);

  return () => (
    <Selection value={selection}>
      <div
        mix={css({
          display: "flex",
          flexDirection: "row",
          width: "100%",
          height: "100%",
          minWidth: 0,
          minHeight: 0,
        })}
      >
        <SceneSidebar scene={handle.props.scene} />
        <div
          mix={css({
            position: "relative",
            flex: "1 1 auto",
            minWidth: 0,
            height: "100%",
          })}
        >
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
                selection,
                presence,
              });
            }),
          ]}
        />
        </div>
      </div>
    </Selection>
  );
}
