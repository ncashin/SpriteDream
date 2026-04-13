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
import { SCENE_OWNER_ID } from "./sceneOwnership.js";
import {
  electedHostPeerId,
  sortedSessionPeerIds,
  withSceneOwnershipForPeer,
} from "./distributedSimulation.js";

export { SCENE_OWNER_ID };

function isPlainSceneRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownedObjectPathFromSceneUpdate(update: SceneUpdate): PropertyKey[] | null {
  const { path: updatePath, key } = update;
  if (updatePath.length === 0) {
    if (String(key).startsWith("__")) return null;
    return [key];
  }
  if (updatePath.length >= 2) {
    return [updatePath[0], updatePath[1]];
  }
  const parentKey = updatePath[0];
  if (update.type === "set") {
    return isPlainSceneRecord(update.value) ? [parentKey, key] : [parentKey];
  }
  const deleted = update.oldValue;
  return isPlainSceneRecord(deleted) ? [parentKey, key] : [parentKey];
}

function ownerIdForNode(node: unknown, objectPath: PropertyKey[]): string {
  const object = node as { [SCENE_OWNER_ID]?: unknown } | undefined;
  const marked =
    object && typeof object === "object" ? object[SCENE_OWNER_ID] : undefined;
  const recordId = String(objectPath[objectPath.length - 1]);
  const owner = (typeof marked === "string" ? marked : undefined) ?? recordId;
  return owner;
}

export function isOwnedSceneUpdate(localPeerId: string, update: SceneUpdate): boolean {
  const objectPath = ownedObjectPathFromSceneUpdate(update);
  if (objectPath === null) return true;
  let node: unknown = getSceneValueAtPath(objectPath);
  if (
    update.type === "delete" &&
    (node === undefined || !isPlainSceneRecord(node)) &&
    isPlainSceneRecord(update.oldValue)
  ) {
    node = update.oldValue;
  }
  const owner = ownerIdForNode(node, objectPath);
  return owner === localPeerId;
}

export function isOwnedSceneObject(localPeerId: string, object: SceneObjectData): boolean {
  const path = getSceneObjectPath(object);
  const recordId =
    path !== undefined && path.length > 0 ? String(path[path.length - 1]) : "";
  const marked =
    object && typeof object === "object" ? object[SCENE_OWNER_ID] : undefined;
  const owner = (typeof marked === "string" ? marked : undefined) ?? recordId;
  return owner === localPeerId;
}

type NetworkingPluginShared = {
  peerId?: string;
  roomId?: string;
  iceServers?: RTCIceServer[];
  onRequestInitial?: () => string;
};

export type NetworkingPluginOptions =
  | (NetworkingPluginShared & { signalingURL: string; signaling?: undefined })
  | (NetworkingPluginShared & { signaling: SignalingTransport; signalingURL?: string });

export const networkingPlugin =
  (options: NetworkingPluginOptions) =>
  async (input: { rootElement: HTMLElement }) => {
    const peerId = options.peerId ?? createNetworkingPeerId();

    const roomId = options.roomId ?? "default";

    const signaling: SignalingTransport =
      "signaling" in options && options.signaling != null
        ? options.signaling
        : createHTTPRelaySignaling({
            signalingURL: options.signalingURL,
            roomId,
            peerId,
          });

    const transport = await createSceneTransportWebRTC({
      peerId,
      signaling,
      iceServers: options.iceServers,
    });
    await signaling.ready?.catch(() => {});
    const initialRoomState: SignalingRoomState | null =
      signaling.getRoomState?.() ?? null;
    const roomHasRemotePeers = (initialRoomState?.peerIds.length ?? 0) > 0;
 
    const serializeSceneForPeer =
      options.onRequestInitial ?? (() => JSON.stringify(getSceneRaw() ?? {}));

    const channel = await createSceneChannel({
      transport,
      getSceneData: getScene,
      setSceneData: setScene,
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
      shouldEmitSceneUpdate: (update) => isOwnedSceneUpdate(peerId, update),
      onRequestInitial: serializeSceneForPeer,
      awaitInitialSceneSnapshot: roomHasRemotePeers,
    });

    return {
      ...input,
      networking: {
        peerId,
        remotePeerIds: transport.remotePeerIds,
        channel,
        isOwned(object: SceneObjectData) {
          return isOwnedSceneObject(peerId, object);
        },
        withOwnership<T extends SceneObjectData>(data: T) {
          return withSceneOwnershipForPeer(peerId, data);
        },
        withOwner<T extends SceneObjectData>(simulatorPeerId: string, data: T) {
          return withSceneOwnershipForPeer(simulatorPeerId, data);
        },
        withDistributedOwnership<T extends SceneObjectData>(data: T) {
          const host =
            electedHostPeerId(
              sortedSessionPeerIds(peerId, transport.remotePeerIds),
            ) ?? peerId;
          return withSceneOwnershipForPeer(host, data);
        },
        onRemotePeersChange(handler: (remotePeerIds: readonly string[]) => void) {
          return transport.onRemotePeersChange(handler);
        },
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
