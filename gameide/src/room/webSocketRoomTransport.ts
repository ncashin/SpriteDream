import type { SceneChannelTransport } from "../scene/sceneChannel/sceneChannelTransport.js";

const ROOM_PEERS_UPDATE = "roomPeersUpdate";
const STICKY_PEER_STORAGE_PREFIX = "gameide:peerIdentifier:";

function stickyPeerStorageKey(room: string): string {
  return `${STICKY_PEER_STORAGE_PREFIX}${room}`;
}

function readStickyPeerIdentifier(room: string): string | undefined {
  try {
    const value = globalThis.sessionStorage?.getItem(stickyPeerStorageKey(room));
    return value && value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeStickyPeerIdentifier(room: string, peerIdentifier: string): void {
  try {
    globalThis.sessionStorage?.setItem(stickyPeerStorageKey(room), peerIdentifier);
  } catch {
    // ignore quota / private browsing
  }
}

export type WebSocketRoomTransport = SceneChannelTransport & {
  dispose(): void;
  getPeers(): string[];
  onPeersChange(handler: (peers: string[]) => void): () => void;
};

export type ConnectWebSocketRoomResult = {
  transport: WebSocketRoomTransport;
  peerIdentifier: string;
  peers: string[];
  dispose(): void;
};

function websocketURLForRoom(room: string, peerIdentifier?: string): string {
  const location = globalThis.location as Location;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const params = new URLSearchParams({ room });
  if (peerIdentifier) params.set("peerIdentifier", peerIdentifier);
  return `${protocol}//${location.host}/room?${params.toString()}`;
}

function appendRoomToURL(url: string, room: string, peerIdentifier?: string): string {
  const base = globalThis.location?.origin ?? "http://localhost";
  const target = new URL(url, base);
  target.searchParams.set("room", room);
  if (peerIdentifier) target.searchParams.set("peerIdentifier", peerIdentifier);
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

function peerIdentifierFromReadyMessage(
  raw: Record<string, unknown>,
): string | undefined {
  if (typeof raw.peerIdentifier === "string") return raw.peerIdentifier;
  if (typeof raw.peerId === "string") return raw.peerId;
  return undefined;
}

export function connectWebSocketRoomTransport(options: {
  room: string;
  url?: string;
}): Promise<ConnectWebSocketRoomResult> {
  const stickyPeerIdentifier = readStickyPeerIdentifier(options.room);
  const url =
    options.url == null
      ? websocketURLForRoom(options.room, stickyPeerIdentifier)
      : appendRoomToURL(options.url, options.room, stickyPeerIdentifier);
  const websocket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    const handlers = new Set<(message: unknown) => void>();
    const peerSubscribers = new Set<(peers: string[]) => void>();
    const pendingMessages: unknown[] = [];
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

      const raw = JSON.parse(String(event.data)) as Record<string, unknown> & {
        type: string;
        peers: unknown;
      };
      applyPeersFromServerMessage(raw, setPeersFromServer);
      if (raw.type === ROOM_PEERS_UPDATE) return;
      const peerIdentifier = peerIdentifierFromReadyMessage(raw);
      if (
        raw.type !== "ready" ||
        peerIdentifier === undefined ||
        !Array.isArray(raw.peers) ||
        !raw.peers.every((id): id is string => typeof id === "string")
      ) {
        fail(new Error("expected room ready message with peerIdentifier and peers"));
        return;
      }
 
      const peers = raw.peers;
      currentPeers = peers;
      notifyPeerSubscribers();
      websocket.removeEventListener("message", onFirst);

      websocket.addEventListener("message", (messageEvent: MessageEvent) => {
        const message = JSON.parse(String(messageEvent.data)) as unknown;
        applyPeersFromServerMessage(message, setPeersFromServer);
        if (handlers.size === 0) {
          pendingMessages.push(message);
          return;
        }
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
          if (pendingMessages.length > 0) {
            const backlog = pendingMessages.splice(0);
            for (const message of backlog) {
              handler(message);
            }
          }
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

      writeStickyPeerIdentifier(options.room, peerIdentifier);

      settled = true;
      resolve({
        peerIdentifier,
        peers: [...currentPeers],
        transport,
        dispose: transport.dispose,
      });
    });
  });
}
