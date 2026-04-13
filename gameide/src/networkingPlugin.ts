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
  getSceneObjectPath,
  getSceneValueAtPath,
  setScene,
  onSceneChange,
} from "./scene/scene.js";
import type { SceneObjectData, SceneUpdate } from "./scene/scene.js";
import { getGameIDEMetadata, getGameIDESignalingURL } from "./gameideManifest.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

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

function isSceneUpdatePayload(x: unknown): x is SceneUpdate {
  if (typeof x !== "object" || x === null) return false;
  const u = x as { type?: unknown; path?: unknown };
  if (u.type !== "set" && u.type !== "delete") return false;
  return Array.isArray(u.path);
}

function ownerIdForNode(node: unknown, objectPath: PropertyKey[]): string {
  const object = node as { [SCENE_OWNER_ID]?: unknown } | undefined;
  const marked =
    object && typeof object === "object" ? object[SCENE_OWNER_ID] : undefined;
  const recordId = String(objectPath[objectPath.length - 1]);
  const owner = (typeof marked === "string" ? marked : undefined) ?? recordId;
  return owner;
}

function isOwnedSceneUpdate(localPeerId: string, update: SceneUpdate): boolean {
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

function isOwnedSceneObject(localPeerId: string, object: SceneObjectData): boolean {
  const path = getSceneObjectPath(object);
  const recordId =
    path !== undefined && path.length > 0 ? String(path[path.length - 1]) : "";
  const marked =
    object && typeof object === "object" ? object[SCENE_OWNER_ID] : undefined;
  const owner = (typeof marked === "string" ? marked : undefined) ?? recordId;
  return owner === localPeerId;
}

export function isOwned(localPeerId: string, update: SceneUpdate): boolean;
export function isOwned(localPeerId: string, object: SceneObjectData): boolean;
export function isOwned(
  localPeerId: string,
  updateOrObject: SceneUpdate | SceneObjectData,
): boolean {
  return isSceneUpdatePayload(updateOrObject)
    ? isOwnedSceneUpdate(localPeerId, updateOrObject)
    : isOwnedSceneObject(localPeerId, updateOrObject as SceneObjectData);
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
      shouldEmitSceneUpdate: (update) => isOwned(peerId, update),
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
