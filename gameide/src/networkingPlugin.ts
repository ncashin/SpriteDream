import { createSceneChannel } from "./scene/sceneChannel.js";
import {
  createHTTPRelaySignaling,
  type SignalingRoomState,
  type SignalingTransport,
} from "./scene/signaling.js";
import {
  createNetworkingPeerId,
  createSceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
import { applyScenePatch } from "./scene/scenePatch.js";
import {
  getScene,
  getSceneRaw,
  getSceneObjectPath,
  getSceneValueAtPath,
  setScene,
  onSceneChange,
} from "./scene/scene.js";
import type { SceneObjectData, SceneUpdate } from "./scene/scene.js";
import {
  electedHostPeerId,
  sortedSessionPeerIds,
  withSceneOwnershipForPeer,
} from "./distributedSimulation.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

export const networkingPlugin =
  (options: { room: string; url: string }) =>
  async (input: { rootElement: HTMLElement }) => {
    const { room, url } = options;

    const channel = await createSceneChannel({
      transport,
      getSceneData: getScene,
      setSceneData: setScene,
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
      getInitializationPayload: serializeSceneForPeer,
      initializeScene: roomHasRemotePeers,
    });

    return {
      ...input,
      networking: {
        channel,
        dispose() {
          channel.dispose();
          transport.dispose();
        },
      },
    };
  };

export {
  createHTTPRelaySignaling,
  createHTTPSSESignaling,
  createSignalingChannel,
  isWebRtcSignal,
  WEBRTC_SIGNALING,
} from "./scene/signaling.js";
export {
  createNetworkingPeerId,
  createSceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
export type {
  CreateSignalingChannelOptions,
  HTTPRelaySignalingOptions,
  HTTPRelaySignalingOptions as HttpRelaySignalingOptions,
  HTTPSSESignalingOptions,
  HTTPSSESignalingOptions as HttpSseSignalingOptions,
  SignalingChannel,
  SignalingRoomState,
  SignalingTransport,
  WebRTCSignal,
  WebRTCSignaling,
} from "./scene/signaling.js";
export type {
  CreateSceneTransportWebRTCOptions,
  SceneTransportWebRTC,
} from "./scene/sceneChannelTransportWebRTC.js";
