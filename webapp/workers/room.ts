import { DurableObject } from "cloudflare:workers";

type RoomSocketAttachment = {
  peerIdentifier: string;
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

    const peerIdentifier = this.resolvePeerIdentifier(
      new URL(request.url).searchParams.get("peerIdentifier")?.trim() || undefined,
      server,
    );
    server.serializeAttachment({ peerIdentifier } satisfies RoomSocketAttachment);

    server.send(
      JSON.stringify({
        type: "ready",
        peerIdentifier,
        peers: this.peerIdentifiers(),
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

  private peerIdentifiers(): string[] {
    return this.ctx
      .getWebSockets()
      .filter((webSocket) => webSocket.readyState === WebSocket.OPEN)
      .map((webSocket) => this.peerIdentifierFor(webSocket))
      .filter((peerIdentifier): peerIdentifier is string => peerIdentifier !== undefined);
  }

  private broadcastPeers(except?: WebSocket) {
    const payload = JSON.stringify({
      type: "roomPeersUpdate",
      peers: this.peerIdentifiers(),
    });
    for (const webSocket of this.ctx.getWebSockets()) {
      if (webSocket !== except && webSocket.readyState === WebSocket.OPEN) {
        webSocket.send(payload);
      }
    }
  }

  private peerIdentifierFor(webSocket: WebSocket): string | undefined {
    const attachment = webSocket.deserializeAttachment();
    if (attachment == null || typeof attachment !== "object") return undefined;
    const { peerIdentifier } = attachment as Record<string, unknown>;
    return typeof peerIdentifier === "string" ? peerIdentifier : undefined;
  }

  private resolvePeerIdentifier(requested?: string, except?: WebSocket): string {
    if (requested) {
      if (this.peerIdentifiers().includes(requested)) {
        this.evictPeerIdentifier(requested, except);
      } else {
        this.ensureNextPeerAbove(requested);
      }
      return requested;
    }
    return this.allocatePeerIdentifier();
  }

  private evictPeerIdentifier(peerIdentifier: string, except?: WebSocket): void {
    for (const webSocket of this.ctx.getWebSockets()) {
      if (webSocket === except) continue;
      if (this.peerIdentifierFor(webSocket) !== peerIdentifier) continue;
      try {
        webSocket.close(1000, "peer reconnected");
      } catch {
        // ignore close failures on stale sockets
      }
    }
  }

  private ensureNextPeerAbove(peerIdentifier: string): void {
    const match = /^p(\d+)$/.exec(peerIdentifier);
    if (!match) return;
    const id = Number(match[1]);
    if (!Number.isFinite(id)) return;
    const next = id + 1;
    this.ctx.storage.sql.exec(
      `
        INSERT INTO room_state (id, next_peer)
        VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET next_peer = MAX(next_peer, ?)
      `,
      next,
      next,
    );
  }

  private allocatePeerIdentifier(): string {
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
