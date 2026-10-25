import { parseSafe } from "remix/data-schema";

import { roomMessage, type Person } from "./protocol.ts";

export type Room = {
  you: { id: string };
  people: Record<string, Person>;
  onPersonJoin(listener: (person: Person) => void): () => boolean;
  onPersonLeave(listener: (person: Person) => void): () => boolean;
  cleanup(): void;
};

export function joinRoom(signal: AbortSignal): Promise<Room> {
  const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/room`);
  const people: Record<string, Person> = {};
  
  const joinListeners = new Set<(person: Person) => void>();
  const leaveListeners = new Set<(person: Person) => void>();
 
  const cleanup = () => socket.close();

  return new Promise<Room>((resolve, reject) => {
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
      if (!parsed.success) return;

      const message = parsed.value;

      switch (message.messageType) {
        case "onRoomJoin":
          for (const member of message.people) {
            people[member.id] = member;
          }
          resolve({
            you: { id: message.id },
            people,
            onPersonJoin(listener: (person: Person) => void) {
              joinListeners.add(listener);
              return () => joinListeners.delete(listener);
            },
            onPersonLeave(listener: (person: Person) => void) {
              leaveListeners.add(listener);
              return () => leaveListeners.delete(listener);
            },
            cleanup,
          });
          return;
        case "onPersonJoin": {
          const person = { id: message.id };
          people[person.id] = person;
          for (const listener of joinListeners) listener(person);
          break;
        }
        case "onPersonLeave": {
          const person = people[message.id];
          if (!person) break;
          delete people[person.id];
          for (const listener of leaveListeners) listener(person);
          break;
        }
      }
    };
  });
}
