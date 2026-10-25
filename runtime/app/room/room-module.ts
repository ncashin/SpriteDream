import { joinRoom, type Room } from "./room.tsx";

export type { Room };

let pending: Promise<Room> | undefined;

export function getRoom(): Promise<Room> {
  if (pending) return pending;

  const controller = new AbortController();
  window.addEventListener("pagehide", () => controller.abort(), { once: true });
  pending = joinRoom(controller.signal);
  return pending;
}
