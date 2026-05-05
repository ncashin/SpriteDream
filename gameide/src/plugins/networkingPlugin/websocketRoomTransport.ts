import type { SceneChannelTransport } from "../../scene/sceneChannel/sceneChannelTransport.js";

const ROOM_PEERS_UPDATE = "roomPeersUpdate";

export type WebSocketRoomTransport = SceneChannelTransport & {
  dispose(): void;
  getPeers(): string[];
  onPeersChange(handler: (peers: string[]) => void): () => void;
};

export type ConnectWebSocketRoomResult = {
  transport: WebSocketRoomTransport;
  peers: string[];
  dispose(): void;
};

function websocketURLForRoom(room: string): string {
  const location = globalThis.location as Location;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ room });
  return `${protocol}//${location.host}/room?${params.toString()}`;
}

function appendRoomToURL(url: string, room: string): string {
  const base = globalThis.location?.origin ?? "http://localhost";
  const target = new URL(url, base);
  target.searchParams.set("room", room);
  return target.toString();
}

function applyPeersFromServerMessage(
  message: unknown,
  setPeers: (next: string[]) => void,
): void {
  if (message == null || typeof message !== "object") return;
  const { type, peers } = message as Record<string, unknown>;
  if (type !== ROOM_PEERS_UPDATE) return;
  if (!Array.isArray(peers) || !peers.every((id): id is string => typeof id === "string")) {
    return;
  }
  setPeers(peers);
}

export function connectWebSocketRoomTransport(options: {
  room: string;
  url?: string;
}): Promise<ConnectWebSocketRoomResult> {
  const url =
    options.url == null
      ? websocketURLForRoom(options.room)
      : appendRoomToURL(options.url, options.room);
  const websocket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    const handlers = new Set<(message: unknown) => void>();
    const peerSubscribers = new Set<(peers: string[]) => void>();
    let currentPeers: string[] = [];
    let settled = false;

    function notifyPeerSubscribers() {
      const snap = [...currentPeers];
      peerSubscribers.forEach((callback) => callback(snap));
    }

    function setPeersFromServer(next: string[]) {
      currentPeers = next;
      notifyPeerSubscribers();
    }

    function fail(err: unknown) {
      if (settled) return;
      settled = true;
      websocket.close();
      reject(err);
    }

    websocket.addEventListener("error", () => fail(new Error("WebSocket connection failed")));

    websocket.addEventListener("open", () => {});

    websocket.addEventListener("message", function onFirst(event: MessageEvent) {

      const raw = JSON.parse(String(event.data)) as { type: string; peers: string[] };
      if (raw.type !== "ready") {
        fail(new Error("expected room ready message with peers: string[]"));
        return;
      }
 
      const peers = raw.peers as string[];
      currentPeers = peers;
      notifyPeerSubscribers();
      websocket.removeEventListener("message", onFirst);

      websocket.addEventListener("message", (messageEvent: MessageEvent) => {
        const message = JSON.parse(String(messageEvent.data)) as unknown;
        applyPeersFromServerMessage(message, setPeersFromServer);
        handlers.forEach((handler) => handler(message));
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
        getPeers() {
          return [...currentPeers];
        },
        onPeersChange(handler: (peers: string[]) => void) {
          peerSubscribers.add(handler);
          return () => {
            peerSubscribers.delete(handler);
          };
        },
        dispose() {
          handlers.clear();
          peerSubscribers.clear();
          websocket.close();
        },
      };

      settled = true;
      resolve({
        peers: [...currentPeers],
        transport,
        dispose: transport.dispose,
      });
    });
  });
}
