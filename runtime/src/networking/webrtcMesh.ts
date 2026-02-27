/**
 * WebRTC mesh: each peer connects to every other peer using BroadcastChannel
 * for signaling (same-origin tabs). The peer with the smaller id initiates
 * the connection to avoid duplicate links.
 */

const SIGNAL_CHANNEL_NAME = "gameide-webrtc-signal";
const DATA_CHANNEL_LABEL = "scene";
/** Time to wait in "disconnected" state before treating as failed and reconnecting. */
const DISCONNECTED_RECOVERY_MS = 5000;

const logPrefix = (peerId: string) => `[mesh ${peerId.slice(0, 8)}]`;

export type SignalingMessage =
  | { type: "join"; peerId: string }
  | { type: "leave"; peerId: string }
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | {
      type: "ice";
      from: string;
      to: string;
      candidate: RTCIceCandidateInit;
    };

export type WebRTCMeshOptions = {
  channelName?: string;
};

type PeerConnection = {
  pc: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  peerId: string;
};

export function createWebRTCMesh(options?: WebRTCMeshOptions) {
  if (typeof window === "undefined" || !window.BroadcastChannel || !window.RTCPeerConnection) {
    return null;
  }

  const channelName = options?.channelName ?? SIGNAL_CHANNEL_NAME;
  const signalChannel = new BroadcastChannel(channelName);
  const peerId = crypto.randomUUID();
  const log = logPrefix(peerId);
  console.log(`${log} started, channel="${channelName}"`);
  let closed = false;
  const peers = new Map<string, PeerConnection>();
  const messageHandlers = new Set<(data: string, fromPeerId: string) => void>();
  const peerConnectedHandlers = new Set<(peerId: string, weInitiated: boolean) => void>();

  function notifyPeerConnected(connectedPeerId: string, weInitiated: boolean) {
    for (const h of peerConnectedHandlers) h(connectedPeerId, weInitiated);
  }

  /** Serialize SDP so BroadcastChannel can clone it (RTCSessionDescription is not cloneable). */
  function sdpToPlain(desc: RTCSessionDescription): RTCSessionDescriptionInit {
    return { type: desc.type, sdp: desc.sdp };
  }

  function sendSignal(msg: SignalingMessage) {
    signalChannel.postMessage(msg);
  }

  type PendingInitiator = {
    pc: RTCPeerConnection;
    dataChannel: RTCDataChannel;
    resolve: (conn: PeerConnection) => void;
    reject: (err: unknown) => void;
    iceQueue: RTCIceCandidateInit[];
  };
  const pendingInitiator = new Map<string, PendingInitiator>();
  /** Answerer's pc before ondatachannel fires; needed so we can add ICE from initiator. */
  const pendingAnswerer = new Map<string, RTCPeerConnection>();
  /** ICE candidates that arrived before we had a pc for that peer (e.g. before offer). */
  const pendingIceQueues = new Map<string, RTCIceCandidateInit[]>();
  /** Timeouts for disconnected-state recovery (peerId -> timeoutId). */
  const disconnectedTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function reannounceJoin() {
    sendSignal({ type: "join", peerId });
  }

  function clearDisconnectedTimer(remotePeerId: string) {
    const t = disconnectedTimers.get(remotePeerId);
    if (t != null) {
      clearTimeout(t);
      disconnectedTimers.delete(remotePeerId);
    }
  }

  function cleanupPeer(remotePeerId: string) {
    clearDisconnectedTimer(remotePeerId);
    const conn = peers.get(remotePeerId);
    if (conn) {
      conn.pc.close();
      peers.delete(remotePeerId);
    }
    const pending = pendingInitiator.get(remotePeerId);
    if (pending) {
      pending.pc.close();
      pending.reject(new Error("connection failed"));
      pendingInitiator.delete(remotePeerId);
    }
    const answererPc = pendingAnswerer.get(remotePeerId);
    if (answererPc) {
      answererPc.close();
      pendingAnswerer.delete(remotePeerId);
    }
    if (!closed) reannounceJoin();
  }

  function scheduleDisconnectedCleanup(remotePeerId: string, pc: RTCPeerConnection) {
    clearDisconnectedTimer(remotePeerId);
    const timeoutId = setTimeout(() => {
      disconnectedTimers.delete(remotePeerId);
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        console.log(`${log} connection ${remotePeerId.slice(0, 8)} recovery timeout (${pc.connectionState}), reconnecting`);
        cleanupPeer(remotePeerId);
      }
    }, DISCONNECTED_RECOVERY_MS);
    disconnectedTimers.set(remotePeerId, timeoutId);
  }

  async function addIceCandidateToPc(pc: RTCPeerConnection, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (_) {
      // ignore
    }
  }

  async function drainIceQueue(pc: RTCPeerConnection, queue: RTCIceCandidateInit[]): Promise<void> {
    for (const c of queue) {
      await addIceCandidateToPc(pc, c);
    }
  }

  function createConnection(remotePeerId: string, isInitiator: boolean): Promise<PeerConnection> {
    return new Promise((resolve, reject) => {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      function setupDataChannel(dc: RTCDataChannel) {
        dc.onmessage = (e) => {
          const data = typeof e.data === "string" ? e.data : "";
          for (const h of messageHandlers) h(data, remotePeerId);
        };
        dc.onopen = () => {
          console.log(`${log} data channel open → ${remotePeerId.slice(0, 8)}`);
          const conn: PeerConnection = { pc, dataChannel: dc, peerId: remotePeerId };
          peers.set(remotePeerId, conn);
          notifyPeerConnected(remotePeerId, isInitiator);
          resolve(conn);
        };
        if (dc.readyState === "open") {
          const conn: PeerConnection = { pc, dataChannel: dc, peerId: remotePeerId };
          peers.set(remotePeerId, conn);
          notifyPeerConnected(remotePeerId, isInitiator);
          resolve(conn);
        }
      }

      if (isInitiator) {
        const dc = pc.createDataChannel(DATA_CHANNEL_LABEL);
        setupDataChannel(dc);
        pendingInitiator.set(remotePeerId, { pc, dataChannel: dc, resolve, reject, iceQueue: [] });
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            sendSignal({
              type: "offer",
              from: peerId,
              to: remotePeerId,
              sdp: sdpToPlain(pc.localDescription!),
            });
          })
          .catch((err) => {
            pendingInitiator.delete(remotePeerId);
            pc.close();
            reject(err);
          });
      } else {
        pc.ondatachannel = (e) => {
          if (e.channel.label === DATA_CHANNEL_LABEL) {
            setupDataChannel(e.channel);
          }
        };
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ type: "ice", from: peerId, to: remotePeerId, candidate: e.candidate.toJSON() });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log(`${log} connection ${remotePeerId.slice(0, 8)} state=${pc.connectionState}`);
        const state = pc.connectionState;
        if (state === "disconnected") {
          scheduleDisconnectedCleanup(remotePeerId, pc);
        } else if (state === "connected" || state === "connecting") {
          clearDisconnectedTimer(remotePeerId);
        } else if (state === "failed" || state === "closed") {
          console.log(`${log} connection ${remotePeerId.slice(0, 8)} ${state}, reconnecting`);
          cleanupPeer(remotePeerId);
        }
      };
    });
  }

  signalChannel.onmessage = async (event: MessageEvent<SignalingMessage>) => {
    const msg = event.data;
    if (!msg || typeof msg !== "object" || msg.type === undefined) return;
    if ("peerId" in msg && msg.peerId === peerId) return;
    if ("to" in msg && msg.to !== peerId) return;

    if (msg.type === "join") {
      const otherId = msg.peerId;
      if (otherId === peerId) return;
      if (peers.has(otherId)) return;
      // Already initiating to this peer; avoid duplicate connection (would overwrite pendingInitiator and cause setRemoteDescription(answer) in wrong state).
      if (pendingInitiator.has(otherId)) return;
      console.log(`${log} join from ${otherId.slice(0, 8)} (myId ${peerId < otherId ? "<" : ">"} other)`);
      // So the other peer can discover us (they may have joined after we announced), re-announce.
      sendSignal({ type: "join", peerId });
      if (peerId < otherId) {
        createConnection(otherId, true).catch((err) => console.warn(`${log} createConnection failed`, err));
      }
      return;
    }

    if (msg.type === "leave") {
      console.log(`${log} leave ${msg.peerId.slice(0, 8)}`);
      const conn = peers.get(msg.peerId);
      if (conn) {
        conn.pc.close();
        peers.delete(msg.peerId);
      }
      return;
    }

    if (msg.type === "offer") {
      const from = msg.from;
      console.log(`${log} offer from ${from.slice(0, 8)}`);
      if (peers.has(from)) return;
      const existing = pendingAnswerer.get(from);
      if (existing) {
        existing.close();
        pendingAnswerer.delete(from);
      }
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pendingAnswerer.set(from, pc);
      pc.ondatachannel = (e) => {
        if (e.channel.label !== DATA_CHANNEL_LABEL) return;
        pendingAnswerer.delete(from);
        const dc = e.channel;
        dc.onmessage = (ev) => {
          const data = typeof ev.data === "string" ? ev.data : "";
          for (const h of messageHandlers) h(data, from);
        };
        const conn: PeerConnection = { pc, dataChannel: dc, peerId: from };
        peers.set(from, conn);
        notifyPeerConnected(from, false);
      };
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendSignal({ type: "ice", from: peerId, to: from, candidate: e.candidate.toJSON() });
        }
      };
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === "disconnected") {
          scheduleDisconnectedCleanup(from, pc);
        } else if (state === "connected" || state === "connecting") {
          clearDisconnectedTimer(from);
        } else if (state === "failed" || state === "closed") {
          console.log(`${log} connection ${from.slice(0, 8)} ${state}, reconnecting`);
          cleanupPeer(from);
        }
      };
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const queued = pendingIceQueues.get(from);
        if (queued) {
          pendingIceQueues.delete(from);
          await drainIceQueue(pc, queued);
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal({ type: "answer", from: peerId, to: from, sdp: sdpToPlain(pc.localDescription!) });
      } catch (err) {
        console.warn(`${log} offer handling failed`, err);
        pc.close();
        pendingAnswerer.delete(from);
      }
      return;
    }

    if (msg.type === "answer") {
      console.log(`${log} answer from ${msg.from.slice(0, 8)}`);
      const pending = pendingInitiator.get(msg.from);
      if (pending) {
        pendingInitiator.delete(msg.from);
        try {
          await pending.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
          await drainIceQueue(pending.pc, pending.iceQueue);
          const conn: PeerConnection = { pc: pending.pc, dataChannel: pending.dataChannel, peerId: msg.from };
          peers.set(msg.from, conn);
          pending.resolve(conn);
        } catch (err) {
          console.warn(`${log} answer handling failed`, err);
          pending.pc.close();
          pending.reject(err);
        }
      }
      return;
    }

    if (msg.type === "ice") {
      const conn = peers.get(msg.from);
      if (conn) {
        await addIceCandidateToPc(conn.pc, msg.candidate);
        return;
      }
      const answererPc = pendingAnswerer.get(msg.from);
      if (answererPc) {
        await addIceCandidateToPc(answererPc, msg.candidate);
        return;
      }
      const pending = pendingInitiator.get(msg.from);
      if (pending) {
        pending.iceQueue.push(msg.candidate);
        if (pending.pc.remoteDescription) {
          await drainIceQueue(pending.pc, pending.iceQueue);
          pending.iceQueue.length = 0;
        }
        return;
      }
      let queue = pendingIceQueues.get(msg.from);
      if (!queue) {
        queue = [];
        pendingIceQueues.set(msg.from, queue);
      }
      queue.push(msg.candidate);
      return;
    }
  };

  console.log(`${log} announcing join`);
  sendSignal({ type: "join", peerId });

  return {
    peerId,
    getPeerCount(): number {
      return peers.size;
    },
    sendTo(peerId: string, data: string): void {
      const conn = peers.get(peerId);
      if (conn?.dataChannel.readyState === "open") {
        conn.dataChannel.send(data);
      }
    },
    sendToAll(data: string): void {
      let n = 0;
      for (const conn of peers.values()) {
        if (conn.dataChannel.readyState === "open") {
          conn.dataChannel.send(data);
          n++;
        }
      }
      if (n > 0) console.log(`${log} sent to ${n} peer(s), ${data.length} bytes`);
    },
    onPeerConnected(handler: (peerId: string, weInitiated: boolean) => void): () => void {
      peerConnectedHandlers.add(handler);
      return () => peerConnectedHandlers.delete(handler);
    },
    onMessage(handler: (data: string, fromPeerId: string) => void): () => void {
      messageHandlers.add(handler);
      return () => messageHandlers.delete(handler);
    },
    close(): void {
      console.log(`${log} closing`);
      closed = true;
      for (const t of disconnectedTimers.values()) clearTimeout(t);
      disconnectedTimers.clear();
      sendSignal({ type: "leave", peerId });
      for (const conn of peers.values()) {
        conn.pc.close();
      }
      peers.clear();
      pendingInitiator.forEach(({ pc }) => pc.close());
      pendingInitiator.clear();
      pendingAnswerer.forEach((pc) => pc.close());
      pendingAnswerer.clear();
      pendingIceQueues.clear();
      signalChannel.close();
    },
  };
}

export type WebRTCMesh = NonNullable<ReturnType<typeof createWebRTCMesh>>;
