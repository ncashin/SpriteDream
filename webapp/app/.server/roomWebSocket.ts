import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer, WebSocket } from "ws";

const ROOM_PATH = "/room";

type RoomClient = WebSocket & { peerId: string; room: string };

const rooms = new Map<string, Set<RoomClient>>();
let nextPeer = 1;

function getRoomName(request: IncomingMessage): string {
  const host = request.headers.host ?? "localhost";
  const pathname = new URL(request.url ?? "/", `http://${host}`).pathname;
  if (pathname !== ROOM_PATH) return "";
  const q = new URL(request.url ?? "/", `http://${host}`).searchParams.get("room");
  return q && q.length > 0 ? q : "default";
}

function isRoomUpgrade(request: IncomingMessage): boolean {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") return false;
  return getRoomName(request) !== "";
}

function peerIdsInRoom(room: string): string[] {
  const set = rooms.get(room);
  if (!set) return [];
  return [...set].map((c) => c.peerId);
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
    const isFirstInRoom = !set || set.size === 0;
    if (!set) {
      set = new Set();
      rooms.set(room, set);
    }
    set.add(client);

    websocket.send(
      JSON.stringify({
        type: "ready",
        initializeScene: isFirstInRoom,
        peers: peerIdsInRoom(room),
      }),
    );

    websocket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      const text = Buffer.isBuffer(data)
        ? data.toString("utf8")
        : Array.isArray(data)
          ? Buffer.concat(data).toString("utf8")
          : Buffer.from(data as ArrayBuffer).toString("utf8");
      const others = rooms.get(room);
      if (!others) return;
      for (const other of others) {
        if (other !== client && other.readyState === WebSocket.OPEN) {
          other.send(text);
        }
      }
    });

    websocket.on("close", () => {
      const r = rooms.get(room);
      if (!r) return;
      r.delete(client);
      if (r.size === 0) {
        rooms.delete(room);
        return;
      }
      let i = 0;
      for (const peer of r) {
        if (peer.readyState === WebSocket.OPEN) {
          peer.send(
            JSON.stringify({
              type: "roomAuthorityUpdate",
              initializeScene: i === 0,
            }),
          );
        }
        i++;
      }
    });

    websocket.on("error", () => {});
  });

  return wss;
}
