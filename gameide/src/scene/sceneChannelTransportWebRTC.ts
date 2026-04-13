import type { SceneChannelTransport } from "./sceneChannelTransport.js";

export interface WebRTCSignaling {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
  ready?: Promise<void>;
}

export type WebRTCSignal =
  | { type: "hello"; peerId: string }
  | { type: "offer"; from: string; to: string; sdp: string }
  | { type: "answer"; from: string; to: string; sdp: string }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit | null };

const DEFAULT_ICE: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
];

export interface CreateSceneTransportWebRTCOptions {
  peerId: string;
  signaling: WebRTCSignaling;
  iceServers?: RTCIceServer[];
  dataChannelLabel?: string;
}

function createNoOpWebRTCTransport(localPeerId: string): SceneTransportWebRTC {
  return {
    localPeerId,
    get remotePeerIds() {
      return [] as readonly string[];
    },
    send: () => {},
    onMessage: () => () => {},
    onRemotePeersChange(handler: (remotePeerIds: readonly string[]) => void) {
      queueMicrotask(() => handler([]));
      return () => {};
    },
    dispose: () => {},
  };
}

export type SceneTransportWebRTC = SceneChannelTransport & {
  dispose(): void;
  localPeerId: string;
  get remotePeerIds(): readonly string[];
  /** Sorted snapshot whenever a remote data channel opens or closes. */
  onRemotePeersChange(
    handler: (remotePeerIds: readonly string[]) => void,
  ): () => void;
};

function isSignal(message: unknown): message is WebRTCSignal {
  if (!message || typeof message !== "object") return false;
  const signalType = (message as { type?: string }).type;
  return (
    signalType === "hello" ||
    signalType === "offer" ||
    signalType === "answer" ||
    signalType === "ice"
  );
}

