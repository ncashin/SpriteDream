import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";

const ROOM_PATH = "/room";

type RoomClient = WebSocket & { peerId: string; room: string };

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

function isRoomUpgrade(request: IncomingMessage): boolean {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") return false;
  return getRoomName(request) !== "";
}

function peerIdsInRoom(room: string): string[] {
  const set = rooms.get(room);
  if (!set) return [];
  return [...set].map((roomClient) => roomClient.peerId);
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

export function attachRoomWebSocket(httpServer: Server): WebSocketServer {
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
    client.peerId = `p${nextPeer++}`;

    let set = rooms.get(room);
    if (!set) {
      set = new Set();
      rooms.set(room, set);
    }
    set.add(client);

    websocket.send(
      JSON.stringify({
        type: "ready",
        peers: peerIdsInRoom(room),
      }),
    );

    const peersPayload = JSON.stringify({
      type: "roomPeersUpdate",
      peers: peerIdsInRoom(room),
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
        peers: peerIdsInRoom(room),
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
