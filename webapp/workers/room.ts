import { DurableObject } from "cloudflare:workers";

type RoomSocketAttachment = {
  peerId: string;
};

export class Room extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS room_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          next_peer INTEGER NOT NULL
        )
      `);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const peerId = this.allocatePeerId();
    server.serializeAttachment({ peerId } satisfies RoomSocketAttachment);

    server.send(
      JSON.stringify({
        type: "ready",
        peerId,
        peers: this.peerIds(),
      }),
    );

    this.broadcastPeers(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const text =
      typeof message === "string" ? message : new TextDecoder().decode(message);
    for (const other of this.ctx.getWebSockets()) {
      if (other !== ws && other.readyState === WebSocket.OPEN) {
        other.send(text);
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    code: number,
    reason: string,
    _wasClean: boolean,
  ) {
    ws.close(code, reason);
    this.broadcastPeers();
  }

  async webSocketError(ws: WebSocket, _error: unknown) {
    ws.close();
    this.broadcastPeers();
  }

  private peerIds(): string[] {
    return this.ctx
      .getWebSockets()
      .filter((webSocket) => webSocket.readyState === WebSocket.OPEN)
      .map((webSocket) => this.peerIdFor(webSocket))
      .filter((peerId): peerId is string => peerId !== undefined);
  }

  private broadcastPeers(except?: WebSocket) {
    const payload = JSON.stringify({
      type: "roomPeersUpdate",
      peers: this.peerIds(),
    });
    for (const webSocket of this.ctx.getWebSockets()) {
      if (webSocket !== except && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(payload);
      }
    }
  }

  private peerIdFor(webSocket: WebSocket): string | undefined {
    const attachment = webSocket.deserializeAttachment();
    if (attachment == null || typeof attachment !== "object") return undefined;
    const { peerId } = attachment as Record<string, unknown>;
    return typeof peerId === "string" ? peerId : undefined;
  }

  private allocatePeerId(): string {
    const row = this.ctx.storage.sql
      .exec<{ peer_id: number }>(
        `
          INSERT INTO room_state (id, next_peer)
          VALUES (1, 2)
          ON CONFLICT(id) DO UPDATE SET next_peer = next_peer + 1
          RETURNING next_peer - 1 AS peer_id
        `,
      )
      .one();
    return `p${row.peer_id}`;
  }
}
