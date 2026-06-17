import type { SceneChannelTransport } from "../scene/sceneChannel/sceneChannelTransport.js";
import { connectRoomSignaling, type RoomSignalingClient } from "./roomSignalingClient.js";
import type { WebRTCSignalPayload } from "./roomSignalingMessages.js";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const DATA_CHANNEL_LABEL = "gameide-scene";
const CONNECTION_RETRY_MS = 2000;

export type WebRTCRoomTransport = SceneChannelTransport & {
  dispose(): void;
  getPeers(): string[];
  onPeersChange(handler: (peers: string[]) => void): () => void;
};

export type ConnectWebRTCRoomResult = {
  transport: WebRTCRoomTransport;
  peers: string[];
  dispose(): void;
};

type PeerConnectionState = {
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  makingOffer: boolean;
  pendingIce: RTCIceCandidateInit[];
};

function shouldInitiateConnection(localPeerId: string, remotePeerId: string): boolean {
  return localPeerId.localeCompare(remotePeerId) < 0;
}

export function connectWebRTCRoomTransport(options: {
  room: string;
  url?: string;
  iceServers?: RTCIceServer[];
}): Promise<ConnectWebRTCRoomResult> {
  const iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;

  return connectRoomSignaling({ room: options.room, url: options.url }).then(
    (signaling) => createWebRTCRoomTransport(signaling, iceServers),
  );
}

