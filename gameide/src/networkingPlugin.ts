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
  peerId?: string;
  signaling?: WebRTCSignaling;
  roomId?: string;
  iceServers?: RTCIceServer[];
  peerConnectTimeoutMilliseconds?: number;
  onRequestInitial?: () => string;
};

export const networkingPlugin =
  (options: NetworkingPluginOptions) =>
  async (input: { rootElement: HTMLElement }) => {
    const signaling =
      options.signaling ??
      createBroadcastChannelSignaling(options.roomId ?? "default");

    const peerId = options.peerId ?? createNetworkingPeerId();

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
      initialSceneBootstrap: true,
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
