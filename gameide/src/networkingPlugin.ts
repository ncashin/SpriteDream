import { connectWebSocketRoomTransport } from "./websocketRoomTransport.js";
import { createSceneChannel } from "./scene/sceneChannel.js";
import { applyScenePatch } from "./scene/scenePatch.js";
import {
  getScene,
  setScene,
  onSceneChange,
} from "./scene/scene.js";
import type { SceneObjectData, SceneUpdate } from "./scene/scene.js";

export const SCENE_OWNER_ID = "__ownerId" as const;

export type NetworkingPluginOptions = {
  room?: string;
  url?: string;
};

function createPeerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `peer-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export const networkingPlugin =
  (options: NetworkingPluginOptions = {}) =>
  async (input: { rootElement: HTMLElement }) => {
    const room = options.room ?? "default";
    const { transport, initializeScene, dispose: disposeTransport } =
      await connectWebSocketRoomTransport({ room, url: options.url });

    const peerId = createPeerId();

    const channel = await createSceneChannel({
      transport,
      getSceneData: getScene,
      setSceneData: setScene,
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
      getInitializationPayload: () => JSON.stringify(getScene()),
      initializeScene,
    });

    function isOwned(obj: SceneObjectData): boolean {
      return (obj as Record<string, unknown>)[SCENE_OWNER_ID] === peerId;
    }

    function withOwnership<T extends Record<string, unknown>>(obj: T): T & Record<typeof SCENE_OWNER_ID, string> {
      return { ...obj, [SCENE_OWNER_ID]: peerId };
    }

    return {
      ...input,
      networking: {
        peerId,
        channel,
        isOwned,
        withOwnership,
        dispose() {
          channel.dispose();
          disposeTransport();
        },
      },
    };
  };

export function isOwnedSceneObject(
  obj: SceneObjectData,
  peerId: string,
): boolean {
  return (obj as Record<string, unknown>)[SCENE_OWNER_ID] === peerId;
}

export function isOwnedSceneUpdate(update: SceneUpdate, peerId: string): boolean {
  if (String(update.key) === peerId) return true;
  if (update.path.length > 0 && String(update.path[0]) === peerId) return true;
  return false;
}