function createWebRTCRoomTransport(
  signaling: RoomSignalingClient,
  iceServers: RTCIceServer[],
): ConnectWebRTCRoomResult {
  const messageHandlers = new Set<(message: unknown) => void>();
  const peerConnections = new Map<string, PeerConnectionState>();
  const pendingOutbound: string[] = [];
  let disposed = false;

  function notifyMessageHandlers(message: unknown) {
    messageHandlers.forEach((handler) => handler(message));
  }

  function flushPendingOutbound() {
    if (pendingOutbound.length === 0) return;
    const channels = openDataChannels();
    if (channels.length === 0) return;
    const queued = pendingOutbound.splice(0, pendingOutbound.length);
    for (const payload of queued) {
      for (const channel of channels) {
        channel.send(payload);
      }
    }
  }

  function openDataChannels(): RTCDataChannel[] {
    const channels: RTCDataChannel[] = [];
    for (const state of peerConnections.values()) {
      if (state.dataChannel?.readyState === "open") {
        channels.push(state.dataChannel);
      }
    }
    return channels;
  }

  function attachDataChannel(remotePeerId: string, channel: RTCDataChannel) {
    const state = peerConnections.get(remotePeerId);
    if (state) {
      state.dataChannel = channel;
    }

    channel.addEventListener("message", (event) => {
      try {
        notifyMessageHandlers(JSON.parse(String(event.data)));
      } catch {
        // ignore malformed scene payloads
      }
    });

    channel.addEventListener("open", () => {
      flushPendingOutbound();
    });
  }

  async function flushPendingIce(state: PeerConnectionState) {
    const queued = state.pendingIce.splice(0, state.pendingIce.length);
    for (const candidate of queued) {
      try {
        await state.connection.addIceCandidate(candidate);
      } catch {
        // ignore stale ICE candidates
      }
    }
  }

  function createPeerConnection(remotePeerId: string): PeerConnectionState {
    const connection = new RTCPeerConnection({ iceServers });
    const state: PeerConnectionState = {
      connection,
      dataChannel: null,
      makingOffer: false,
      pendingIce: [],
    };

    connection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        signaling.sendSignal(remotePeerId, {
          type: "ice",
          candidate: event.candidate.toJSON(),
        });
      }
    });

    connection.addEventListener("connectionstatechange", () => {
      if (
        connection.connectionState === "failed" ||
        connection.connectionState === "closed"
      ) {
        removePeerConnection(remotePeerId);
      }
    });

    connection.addEventListener("datachannel", (event) => {
      attachDataChannel(remotePeerId, event.channel);
    });

    peerConnections.set(remotePeerId, state);
    return state;
  }

  function removePeerConnection(remotePeerId: string) {
    const state = peerConnections.get(remotePeerId);
    if (!state) return;
    state.dataChannel?.close();
    state.connection.close();
    peerConnections.delete(remotePeerId);
  }

  function hasOpenChannel(remotePeerId: string): boolean {
    return peerConnections.get(remotePeerId)?.dataChannel?.readyState === "open";
  }

  async function initiateConnection(remotePeerId: string, retry = false) {
    if (disposed) return;
    if (remotePeerId === signaling.peerId) return;
    if (hasOpenChannel(remotePeerId)) return;
    if (!shouldInitiateConnection(signaling.peerId, remotePeerId)) return;

    const existing = peerConnections.get(remotePeerId);
    if (existing) {
      const { connection } = existing;
      if (
        !retry &&
        (connection.connectionState === "connecting" ||
          connection.connectionState === "new" ||
          existing.makingOffer)
      ) {
        return;
      }
      removePeerConnection(remotePeerId);
    }

    const state = createPeerConnection(remotePeerId);
    const channel = state.connection.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    attachDataChannel(remotePeerId, channel);

    state.makingOffer = true;
    try {
      const offer = await state.connection.createOffer();
      await state.connection.setLocalDescription(offer);
      signaling.sendSignal(remotePeerId, { type: "offer", sdp: offer });
    } finally {
      state.makingOffer = false;
    }
  }

  async function handleSignal(from: string, payload: WebRTCSignalPayload) {
    if (disposed || from === signaling.peerId) return;

    if (payload.type === "offer") {
      let state = peerConnections.get(from);
      if (!state) {
        state = createPeerConnection(from);
      }

      if (state.connection.signalingState !== "stable") {
        return;
      }

      await state.connection.setRemoteDescription(payload.sdp);
      await flushPendingIce(state);
      const answer = await state.connection.createAnswer();
      await state.connection.setLocalDescription(answer);
      signaling.sendSignal(from, { type: "answer", sdp: answer });
      return;
    }

    const state = peerConnections.get(from);
    if (!state) {
      if (payload.type === "ice" && payload.candidate) {
        const pending = createPeerConnection(from);
        pending.pendingIce.push(payload.candidate);
      }
      return;
    }

    if (payload.type === "answer") {
      if (state.connection.signalingState === "have-local-offer") {
        await state.connection.setRemoteDescription(payload.sdp);
        await flushPendingIce(state);
      }
      return;
    }

    if (payload.type === "ice" && payload.candidate) {
      if (!state.connection.remoteDescription) {
        state.pendingIce.push(payload.candidate);
        return;
      }
      try {
        await state.connection.addIceCandidate(payload.candidate);
      } catch {
        // ignore stale ICE candidates
      }
    }
  }

  function syncPeerConnections(peers: string[]) {
    const remotePeers = new Set(peers.filter((peerId) => peerId !== signaling.peerId));

    for (const remotePeerId of remotePeers) {
      void initiateConnection(remotePeerId);
    }

    for (const remotePeerId of peerConnections.keys()) {
      if (!remotePeers.has(remotePeerId)) {
        removePeerConnection(remotePeerId);
      }
    }
  }

  function retryMissingConnections() {
    if (disposed) return;
    for (const remotePeerId of signaling
      .getPeers()
      .filter((peerId) => peerId !== signaling.peerId)) {
      if (!hasOpenChannel(remotePeerId)) {
        void initiateConnection(remotePeerId, true);
      }
    }
  }

  const unsubscribeSignal = signaling.onSignal((from, payload) => {
    void handleSignal(from, payload);
  });

  const unsubscribePeers = signaling.onPeersChange((peers) => {
    syncPeerConnections(peers);
  });

  syncPeerConnections(signaling.getPeers());

  const retryTimer = setInterval(retryMissingConnections, CONNECTION_RETRY_MS);

  const transport: WebRTCRoomTransport = {
    send(message: unknown) {
      const payload = JSON.stringify(message);
      const channels = openDataChannels();
      if (channels.length === 0) {
        pendingOutbound.push(payload);
        return;
      }
      for (const channel of channels) {
        channel.send(payload);
      }
    },
    onMessage(handler: (message: unknown) => void) {
      messageHandlers.add(handler);
      return () => {
        messageHandlers.delete(handler);
      };
    },
    getPeers() {
      return signaling.getPeers();
    },
    onPeersChange(handler: (peers: string[]) => void) {
      return signaling.onPeersChange(handler);
    },
    dispose() {
      disposed = true;
      clearInterval(retryTimer);
      unsubscribeSignal();
      unsubscribePeers();
      for (const remotePeerId of [...peerConnections.keys()]) {
        removePeerConnection(remotePeerId);
      }
      pendingOutbound.length = 0;
      messageHandlers.clear();
      signaling.dispose();
    },
  };

  return {
    peers: [...signaling.getPeers()],
    transport,
    dispose: transport.dispose,
  };
}
