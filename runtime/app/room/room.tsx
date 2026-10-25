import { parseSafe } from "remix/data-schema";
import type { InferOutput, Schema } from "remix/data-schema";

import { roomMessage, type Person, type RoomMessage } from "./protocol.ts";

type ProtocolMessage = { messageType: string };

export type Room<message extends ProtocolMessage = RoomMessage> = {
  you: { id: string };
  people: Record<string, Person>;
  onMessageType<type extends message["messageType"]>(
    type: type,
    listener: (message: Extract<message, { messageType: type }>) => void,
  ): () => boolean;
  send(message: message): void;
  cleanup(): void;
};

export function joinRoom<protocol extends Schema<any, ProtocolMessage>>(
  signal: AbortSignal,
  protocol: protocol,
): Promise<Room<RoomMessage | InferOutput<protocol>>> {
  const socket = new WebSocket(
    `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room`,
  );

  const people: Record<string, Person> = {};

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
        if (custom.success) emit(custom.value);
        return;
      }

      const message = parsed.value;
      switch (message.messageType) {
        case "onRoomJoin":
          for (const member of message.people) people[member.id] = member;

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
          people[message.id] = { id: message.id };
          break;

        case "onPersonLeave":
          delete people[message.id];
          break;
      }
      emit(message);
    };
  });
}
