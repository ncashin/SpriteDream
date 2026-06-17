import { DurableObject } from "cloudflare:workers";

type RoomClient = {
  webSocket: WebSocket;
  peerId: string;
};

export class Room extends DurableObject {
  private clients = new Set<RoomClient>();
  private nextPeer = 1;

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const peerId = `p${this.nextPeer++}`;
    const roomClient: RoomClient = { webSocket: server, peerId };
    this.clients.add(roomClient);

    server.send(
      JSON.stringify({
        type: "ready",
        peers: this.peerIds(),
      }),
    );

    this.broadcastPeers();

    server.addEventListener("message", (event) => {
      const text =
        typeof event.data === "string" ? event.data : String(event.data);
      for (const other of this.clients) {
        if (
          other !== roomClient &&
          other.webSocket.readyState === WebSocket.OPEN
        ) {
          other.webSocket.send(text);
        }
      }
    });

    server.addEventListener("close", () => {
      this.clients.delete(roomClient);
      this.broadcastPeers();
    });

    return new Response(null, { status: 101, webSocket: client });
  }

  private peerIds(): string[] {
    return [...this.clients].map((client) => client.peerId);
  }

  private broadcastPeers() {
    const payload = JSON.stringify({
      type: "roomPeersUpdate",
      peers: this.peerIds(),
    });
    for (const client of this.clients) {
      if (client.webSocket.readyState === WebSocket.OPEN) {
        client.webSocket.send(payload);
      }
    }
  }
}
