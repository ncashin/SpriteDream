import { createSceneChannel } from "./scene/sceneChannel.js";
import {
  createBroadcastChannelSignaling,
  createNetworkingPeerId,
  createSceneTransportWebRTC,
  type WebRTCSignaling,
} from "./scene/sceneChannelTransportWebRTC.js";
import { applyScenePatch } from "./scene/scenePatch.js";
import {
  getScene,
  getSceneRaw,
  getSceneValueAtPath,
  setScene,
  onSceneChange,
} from "./scene/scene.js";
import type { SceneUpdate } from "./scene/scene.js";

/** Set on networked objects so outgoing patches skip remote-owned subtrees. */
export const SCENE_OWNER_ID = "__ownerId" as const;

/**
 * Path to the object that carries {@link SCENE_OWNER_ID} for this update, or null if the
 * update is not under an owner-filtered subtree (emit as before).
 */
function objectPathForOwnerCheck(update: SceneUpdate): PropertyKey[] | null {
  const updatePath = update.path;
  if (updatePath.length === 0) return null;
  const rootKey = updatePath[0];
  if (rootKey === "players") {
    if (updatePath.length >= 2) return ["players", updatePath[1]];
    return ["players", update.key];
  }
  return null;
}

function shouldEmitSceneUpdateForNetworking(
  update: SceneUpdate,
  localPeerId: string,
): boolean {
  const objectPath = objectPathForOwnerCheck(update);
  if (objectPath === null) return true;
  const obj = getSceneValueAtPath(objectPath) as
    | { [SCENE_OWNER_ID]?: string }
    | undefined;
  const marked =
    obj && typeof obj === "object" ? obj[SCENE_OWNER_ID] : undefined;
  const slotId = String(objectPath[objectPath.length - 1]);
  const owner = marked ?? slotId;
  return owner === localPeerId;
}

export type NetworkingPluginOptions = {
  /**
   * Stable id for this tab; defaults to a random value. Two peers compare ids to decide who sends the WebRTC offer.
   */
  peerId?: string;
  /**
   * Signaling channel for SDP and ICE. Defaults to {@link createBroadcastChannelSignaling}
   * with `roomId` (or `"default"`).
   */
  signaling?: WebRTCSignaling;
  /** Used with the default BroadcastChannel signaling (default `"default"`). */
  roomId?: string;
  iceServers?: RTCIceServer[];
  /**
   * If set to a positive number, plugin init resolves after this many milliseconds even when no peer has connected yet
   * (scene runs locally; WebRTC keeps listening). Omit or pass `0` to block until a peer’s data channel is open.
   */
  peerConnectTimeoutMs?: number;
  /**
   * When a remote peer sends `requestInitialScene` over the WebRTC data channel, this
   * serializes the full local scene to send back. Defaults to
   * `JSON.stringify(getSceneRaw() ?? {})`.
   */
  onRequestInitial?: () => string;
};

/**
 * Syncs the scene with a remote peer over WebRTC using {@link createSceneChannel}.
 * Peers are symmetric: no host/guest — the smaller `peerId` (lexicographic) creates the data channel and offer.
 *
 * With default {@link createBroadcastChannelSignaling}, open two same-origin tabs with the same `roomId`.
 */
export const networkingPlugin =
  (options: NetworkingPluginOptions) =>
  async (input: { rootElement: HTMLElement }) => {
    const signaling =
      options.signaling ??
      createBroadcastChannelSignaling(options.roomId ?? "default");

    const peerId = options.peerId ?? createNetworkingPeerId();

    const peerConnectTimeoutMs =
      options.peerConnectTimeoutMs != null && options.peerConnectTimeoutMs > 0
        ? options.peerConnectTimeoutMs
        : undefined;

    const transport = await createSceneTransportWebRTC({
      peerId,
      signaling,
      iceServers: options.iceServers,
      peerConnectTimeoutMilliseconds: peerConnectTimeoutMs,
    });

    const serializeSceneForPeer =
      options.onRequestInitial ?? (() => JSON.stringify(getSceneRaw() ?? {}));

    const channel = await createSceneChannel({
      transport,
      getSceneData: getScene,
      setSceneData: setScene,
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
      shouldEmitSceneUpdate: (update) =>
        shouldEmitSceneUpdateForNetworking(update, peerId),
      onRequestInitial: serializeSceneForPeer,
    });

    return {
      ...input,
      networking: {
        peerId,
        remotePeerId: transport.remotePeerId,
        remotePeerIds: transport.remotePeerIds,
        channel,
        dispose() {
          channel.dispose();
          transport.dispose();
        },
      },
    };
  };

export {
  createBroadcastChannelSignaling,
  createNetworkingPeerId,
  createSceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
export type {
  WebRTCSignaling,
  WebRTCSignal,
  CreateSceneTransportWebRTCOptions,
  SceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
