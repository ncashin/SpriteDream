import { DurableObject } from "cloudflare:workers";

const ROOM_MESSAGE = {
  ready: "ready",
  roomPeersUpdate: "roomPeersUpdate",
  signal: "signal",
} as const;

type RoomAttachment = {
  peerId: string;
};

function isRoomSignalMessage(message: unknown): message is {
  type: typeof ROOM_MESSAGE.signal;
  to: string;
  payload: unknown;
} {
  if (message == null || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === ROOM_MESSAGE.signal && typeof record.to === "string";
}

function messageText(message: string | ArrayBuffer): string {
  return typeof message === "string" ? message : new TextDecoder().decode(message);
}

function getAttachment(ws: WebSocket): RoomAttachment | null {
  const attachment = ws.deserializeAttachment() as RoomAttachment | null;
  if (attachment == null || typeof attachment.peerId !== "string") return null;
  return attachment;
}

export class Room extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const peerId = this.allocatePeerId();
    server.serializeAttachment({ peerId } satisfies RoomAttachment);

    server.send(
      JSON.stringify({
        type: ROOM_MESSAGE.ready,
        peerId,
        peers: this.peerIds(),
      }),
    );

    this.broadcastPeers();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = getAttachment(ws);
    if (!attachment) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(messageText(message));
    } catch {
      return;
    }
    if (!isRoomSignalMessage(parsed)) return;

    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue;
      const otherAttachment = getAttachment(other);
      if (otherAttachment?.peerId !== parsed.to) continue;
      other.send(
        JSON.stringify({
          type: ROOM_MESSAGE.signal,
          to: parsed.to,
          from: attachment.peerId,
          payload: parsed.payload,
        }),
      );
      return;
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    wasClean: boolean,
  ): Promise<void> {
    ws.close(code, reason);
    this.broadcastPeers();
  }

  private allocatePeerId(): string {
    let max = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const peerId = getAttachment(ws)?.peerId;
      if (!peerId) continue;
      const numeric = Number.parseInt(peerId.slice(1), 10);
      if (!Number.isNaN(numeric)) {
        max = Math.max(max, numeric);
      }
    }
    return `p${max + 1}`;
  }

  private peerIds(): string[] {
    return this.ctx
      .getWebSockets()
      .map((ws) => getAttachment(ws)?.peerId)
      .filter((peerId): peerId is string => typeof peerId === "string");
  }

  private broadcastPeers() {
    const payload = JSON.stringify({
      type: ROOM_MESSAGE.roomPeersUpdate,
      peers: this.peerIds(),
    });
    for (const ws of this.ctx.getWebSockets()) {
      ws.send(payload);
    }
  }
}
