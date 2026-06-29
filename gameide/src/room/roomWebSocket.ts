import type { IncomingMessage, Server } from "node:http";
import type { Http2SecureServer } from "node:http2";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";

const ROOM_PATH = "/room";

type RoomClient = WebSocket & { peerIdentifier: string; room: string };

const rooms = new Map<string, Set<RoomClient>>();
let nextPeer = 1;

function getRoomName(request: IncomingMessage): string {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);
  if (url.pathname !== ROOM_PATH) return "";
  const room = url.searchParams.get("room")?.trim() ?? "";
  if (!room) return "";
  return room;
}

function getRequestedPeerIdentifier(request: IncomingMessage): string | undefined {
  const host = request.headers.host ?? "localhost";
  const url = new URL(request.url ?? "/", `http://${host}`);
  const peerIdentifier = url.searchParams.get("peerIdentifier")?.trim();
  return peerIdentifier && peerIdentifier.length > 0 ? peerIdentifier : undefined;
}

function isRoomUpgrade(request: IncomingMessage): boolean {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") return false;
  return getRoomName(request) !== "";
}

function peerIdentifiersInRoom(room: string): string[] {
  const set = rooms.get(room);
  if (!set) return [];
  return [...set]
    .filter((roomClient) => roomClient.readyState === WebSocket.OPEN)
    .map((roomClient) => roomClient.peerIdentifier);
}

function evictPeerIdentifier(room: string, peerIdentifier: string): void {
  const set = rooms.get(room);
  if (!set) return;
  for (const client of [...set]) {
    if (client.peerIdentifier !== peerIdentifier) continue;
    set.delete(client);
    client.close(1000, "peer reconnected");
  }
}

function resolvePeerIdentifier(room: string, requested?: string): string {
  const inUse = peerIdentifiersInRoom(room);
  if (requested && !inUse.includes(requested)) {
    const match = /^peer-(\d+)$/.exec(requested);
    if (match) {
      const id = Number(match[1]);
      if (Number.isFinite(id) && id >= nextPeer) nextPeer = id + 1;
    }
    return requested;
  }
  if (requested && inUse.includes(requested)) {
    evictPeerIdentifier(room, requested);
    return requested;
  }
  return `peer-${nextPeer++}`;
}

function messageDataToUTF8(data: Buffer | ArrayBuffer | Buffer[]): string {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return Buffer.from(data).toString("utf8");
}

export function attachRoomWebSocket(httpServer: Server | Http2SecureServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!isRoomUpgrade(req)) return;
    wss.handleUpgrade(req, socket, head, (websocket) => {
      wss.emit("connection", websocket, req);
    });
  });

  wss.on("connection", (websocket: WebSocket, req: IncomingMessage) => {
    const room = getRoomName(req);
    const client = websocket as RoomClient;
    client.room = room;
    client.peerIdentifier = resolvePeerIdentifier(
      room,
      getRequestedPeerIdentifier(req),
    );

    let set = rooms.get(room);
    if (!set) {
      set = new Set();
      rooms.set(room, set);
    }
    set.add(client);

    websocket.send(
      JSON.stringify({
        type: "ready",
        peerIdentifier: client.peerIdentifier,
        peers: peerIdentifiersInRoom(room),
      }),
    );

    const peersPayload = JSON.stringify({
      type: "roomPeersUpdate",
      peers: peerIdentifiersInRoom(room),
    });
    for (const other of set) {
      if (other !== client && other.readyState === WebSocket.OPEN) {
        other.send(peersPayload);
      }
    }

    websocket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      const text = messageDataToUTF8(data);
      const others = rooms.get(room);
      if (!others) return;
      for (const other of others) {
        if (other !== client && other.readyState === WebSocket.OPEN) {
          other.send(text);
        }
      }
    });

    websocket.on("close", () => {
      const roomClients = rooms.get(room);
      if (!roomClients) return;
      roomClients.delete(client);
      if (roomClients.size === 0) {
        rooms.delete(room);
        return;
      }
      const peersPayload = JSON.stringify({
        type: "roomPeersUpdate",
        peers: peerIdentifiersInRoom(room),
      });
      for (const peer of roomClients) {
        if (peer.readyState === WebSocket.OPEN) {
          peer.send(peersPayload);
        }
      }
    });

    websocket.on("error", () => {});
  });

  return wss;
}