export function createNetworkingPeerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createBroadcastChannelSignaling(roomId: string): WebRTCSignaling {
  const name = `gameide-webrtc-${roomId}`;
  const channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel(name)
      : null;

  if (!channel) {
    return {
      send: () => {},
      onMessage: () => () => {},
    };
  }

  const handlers = new Set<(message: unknown) => void>();

  channel.onmessage = (event: MessageEvent) => {
    for (const handler of handlers) handler(event.data);
  };

  return {
    send(message: unknown) {
      channel.postMessage(message);
    },
    onMessage(handler: (message: unknown) => void) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
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
 * WebRTC mesh negotiation stays entirely in {@link createSceneTransportWebRTC}.
 */
export function createHTTPRelaySignaling(
  options: HTTPRelaySignalingOptions,
): WebRTCSignaling {
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
        const body = (await r.json()) as { messages?: unknown[] };
        const messages = body.messages;
        if (!Array.isArray(messages)) return;
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

type NegotiationRole = "offerer" | "answerer";

type PeerSession = {
  remotePeerId: string;
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  pendingCandidates: (RTCIceCandidateInit | null)[];
  remoteDescriptionSet: boolean;
  role: NegotiationRole;
  sendQueue: string[];
};

function sessionHasOpenDataChannel(session: PeerSession): boolean {
  const dataChannel = session.dataChannel;
  return dataChannel !== null && dataChannel.readyState === "open";
}

function isPeerConnectionAlive(peerConnection: RTCPeerConnection): boolean {
  const connectionState = peerConnection.connectionState;
  return connectionState !== "closed" && connectionState !== "failed";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export function createSceneTransportWebRTC(
  options: CreateSceneTransportWebRTCOptions,
): Promise<SceneTransportWebRTC> {
  const {
    peerId: localPeerId,
    signaling,
    iceServers = DEFAULT_ICE,
    dataChannelLabel = "scene",
  } = options;

  if (typeof RTCPeerConnection === "undefined") {
    return Promise.resolve(createNoOpWebRTCTransport(localPeerId));
  }

  return new Promise((resolve, reject) => {
    const sessions = new Map<string, PeerSession>();
    const connectedRemotes = new Set<string>();
    const preSessionIce = new Map<string, (RTCIceCandidateInit | null)[]>();

    const messageHandlers = new Set<(message: unknown) => void>();
    const remotePeersListeners = new Set<(remotePeerIds: readonly string[]) => void>();
    let preConnectSendQueue: string[] = [];

    function notifyRemotePeersChanged(): void {
      const snapshot = [...connectedRemotes].sort();
      for (const listener of remotePeersListeners) {
        listener(snapshot);
      }
    }

    let unsubSignaling: () => void = () => {};
    let settled = false;
    let reHelloTimeoutId: ReturnType<typeof setTimeout> | undefined;
    let signalChain: Promise<void> = Promise.resolve();

    function sendHello(): void {
      try {
        signaling.send({
          type: "hello",
          peerId: localPeerId,
        } satisfies WebRTCSignal);
      } catch {
      }
    }

    function scheduleReHello(): void {
      if (reHelloTimeoutId !== undefined) return;
      reHelloTimeoutId = setTimeout(() => {
        reHelloTimeoutId = undefined;
        sendHello();
      }, 400);
    }

    function removePeerSession(remotePeerId: string): void {
      const session = sessions.get(remotePeerId);
      if (!session) {
        preSessionIce.delete(remotePeerId);
        return;
      }
      connectedRemotes.delete(remotePeerId);
      session.sendQueue = [];
      try {
        session.dataChannel?.close();
      } catch {
      }
      try {
        session.peerConnection.close();
      } catch {
      }
      sessions.delete(remotePeerId);
      preSessionIce.delete(remotePeerId);
      notifyRemotePeersChanged();
    }

    function flushSessionQueue(session: PeerSession): void {
      const dataChannel = session.dataChannel;
      if (!dataChannel || dataChannel.readyState !== "open") return;
      if (preConnectSendQueue.length > 0) {
        for (const line of preConnectSendQueue) {
          dataChannel.send(line);
        }
        preConnectSendQueue = [];
      }
      for (const line of session.sendQueue) {
        dataChannel.send(line);
      }
      session.sendQueue = [];
    }

    function attachDataChannel(
      session: PeerSession,
      dataChannel: RTCDataChannel,
      onFirstOpen: () => void,
    ): void {
      session.dataChannel = dataChannel;
      dataChannel.binaryType = "arraybuffer";

      dataChannel.onmessage = (event) => {
        const raw =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data as ArrayBuffer);
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          return;
        }
        for (const handler of messageHandlers) handler(parsed);
      };

      dataChannel.onopen = () => {
        flushSessionQueue(session);
        connectedRemotes.add(session.remotePeerId);
        console.debug("[webrtc] data channel open", {
          peerId: localPeerId,
          remotePeerId: session.remotePeerId,
          role: session.role,
        });
        notifyRemotePeersChanged();
        onFirstOpen();
      };

      dataChannel.onerror = () => {
        console.warn("[webrtc] data channel error", {
          peerId: localPeerId,
          remotePeerId: session.remotePeerId,
          role: session.role,
        });
      };

      dataChannel.onclose = () => {
        connectedRemotes.delete(session.remotePeerId);
        console.debug("[webrtc] data channel closed", {
          peerId: localPeerId,
          remotePeerId: session.remotePeerId,
          role: session.role,
        });
        removePeerSession(session.remotePeerId);
        scheduleReHello();
      };
    }

    function getOrCreateSession(remotePeerId: string): PeerSession {
      let session = sessions.get(remotePeerId);
      if (session) return session;
      const peerConnection = new RTCPeerConnection({ iceServers });
      session = {
        remotePeerId,
        peerConnection,
        dataChannel: null,
        pendingCandidates: [],
        remoteDescriptionSet: false,
        role: localPeerId < remotePeerId ? "offerer" : "answerer",
        sendQueue: [],
      };
      sessions.set(remotePeerId, session);

      const earlyIce = preSessionIce.get(remotePeerId);
      if (earlyIce?.length) {
        preSessionIce.delete(remotePeerId);
        session.pendingCandidates.push(...earlyIce);
      }

      peerConnection.onicecandidate = (event) => {
        const candidate = event.candidate
          ? event.candidate.toJSON()
          : null;
        signaling.send({
          type: "ice",
          from: localPeerId,
          to: remotePeerId,
          candidate,
        } satisfies WebRTCSignal);
      };

      peerConnection.onconnectionstatechange = () => {
        const connectionState = peerConnection.connectionState;
        if (connectionState === "failed" || connectionState === "closed") {
          if (sessions.get(remotePeerId) === session) {
            removePeerSession(remotePeerId);
            scheduleReHello();
          }
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState !== "failed") return;
        if (sessions.get(remotePeerId) === session) {
          removePeerSession(remotePeerId);
          scheduleReHello();
        }
      };

      return session;
    }

    function buildTransport(): SceneTransportWebRTC {
      return {
        localPeerId,
        get remotePeerIds() {
          return [...connectedRemotes];
        },
        send(message: unknown) {
          const line = JSON.stringify(message);
          if (sessions.size === 0) {
            preConnectSendQueue.push(line);
            return;
          }
          for (const session of sessions.values()) {
            const dataChannel = session.dataChannel;
            if (dataChannel && dataChannel.readyState === "open") {
              dataChannel.send(line);
            } else {
              session.sendQueue.push(line);
            }
          }
        },
        onMessage(handler: (message: unknown) => void) {
          messageHandlers.add(handler);
          return () => {
            messageHandlers.delete(handler);
          };
        },
        onRemotePeersChange(handler: (remotePeerIds: readonly string[]) => void) {
          remotePeersListeners.add(handler);
          queueMicrotask(() => handler([...connectedRemotes].sort()));
          return () => {
            remotePeersListeners.delete(handler);
          };
        },
        dispose() {
          unsubSignaling();
          if (reHelloTimeoutId !== undefined) {
            clearTimeout(reHelloTimeoutId);
            reHelloTimeoutId = undefined;
          }
          for (const id of [...sessions.keys()]) {
            removePeerSession(id);
          }
          remotePeersListeners.clear();
          messageHandlers.clear();
        },
      };
    }

    async function addIceCandidate(
      session: PeerSession,
      candidate: RTCIceCandidateInit | null,
    ): Promise<void> {
      if (!session.remoteDescriptionSet) {
        session.pendingCandidates.push(candidate);
        return;
      }
      try {
        if (candidate == null) {
          await session.peerConnection.addIceCandidate();
        } else {
          await session.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch {
      }
    }

    async function flushPendingCandidates(session: PeerSession): Promise<void> {
      const list = session.pendingCandidates.splice(
        0,
        session.pendingCandidates.length,
      );
      for (const pendingCandidate of list) {
        try {
          if (pendingCandidate == null) {
            await session.peerConnection.addIceCandidate();
          } else {
            await session.peerConnection.addIceCandidate(
              new RTCIceCandidate(pendingCandidate),
            );
          }
        } catch {
        }
      }
    }

    function tryResolveFirstOpen(): void {
      if (settled) return;
      settled = true;
      resolve(buildTransport());
    }

    function rejectIfNotSettled(error: unknown): void {
      if (settled) return;
      settled = true;
      reject(toError(error));
    }

    async function runOfferer(remotePeerId: string): Promise<void> {
      const existing = sessions.get(remotePeerId);
      if (existing) {
        if (
          sessionHasOpenDataChannel(existing) &&
          isPeerConnectionAlive(existing.peerConnection)
        ) {
          return;
        }
        removePeerSession(remotePeerId);
      }
      const session = getOrCreateSession(remotePeerId);
      if (session.role !== "offerer") return;

      const dataChannel = session.peerConnection.createDataChannel(dataChannelLabel, {
        ordered: true,
      });
      attachDataChannel(session, dataChannel, tryResolveFirstOpen);

      try {
        const offer = await session.peerConnection.createOffer();
        await session.peerConnection.setLocalDescription(offer);
        signaling.send({
          type: "offer",
          from: localPeerId,
          to: remotePeerId,
          sdp: offer.sdp!,
        } satisfies WebRTCSignal);
      } catch (error) {
        rejectIfNotSettled(error);
      }
    }

    async function applyOffer(session: PeerSession, sdp: string): Promise<void> {
      await session.peerConnection.setRemoteDescription({ type: "offer", sdp });
      session.remoteDescriptionSet = true;
      await flushPendingCandidates(session);
      const answer = await session.peerConnection.createAnswer();
      await session.peerConnection.setLocalDescription(answer);
      signaling.send({
        type: "answer",
        from: localPeerId,
        to: session.remotePeerId,
        sdp: answer.sdp!,
      } satisfies WebRTCSignal);
    }

    async function applyAnswer(session: PeerSession, sdp: string): Promise<void> {
      await session.peerConnection.setRemoteDescription({ type: "answer", sdp });
      session.remoteDescriptionSet = true;
      await flushPendingCandidates(session);
    }

    function handleHello(remotePeerId: string): void {
      if (remotePeerId === localPeerId) return;
      if (localPeerId < remotePeerId) {
        void runOfferer(remotePeerId);
      }
    }

    function getOrCreateAnswererSession(remotePeerId: string): PeerSession {
      let session = sessions.get(remotePeerId);
      if (session && !isPeerConnectionAlive(session.peerConnection)) {
        removePeerSession(remotePeerId);
        session = undefined;
      }
      if (session) return session;

      session = getOrCreateSession(remotePeerId);
      const sessionForDataChannel = session;
      session.peerConnection.ondatachannel = (event) => {
        attachDataChannel(
          sessionForDataChannel,
          event.channel,
          tryResolveFirstOpen,
        );
      };
      return session;
    }

    async function handleSignal(message: WebRTCSignal): Promise<void> {
      switch (message.type) {
        case "hello": {
          handleHello(message.peerId);
          return;
        }

        case "offer": {
          if (message.to !== localPeerId || message.from === localPeerId) return;
          const session = getOrCreateAnswererSession(message.from);
          if (session.role === "answerer") {
            await applyOffer(session, message.sdp);
          }
          return;
        }

        case "answer": {
          if (message.to !== localPeerId) return;
          const session = sessions.get(message.from);
          if (session && session.role === "offerer") {
            await applyAnswer(session, message.sdp);
          }
          return;
        }

        case "ice": {
          if (message.to !== localPeerId) return;
          const session = sessions.get(message.from);
          if (!session) {
            const list = preSessionIce.get(message.from) ?? [];
            list.push(message.candidate);
            preSessionIce.set(message.from, list);
            return;
          }
          await addIceCandidate(session, message.candidate);
          return;
        }
      }
    }

    unsubSignaling = signaling.onMessage((message) => {
      signalChain = signalChain
        .then(async () => {
          if (!isSignal(message)) return;
          await handleSignal(message);
        })
        .catch((err) => {
          rejectIfNotSettled(err);
          console.warn("[webrtc] signaling chain error", err);
        });
    });

    // Resolve immediately so callers can run locally while negotiation continues.
    settled = true;
    resolve(buildTransport());

    // Send a one-shot discovery hello immediately; hello replies handle late joiners.
    sendHello();

    const signalingReady = signaling.ready ?? Promise.resolve();
    void signalingReady
      .then(() => {
        if (settled) return;
        sendHello();
      })
      .catch((error) => {
        console.warn("[webrtc] signaling readiness failed", error);
      });
  });
}
