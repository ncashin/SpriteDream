import { css, ref } from "remix/component";
import type { Handle, RemixNode } from "remix/component";

import { createDrawCursor } from "../../utilities/viewport/draw-cursor.ts";
import { RoomProvider } from "./room-provider.tsx";

export type CursorPoint = { x: number; y: number };

export type Presence = {
  path: string;
  cursors: Record<string, CursorPoint>;
  selections: Record<string, unknown>;
  sendCursor(point: CursorPoint): void;
  clearCursor(): void;
  setSelection(value: unknown): void;
  clearSelection(): void;
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
  const selections: Record<string, unknown> = {};
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function forget(id: string) {
    const hadCursor = id in cursors;
    const hadSelection = id in selections;
    if (!hadCursor && !hadSelection) return;
    delete cursors[id];
    delete selections[id];
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
  const stopSelection = room.onMessageType("selection", (message) => {
    if (message.sentBy === room.you.id) return;
    if (message.path !== handle.props.path || message.value == null) {
      if (!(message.sentBy in selections)) return;
      delete selections[message.sentBy];
      notify();
      return;
    }
    selections[message.sentBy] = message.value;
    notify();
  });

  function clearCursor() {
    room.send({ messageType: "cursor", path: "", x: 0, y: 0 });
  }

  function clearSelection() {
    room.send({ messageType: "selection", path: handle.props.path, value: null });
  }

  handle.context.set({
    path: handle.props.path,
    cursors,
    selections,
    sendCursor(point) {
      room.send({
        messageType: "cursor",
        path: handle.props.path,
        x: point.x,
        y: point.y,
      });
    },
    clearCursor,
    setSelection(value) {
      room.send({
        messageType: "selection",
        path: handle.props.path,
        value,
      });
    },
    clearSelection,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });

  handle.signal.addEventListener("abort", () => {
    stopCursor();
    stopLeave();
    stopTab();
    stopSelection();
    clearCursor();
    clearSelection();
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
