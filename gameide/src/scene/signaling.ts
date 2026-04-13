/**
 * Generic signaling transport (opaque JSON) plus a typed {@link createSignalingChannel}
 * wrapper, mirroring the scene stack: raw transport plus a small typed channel layer.
 */

/** Low-level bidirectional signaling (same role as {@link SceneChannelTransport} for scene). */
export type SignalingRoomState = {
  peerIds: readonly string[];
  roomEpoch: number;
};

export interface SignalingTransport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
  ready?: Promise<void>;
  getRoomState?(): SignalingRoomState | null;
}

/** @deprecated Prefer {@link SignalingTransport}; kept for existing call sites. */
export type WebRTCSignaling = SignalingTransport;

export const WEBRTC_SIGNALING = {
  hello: "hello",
  offer: "offer",
  answer: "answer",
  ice: "ice",
} as const;

export type WebRTCSignal =
  | { type: typeof WEBRTC_SIGNALING.hello; peerId: string }
  | {
      type: typeof WEBRTC_SIGNALING.offer;
      from: string;
      to: string;
      sdp: string;
    }
  | {
      type: typeof WEBRTC_SIGNALING.answer;
      from: string;
      to: string;
      sdp: string;
    }
  | {
      type: typeof WEBRTC_SIGNALING.ice;
      from: string;
      to: string;
      candidate: RTCIceCandidateInit | null;
    };

export function isWebRtcSignal(message: unknown): message is WebRTCSignal {
  if (!message || typeof message !== "object") return false;
  const signalType = (message as { type?: string }).type;
  return (
    signalType === WEBRTC_SIGNALING.hello ||
    signalType === WEBRTC_SIGNALING.offer ||
    signalType === WEBRTC_SIGNALING.answer ||
    signalType === WEBRTC_SIGNALING.ice
  );
}

export interface CreateSignalingChannelOptions {
  transport: SignalingTransport;
}

export interface SignalingChannel {
  dispose(): void;
  readonly ready: Promise<void>;
  sendSignal(signal: WebRTCSignal): void;
  onSignal(handler: (signal: WebRTCSignal) => void): () => void;
}

/**
 * Wraps a {@link SignalingTransport} with filtered inbound messages and typed send,
 * similar to {@link createSceneChannel} over a scene transport.
 */
export function createSignalingChannel(
  options: CreateSignalingChannelOptions,
): SignalingChannel {
  const { transport } = options;
  const readyPromise = transport.ready ?? Promise.resolve();
  const handlers = new Set<(signal: WebRTCSignal) => void>();
  let unsubTransport: (() => void) | undefined;

  function ensureSubscribed(): void {
    if (unsubTransport !== undefined) return;
    unsubTransport = transport.onMessage((message) => {
      if (!isWebRtcSignal(message)) return;
      for (const handler of handlers) {
        handler(message);
      }
    });
  }

  return {
    get ready() {
      return readyPromise;
    },
    sendSignal(signal: WebRTCSignal) {
      try {
        transport.send(signal);
      } catch {
      }
    },
    onSignal(handler: (signal: WebRTCSignal) => void) {
      handlers.add(handler);
      ensureSubscribed();
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) {
          unsubTransport?.();
          unsubTransport = undefined;
        }
      };
    },
    dispose() {
      handlers.clear();
      unsubTransport?.();
      unsubTransport = undefined;
    },
  };
}

export type HTTPRelaySignalingOptions = {
  signalingURL: string;
  roomId: string;
  peerId: string;
  /** Milliseconds between GET ?poll=1 requests. */
  pollIntervalMs?: number;
};

/** @deprecated Use {@link HTTPRelaySignalingOptions} */
export type HTTPSSESignalingOptions = HTTPRelaySignalingOptions;

/**
 * Minimal HTTP relay: POST JSON signals, GET periodically to drain inbound messages.
 * WebRTC mesh negotiation stays in `createSceneTransportWebRTC`.
 */
export function createHTTPRelaySignaling(
  options: HTTPRelaySignalingOptions,
): SignalingTransport {
  const { signalingURL, roomId, peerId, pollIntervalMs = 400 } = options;

  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return {
      send: () => {},
      onMessage: () => () => {},
      ready: Promise.resolve(),
    };
  }

  const handlers = new Set<(message: unknown) => void>();
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let roomState: SignalingRoomState | null = null;
  let resolveReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function resolveReadyOnce(): void {
    resolveReady?.();
    resolveReady = undefined;
  }

  function signalingEndpoint(extra: Record<string, string>): string {
    const u = new URL(signalingURL, window.location.href);
    u.searchParams.set("room", roomId);
    for (const [key, value] of Object.entries(extra)) {
      u.searchParams.set(key, value);
    }
    return u.toString();
  }

  function postToSignaling(message: unknown): void {
    void fetch(signalingEndpoint({}), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
      credentials: "same-origin",
    }).catch(() => {});
  }

  function pollOnce(): void {
    void fetch(signalingEndpoint({ poll: "1", peerId }), {
      method: "GET",
      credentials: "same-origin",
    })
      .then(async (r) => {
        if (!r.ok) return;
        const body = (await r.json()) as {
          messages?: unknown[];
          peerIds?: unknown[];
          roomEpoch?: unknown;
        };
        const messages = body.messages;
        if (!Array.isArray(messages)) return;
        const peerIds = Array.isArray(body.peerIds)
          ? body.peerIds.filter((value): value is string => typeof value === "string")
          : [];
        const roomEpoch =
          typeof body.roomEpoch === "number" && Number.isFinite(body.roomEpoch)
            ? body.roomEpoch
            : roomState?.roomEpoch ?? 0;
        roomState = { peerIds, roomEpoch };
        resolveReadyOnce();
        for (const message of messages) {
          for (const handler of handlers) handler(message);
        }
      })
      .catch(() => {
        resolveReadyOnce();
      });
  }

  function startPolling(): void {
    if (pollTimer !== null) return;
    pollOnce();
    pollTimer = setInterval(pollOnce, pollIntervalMs);
  }

  function stopPolling(): void {
    if (pollTimer === null) return;
    clearInterval(pollTimer);
    pollTimer = null;
  }

  return {
    ready,
    getRoomState() {
      return roomState;
    },
    send(message: unknown) {
      postToSignaling(message);
    },
    onMessage(handler: (message: unknown) => void) {
      handlers.add(handler);
      startPolling();
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) stopPolling();
      };
    },
  };
}

/** @deprecated Use {@link createHTTPRelaySignaling} */
export const createHTTPSSESignaling = createHTTPRelaySignaling;
