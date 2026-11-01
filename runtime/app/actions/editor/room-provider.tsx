import { css, type Handle, type RemixNode } from "remix/component";
import type { Schema } from "remix/data-schema";

import type { GameMessage } from "../../../game/protocol.ts";
import { joinRoom } from "../../../room/room.tsx";
import type { EditorMessage } from "./protocol.ts";
import type { SceneRoom } from "./sceneViewer/scene-viewer.tsx";

export type RoomState = {
  room: SceneRoom;
  production: boolean;
  canUseProduction: boolean;
  toggleProduction(): void;
};

export function RoomProvider(
  handle: Handle<
    {
      roomName: string;
      roomURL?: string;
      protocol: Schema<any, GameMessage | EditorMessage>;
      children?: RemixNode;
    },
    RoomState
  >,
) {
  let room: SceneRoom | undefined;
  let useProdRoom = false;
  let roomConnection: AbortController | undefined;

  handle.queueTask(() => {
    const connect = () => {
      if (handle.signal.aborted) return;

      roomConnection?.abort();
      room?.cleanup();
      const connection = new AbortController();
      roomConnection = connection;
      handle.signal.addEventListener("abort", () => connection.abort(), { once: true });

      room = undefined;
      handle.update();

      void (async () => {
        let joined: SceneRoom;
        try {
          joined = await joinRoom(
            handle.props.roomName,
            connection.signal,
            handle.props.protocol,
            useProdRoom ? handle.props.roomURL : undefined,
          );
        } catch {
          return;
        }

        if (connection.signal.aborted || roomConnection !== connection) {
          joined.cleanup();
          return;
        }

        room = joined;
        handle.context.set({
          room: joined,
          production: useProdRoom,
          canUseProduction: Boolean(handle.props.roomURL),
          toggleProduction() {
            if (!handle.props.roomURL) return;
            useProdRoom = !useProdRoom;
            connect();
          },
        });
        handle.update();
      })();
    };

    connect();
  });

  return () => {
    if (!room) {
      return (
        <p role="status" mix={css({ padding: "0.5rem 1rem" })}>
          Connecting to room...
        </p>
      );
    }

    return handle.props.children;
  };
}
