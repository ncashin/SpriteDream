/** In-memory WebRTC signal relay per game room (single-process; KISS). */

type PeerSend = (message: unknown) => void;

const rooms = new Map<string, Map<string, PeerSend>>();

function roomKey(gameId: string, room: string): string {
  return `${gameId}::${room}`;
}

function subscribePeer(
  gameId: string,
  room: string,
  peerId: string,
  send: PeerSend,
): () => void {
  const key = roomKey(gameId, room);
  let peers = rooms.get(key);
  if (!peers) {
    peers = new Map();
    rooms.set(key, peers);
  }
  peers.set(peerId, send);
  return () => {
    const map = rooms.get(key);
    if (!map) return;
    if (map.get(peerId) !== send) return;
    map.delete(peerId);
    if (map.size === 0) {
      rooms.delete(key);
    }
  };
}

function senderPeerId(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const m = message as { type?: string; peerId?: string; from?: string };
  if (m.type === "hello") {
    return typeof m.peerId === "string" ? m.peerId : null;
  }
  return typeof m.from === "string" ? m.from : null;
}

/** Fan-out to every peer in the room except the sender (derived from the signal body). */
function relaySignal(gameId: string, room: string, message: unknown): void {
  const from = senderPeerId(message);
  const key = roomKey(gameId, room);
  const peers = rooms.get(key);
  if (!peers) return;
  for (const [peerId, send] of peers) {
    if (from !== null && peerId === from) continue;
    try {
      send(message);
    } catch {
      // ignore broken streams
    }
  }
}

function sseResponse(
  request: Request,
  gameId: string,
  room: string,
  peerId: string,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (message: unknown) => {
        const line = `data: ${JSON.stringify(message)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      const unsubscribe = subscribePeer(gameId, room, peerId, send);

      const onAbort = () => {
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      request.signal.addEventListener("abort", onAbort);
      if (request.signal.aborted) {
        onAbort();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function loader({
  request,
  params,
}: {
  request: Request;
  params: { gameId?: string };
}) {
  console.log("RECEIVED: ", params.gameId)
  const gameId = params.gameId;
  if (!gameId) {
    return new Response("Missing game id", { status: 400 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("sse") !== "1") {
    return new Response("Use GET ?sse=1&peerId=…&room=… for SSE", {
      status: 400,
    });
  }

  const peerId = url.searchParams.get("peerId");
  if (!peerId) {
    return new Response("peerId required", { status: 400 });
  }

  const room = url.searchParams.get("room") ?? "default";
  return sseResponse(request, gameId, room, peerId);
}

export async function action({
  request,
  params,
}: {
  request: Request;
  params: { gameId?: string };
}) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const gameId = params.gameId;
  if (!gameId) {
    return new Response("Missing game id", { status: 400 });
  }

  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? "default";

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  relaySignal(gameId, room, message);
  return Response.json({ ok: true });
}
