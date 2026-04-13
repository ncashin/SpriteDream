import { createSceneChannel } from "./scene/sceneChannel.js";
import {
  createBroadcastChannelSignaling,
  createHTTPRelaySignaling,
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
import { getGameIDEMetadata, getGameIDESignalingURL } from "./gameideManifest.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

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
  const object = getSceneValueAtPath(objectPath) as
    | { [SCENE_OWNER_ID]?: string }
    | undefined;
  const marked =
    object && typeof object === "object" ? object[SCENE_OWNER_ID] : undefined;
  const slotId = String(objectPath[objectPath.length - 1]);
  const owner = marked ?? slotId;
  return owner === localPeerId;
}

export type NetworkingPluginOptions = {
  peerId?: string;
  signaling?: WebRTCSignaling;
  signalingURL?: string;
  roomId?: string;
  iceServers?: RTCIceServer[];
  peerConnectTimeoutMilliseconds?: number;
  onRequestInitial?: () => string;
};

export const networkingPlugin =
  (options: NetworkingPluginOptions) =>
  async (input: { rootElement: HTMLElement }) => {
    const peerId = options.peerId ?? createNetworkingPeerId();

    const roomId = options.roomId ?? "default";
    const manifestMeta = getGameIDEMetadata();
    const signalingURLFromManifest =
      options.signaling === undefined &&
      options.signalingURL === undefined &&
      manifestMeta.id
        ? getGameIDESignalingURL(manifestMeta)
        : undefined;
    const resolvedSignalingURL = options.signalingURL ?? signalingURLFromManifest;

    const signaling: WebRTCSignaling =
      options.signaling ??
      (resolvedSignalingURL
        ? createHTTPRelaySignaling({
            signalingURL: resolvedSignalingURL,
            roomId,
            peerId,
          })
        : createBroadcastChannelSignaling(roomId));

    const peerConnectTimeoutMilliseconds =
      options.peerConnectTimeoutMilliseconds != null &&
      options.peerConnectTimeoutMilliseconds > 0
        ? options.peerConnectTimeoutMilliseconds
        : undefined;

    const transport = await createSceneTransportWebRTC({
      peerId,
      signaling,
      iceServers: options.iceServers,
      peerConnectTimeoutMilliseconds,
    });
    const peerConnectionEstablished = transport.remotePeerIds.length > 0;
 
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
      skipSceneInitialization: !peerConnectionEstablished,
    });

    return {
      ...input,
      networking: {
        peerId,
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
  createHTTPRelaySignaling,
  createHTTPSSESignaling,
  createNetworkingPeerId,
  createSceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
export type {
  HTTPRelaySignalingOptions as HttpRelaySignalingOptions,
  HTTPSSESignalingOptions as HttpSseSignalingOptions,
} from "./scene/sceneChannelTransportWebRTC.js";
export type {
  WebRTCSignaling,
  WebRTCSignal,
  CreateSceneTransportWebRTCOptions,
  SceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
