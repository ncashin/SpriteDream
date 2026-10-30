import { object, parseSafe, string } from "remix/data-schema";
import type { InferOutput, Schema } from "remix/data-schema";

import { roomMessage, type RoomMessage } from "./protocol.ts";

type ProtocolMessage = { messageType: string };

const metadata = object({
  sentBy: string(),
});

type Metadata = InferOutput<typeof metadata>;

type Delivered<message> = message extends { messageType: RoomMessage["messageType"] }
  ? message
  : message & Metadata;

export type Room<message extends ProtocolMessage = RoomMessage> = {
  you: { id: string };
  people: Record<string, string>;
  onMessageType<type extends message["messageType"]>(
    type: type,
    listener: (message: Delivered<Extract<message, { messageType: type }>>) => void,
  ): () => boolean;
  send(message: message): void;
  cleanup(): void;
};

export function joinRoom<protocol extends Schema<any, ProtocolMessage>>(
  name: string,
  signal: AbortSignal,
  protocol: protocol,
): Promise<Room<RoomMessage | InferOutput<protocol>>> {
  const socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room/${encodeURIComponent(name)}`,
  );

  const people: Record<string, string> = {};

  const listeners = new Map<string, Set<(message: any) => void>>();

  const emit = (message: ProtocolMessage) => {
    const group = listeners.get(message.messageType);

    if (!group) return;

    for (const listener of group) listener(message);
  };

  const cleanup = () => socket.close();

  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      cleanup();
      reject(signal.reason);
      return;
    }
    signal.addEventListener("abort", () => {
      cleanup();
      reject(signal.reason);
    });

    socket.onmessage = (event) => {
      const messageJSON = JSON.parse(event.data);

      const parsed = parseSafe(roomMessage, messageJSON);

      if (!parsed.success) {
        const custom = parseSafe(protocol, messageJSON);
        const meta = parseSafe(metadata, messageJSON);
        if (!custom.success || !meta.success) return;
        emit({ ...custom.value, ...meta.value });
        return;
      }

      const message = parsed.value;
      switch (message.messageType) {
        case "onRoomJoin":
          for (const id of message.people) people[id] = id;

          resolve({
            you: { id: message.id },

            people,

            onMessageType(type, listener) {
              let group = listeners.get(type);
              if (!group) {
                group = new Set();
                listeners.set(type, group);
              }
              group.add(listener);
              return () => group.delete(listener);
            },

            send(message) {
              socket.send(JSON.stringify(message));
            },

            cleanup,
          });
          return;

        case "onPersonJoin":
          people[message.id] = message.id;
          break;

        case "onPersonLeave":
          delete people[message.id];
          break;
      }
      emit(message);
    };
  });
}
