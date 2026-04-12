function allowedCORSOrigin(originHeader: string | null): string | null {
  if (!originHeader) return null;
  try {
    const originUrl = new URL(originHeader);
    if (originUrl.protocol !== "http:" && originUrl.protocol !== "https:")
      return null;
    const host = originUrl.hostname;
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

const CORS_ALLOW_HEADERS = "Accept, Cache-Control, Content-Type, Pragma";

function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedCORSOrigin(request.headers.get("Origin"));
  if (!origin) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": CORS_ALLOW_HEADERS,
    Vary: "Origin",
  };
}

function corsAwareResponse(
  request: Request,
  body: BodyInit | null,
  init: ResponseInit = {},
): Response {
  const headers = new Headers(init.headers);
  for (const [headerName, headerValue] of Object.entries(
    corsHeaders(request),
  )) {
    headers.set(headerName, headerValue);
  }
  return new Response(body, { ...init, headers });
}

const DEFAULT_ROOM = "default";
const STALE_MS = 60_000;
const MAX_QUEUE = 500;

function roomKey(gameId: string, room: string): string {
  return `${gameId}::${room}`;
}

const roomPeers = new Map<string, Set<string>>();
const mailboxes = new Map<string, Map<string, unknown[]>>();
const lastPoll = new Map<string, number>();

function peerStamp(key: string, peerId: string): string {
  return `${key}::${peerId}`;
}

function pruneStale(gameId: string, room: string): void {
  const key = roomKey(gameId, room);
  const peers = roomPeers.get(key);
  if (!peers) return;
  const now = Date.now();
  for (const peerId of [...peers]) {
    const stamp = peerStamp(key, peerId);
    if (now - (lastPoll.get(stamp) ?? 0) > STALE_MS) {
      peers.delete(peerId);
      lastPoll.delete(stamp);
      mailboxes.get(key)?.delete(peerId);
    }
  }
  if (peers.size === 0) {
    roomPeers.delete(key);
    mailboxes.delete(key);
  }
}

function ensureMailbox(key: string, peerId: string): unknown[] {
  let room = mailboxes.get(key);
  if (!room) {
    room = new Map();
    mailboxes.set(key, room);
  }
  let mailboxQueue = room.get(peerId);
  if (!mailboxQueue) {
    mailboxQueue = [];
    room.set(peerId, mailboxQueue);
  }
  return mailboxQueue;
}

function enqueue(gameId: string, room: string, toPeerId: string, message: unknown): void {
  const key = roomKey(gameId, room);
  const mailboxQueue = ensureMailbox(key, toPeerId);
  if (mailboxQueue.length >= MAX_QUEUE) mailboxQueue.shift();
  mailboxQueue.push(message);
}

function ensurePeerRegistered(gameId: string, room: string, peerId: string): void {
  const key = roomKey(gameId, room);
  let peers = roomPeers.get(key);
  if (!peers) {
    peers = new Set();
    roomPeers.set(key, peers);
  }
  if (peers.has(peerId)) return;

  for (const other of peers) {
    enqueue(gameId, room, peerId, { type: "hello", peerId: other });
    enqueue(gameId, room, other, { type: "hello", peerId });
  }
  peers.add(peerId);
  lastPoll.set(peerStamp(key, peerId), Date.now());
}

function senderPeerId(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const signalBody = message as {
    type?: string;
    peerId?: string;
    from?: string;
  };
  const sender =
    signalBody.type === "hello" ? signalBody.peerId : signalBody.from;
  return typeof sender === "string" ? sender : null;
}

function relaySignal(gameId: string, room: string, message: unknown): void {
  pruneStale(gameId, room);
  const from = senderPeerId(message);
  if (from) ensurePeerRegistered(gameId, room, from);

  const key = roomKey(gameId, room);
  const peers = roomPeers.get(key);
  if (!peers) return;
  for (const peerId of peers) {
    if (from !== null && peerId === from) continue;
    enqueue(gameId, room, peerId, message);
  }
}

function pollResponse(
  request: Request,
  gameId: string,
  room: string,
  peerId: string,
): Response {
  pruneStale(gameId, room);
  ensurePeerRegistered(gameId, room, peerId);
  const key = roomKey(gameId, room);
  lastPoll.set(peerStamp(key, peerId), Date.now());

  const mailboxQueue = ensureMailbox(key, peerId);
  const messages = mailboxQueue.splice(0, mailboxQueue.length);

  return Response.json(
    { messages },
    { headers: { ...corsHeaders(request), "Cache-Control": "no-store" } },
  );
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

  const gameId = params?.gameId;
  if (!gameId) {
    return corsAwareResponse(request, "Missing game id", { status: 400 });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("poll") !== "1") {
    return corsAwareResponse(
      request,
      "Use GET ?poll=1&peerId=…&room=… to receive signals",
      { status: 400 },
    );
  }

  const peerId = url.searchParams.get("peerId");
  if (!peerId) {
    return corsAwareResponse(request, "peerId required", { status: 400 });
  }

  if (request.method !== "GET") {
    return corsAwareResponse(request, "Use GET for polling", { status: 405 });
  }

  const room = url.searchParams.get("room") ?? DEFAULT_ROOM;
  return pollResponse(request, gameId, room, peerId);
}

export async function action({
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
  if (request.method !== "POST") {
    return corsAwareResponse(request, "Method not allowed", { status: 405 });
  }

  const gameId = params?.gameId;
  if (!gameId) {
    return corsAwareResponse(request, "Missing game id", { status: 400 });
  }

  const url = new URL(request.url);
  const room = url.searchParams.get("room") ?? DEFAULT_ROOM;

  let message: unknown;
  try {
    message = await request.json();
  } catch {
    return corsAwareResponse(request, "Invalid JSON", { status: 400 });
  }

  relaySignal(gameId, room, message);
  return Response.json({ ok: true }, { headers: corsHeaders(request) });
}
