import {
  ROOM_MESSAGE,
  type RoomClientMessage,
  type RoomReadyMessage,
  type RoomServerMessage,
  type WebRTCSignalPayload,
  isRoomPeersUpdateMessage,
  isRoomSignalMessage,
} from "./roomSignalingMessages.js";

export type RoomSignalingClient = {
  peerId: string;
  getPeers(): string[];
  onPeersChange(handler: (peers: string[]) => void): () => void;
  sendSignal(to: string, payload: WebRTCSignalPayload): void;
  onSignal(handler: (from: string, payload: WebRTCSignalPayload) => void): () => void;
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

export function connectRoomSignaling(options: {
  room: string;
  url?: string;
}): Promise<RoomSignalingClient> {
  const url =
    options.url == null
      ? websocketURLForRoom(options.room)
      : appendRoomToURL(options.url, options.room);
  const websocket = new WebSocket(url);

  return new Promise((resolve, reject) => {
    const peerSubscribers = new Set<(peers: string[]) => void>();
    const signalHandlers = new Set<
      (from: string, payload: WebRTCSignalPayload) => void
    >();
    let currentPeers: string[] = [];
    let peerId = "";
    let settled = false;

    function notifyPeerSubscribers() {
      const snap = [...currentPeers];
      peerSubscribers.forEach((callback) => callback(snap));
    }

    function setPeers(next: string[]) {
      currentPeers = next;
      notifyPeerSubscribers();
    }

    function fail(err: unknown) {
      if (settled) return;
      settled = true;
      websocket.close();
      reject(err);
    }

    const bufferedSignals: Array<{ from: string; payload: WebRTCSignalPayload }> = [];

    function dispatchSignal(from: string, payload: WebRTCSignalPayload) {
      if (signalHandlers.size === 0) {
        bufferedSignals.push({ from, payload });
        return;
      }
      signalHandlers.forEach((handler) => handler(from, payload));
    }

    function replayBufferedSignals() {
      if (signalHandlers.size === 0 || bufferedSignals.length === 0) return;
      const queued = bufferedSignals.splice(0, bufferedSignals.length);
      for (const { from, payload } of queued) {
        signalHandlers.forEach((handler) => handler(from, payload));
      }
    }

    function handleServerMessage(message: RoomServerMessage) {
      if (isRoomPeersUpdateMessage(message)) {
        setPeers(message.peers);
        return;
      }
      if (isRoomSignalMessage(message) && typeof message.from === "string") {
        dispatchSignal(message.from, message.payload);
      }
    }

    websocket.addEventListener("error", () => fail(new Error("WebSocket connection failed")));

    websocket.addEventListener("message", function onFirst(event: MessageEvent) {
      const raw = JSON.parse(String(event.data)) as RoomReadyMessage;
      if (raw.type !== ROOM_MESSAGE.ready || typeof raw.peerId !== "string") {
        fail(new Error("expected room ready message with peerId and peers"));
        return;
      }

      peerId = raw.peerId;
      currentPeers = raw.peers;
      notifyPeerSubscribers();
      websocket.removeEventListener("message", onFirst);

      websocket.addEventListener("message", (messageEvent: MessageEvent) => {
        handleServerMessage(JSON.parse(String(messageEvent.data)) as RoomServerMessage);
      });

      const client: RoomSignalingClient = {
        peerId,
        getPeers() {
          return [...currentPeers];
        },
        onPeersChange(handler: (peers: string[]) => void) {
          peerSubscribers.add(handler);
          return () => {
            peerSubscribers.delete(handler);
          };
        },
        sendSignal(to: string, payload: WebRTCSignalPayload) {
          if (websocket.readyState !== WebSocket.OPEN) return;
          const message: RoomClientMessage = { type: ROOM_MESSAGE.signal, to, payload };
          websocket.send(JSON.stringify(message));
        },
        onSignal(handler: (from: string, payload: WebRTCSignalPayload) => void) {
          signalHandlers.add(handler);
          replayBufferedSignals();
          return () => {
            signalHandlers.delete(handler);
          };
        },
        dispose() {
          peerSubscribers.clear();
          signalHandlers.clear();
          bufferedSignals.length = 0;
          websocket.close();
        },
      };

      settled = true;
      resolve(client);
    });
  });
}
