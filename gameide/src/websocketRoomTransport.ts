import type { SceneChannelTransport } from "./scene/sceneChannelTransport.js";

export type WebSocketRoomTransport = SceneChannelTransport & {
  dispose(): void;
};

export type ConnectWebSocketRoomResult = {
  transport: WebSocketRoomTransport;
  initializeScene: boolean;
  dispose(): void;
};

function webSocketUrlForRoom(room: string): string {
  const loc = globalThis.location as Location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ room });
  return `${protocol}//${loc.host}/room?${params.toString()}`;
}

export function connectWebSocketRoomTransport(options: {
  room: string;
  url?: string;
}): Promise<ConnectWebSocketRoomResult> {
  const url = options.url ?? webSocketUrlForRoom(options.room);
  const websocket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    const handlers = new Set<(message: unknown) => void>();
    let settled = false;

    function fail(err: unknown) {
      if (settled) return;
      settled = true;
      try {
        websocket.close();
      } catch {}
      reject(err);
    }

    websocket.addEventListener("error", () => fail(new Error("WebSocket connection failed")));

    websocket.addEventListener("open", () => {});

    websocket.addEventListener("message", function onFirst(ev: MessageEvent) {
      try {
        const raw = JSON.parse(String(ev.data)) as {
          type?: string;
          initializeScene?: boolean;
        };
        if (raw.type !== "ready" || typeof raw.initializeScene !== "boolean") {
          fail(new Error("expected room ready message"));
          return;
        }
        websocket.removeEventListener("message", onFirst);

        websocket.addEventListener("message", (ev2: MessageEvent) => {
          try {
            const msg = JSON.parse(String(ev2.data)) as unknown;
            handlers.forEach((h) => h(msg));
          } catch {}
        });

        const transport: WebSocketRoomTransport = {
          send(message: unknown) {
            if (websocket.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify(message));
            }
          },
          onMessage(handler: (message: unknown) => void) {
            handlers.add(handler);
            return () => {
              handlers.delete(handler);
            };
          },
          dispose() {
            handlers.clear();
            try {
              websocket.close();
            } catch {}
          },
        };

        settled = true;
        resolve({
          initializeScene: raw.initializeScene,
          transport,
          dispose: transport.dispose,
        });
      } catch (e) {
        fail(e);
      }
    });
  });
}
