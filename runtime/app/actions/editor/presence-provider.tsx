import { css, ref } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

import { createDrawCursor } from "../../utilities/viewport/draw-cursor.ts";
import { RoomProvider } from "./room-provider.tsx";

export type CursorPoint = { x: number; y: number };

export type Presence = {
  path: string;
  cursors: Record<string, CursorPoint>;
  sendCursor(point: CursorPoint): void;
  clearCursor(): void;
  subscribe(listener: () => void): () => void;
};

export function PresenceProvider(
  handle: Handle<
    { path: string; draw?: boolean; children?: RemixNode },
    Presence
  >,
) {
  const { room } = handle.context.get(RoomProvider);
  const cursors: Record<string, CursorPoint> = {};
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function forget(id: string) {
    if (!cursors[id]) return;
    delete cursors[id];
    notify();
  }

  const stopCursor = room.onMessageType("cursor", (message) => {
    if (message.sentBy === room.you.id) return;
    if (message.path !== handle.props.path) {
      forget(message.sentBy);
      return;
    }
    cursors[message.sentBy] = { x: message.x, y: message.y };
    notify();
  });
  const stopLeave = room.onMessageType("onPersonLeave", (message) => {
    forget(message.id);
  });
  const stopTab = room.onMessageType("selectedTab", (message) => {
    if (message.sentBy === room.you.id) return;
    if (message.path === handle.props.path) return;
    forget(message.sentBy);
  });

  function clearCursor() {
    room.send({ messageType: "cursor", path: "", x: 0, y: 0 });
  }

  handle.context.set({
    path: handle.props.path,
    cursors,
    sendCursor(point) {
      room.send({
        messageType: "cursor",
        path: handle.props.path,
        x: point.x,
        y: point.y,
      });
    },
    clearCursor,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  handle.signal.addEventListener("abort", () => {
    stopCursor();
    stopLeave();
    stopTab();
    clearCursor();
  });

  return () => (
    <div
      mix={[
        css({
          position: "absolute",
          inset: 0,
        }),
        ref((node, signal) => {
          if (!(node instanceof HTMLElement)) return;
          const leave = () => clearCursor();
          node.addEventListener("pointerleave", leave);
          signal.addEventListener("abort", () => {
            node.removeEventListener("pointerleave", leave);
          });
        }),
      ]}
    >
      {handle.props.children}
      {handle.props.draw === false ? null : <CursorOverlay />}
    </div>
  );
}

function CursorOverlay(handle: Handle) {
  const presence = handle.context.get(PresenceProvider);

  return () => (
    <div
      mix={[
        css({
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 2,
        }),
        ref((node, signal) => {
          if (!(node instanceof HTMLDivElement)) return;
          const host = node.parentElement;
          if (!host) return;
          const draw = createDrawCursor(node);
          let frame = 0;
          const paint = () => {
            const rect = host.getBoundingClientRect();
            draw.frame();
            for (const id in presence.cursors) {
              const point = presence.cursors[id];
              if (!point) continue;
              draw(
                { x: point.x * rect.width, y: point.y * rect.height },
                id,
              );
            }
            frame = requestAnimationFrame(paint);
          };
          frame = requestAnimationFrame(paint);
          const move = (event: PointerEvent) => {
            const rect = host.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) return;
            presence.sendCursor({
              x: (event.clientX - rect.left) / rect.width,
              y: (event.clientY - rect.top) / rect.height,
            });
          };
          host.addEventListener("pointermove", move);
          signal.addEventListener("abort", () => {
            cancelAnimationFrame(frame);
            draw.dispose();
            host.removeEventListener("pointermove", move);
          });
        }),
      ]}
    />
  );
}
