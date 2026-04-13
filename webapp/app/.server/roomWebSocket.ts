import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocketServer } from "ws";

const ROOM_PATHS = new Set(["/room", "/room/"]);

function isRoomUpgrade(request: IncomingMessage): boolean {
  if (request.headers.upgrade?.toLowerCase() !== "websocket") return false;
  const host = request.headers.host ?? "localhost";
  const pathname = new URL(request.url ?? "/", `http://${host}`).pathname;
  return ROOM_PATHS.has(pathname);
}

export function attachRoomWebSocket(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (!isRoomUpgrade(req)) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  });

  wss.on("connection", (ws) => {
    ws.on("error", () => {});
    ws.send(JSON.stringify({ type: "ready" }));
  });

  return wss;
}
