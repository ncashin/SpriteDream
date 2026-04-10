/** In-memory WebRTC signal relay per game room (single-process; KISS). */

type PeerSend = (message: unknown) => void;

function allowedCorsOrigin(originHeader: string | null): string | null {
  if (!originHeader) return null;
  try {
    const u = new URL(originHeader);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]"
    ) {
      return originHeader;
    }
    return null;
  } catch {
    return null;
  }
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedCorsOrigin(request.headers.get("Origin"));
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

const rooms = new Map<string, Map<string, PeerSend>>();
const DEFAULT_ROOM = "default";

function roomKey(gameId: string, room: string): string {
  return `${gameId}::${room}`;
}

function roomPeers(
  gameId: string,
  room: string,
  create = false,
): Map<string, PeerSend> | undefined {
  const key = roomKey(gameId, room);
  let peers = rooms.get(key);
  if (!peers && create) {
    peers = new Map();
    rooms.set(key, peers);
  }
  return peers;
}

function subscribePeer(
  gameId: string,
  room: string,
  peerId: string,
  send: PeerSend,
): () => void {
  const key = roomKey(gameId, room);
  const peers = roomPeers(gameId, room, true);
  if (!peers) return () => {};

  for (const [existingPeerId, existingSend] of peers) {
    if (existingPeerId === peerId) continue;
    try {
      send({ type: "hello", peerId: existingPeerId });
      existingSend({ type: "hello", peerId });
    } catch {
      // ignore broken streams
    }
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
  const sender = m.type === "hello" ? m.peerId : m.from;
  return typeof sender === "string" ? sender : null;
}

/** Fan-out to every peer in the room except the sender (derived from the signal body). */
function relaySignal(gameId: string, room: string, message: unknown): void {
  const from = senderPeerId(message);
  const peers = roomPeers(gameId, room);
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
      ...corsHeaders(request),
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
  if (request.method === "OPTIONS") {
    const headers = corsHeaders(request);
    return new Response(null, {
      status: 204,
      headers: headers["Access-Control-Allow-Origin"] ? headers : undefined,
    });
  }

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

  const room = url.searchParams.get("room") ?? DEFAULT_ROOM;
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
  const room = url.searchParams.get("room") ?? DEFAULT_ROOM;

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  relaySignal(gameId, room, message);
  return Response.json({ ok: true }, { headers: corsHeaders(request) });
}
