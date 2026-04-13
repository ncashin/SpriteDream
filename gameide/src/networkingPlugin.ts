import { connectWebSocketRoomTransport } from "./websocketRoomTransport.js";
import { createSceneChannel } from "./scene/sceneChannel.js";
import { applyScenePatch } from "./scene/scenePatch.js";
import { getScene, setScene, onSceneChange } from "./scene/scene.js";
import type { SceneObjectData } from "./scene/scene.js";
import {
  isOwnedSceneObject,
  isOwnedSceneUpdate,
  withOwnership,
} from "./distributedSimulation.js";

export {
  SCENE_OWNER_ID,
  isOwnedSceneObject,
  isOwnedSceneUpdate,
  withOwnership,
} from "./distributedSimulation.js";

export type NetworkingPluginOptions = {
  room?: string;
  url?: string;
};


export const networkingPlugin =
  (options: NetworkingPluginOptions = {}) =>
  async (input: { rootElement: HTMLElement }) => {
    const room = options.room ?? "default";
    const {
      transport,
      initializeScene,
      dispose: disposeTransport,
    } = await connectWebSocketRoomTransport({ room, url: options.url });

    const peerId = crypto.randomUUID();
    const channel = await createSceneChannel({
      transport,
      getSceneData: getScene,
      setSceneData: setScene,
      applyScenePatch,
      subscribeToUpdates: onSceneChange,
      shouldEmitSceneUpdate: (update) => isOwnedSceneUpdate(update, peerId),
      getInitializationPayload: () => JSON.stringify(getScene()),
      initializeScene,
    });

    return {
      ...input,
      networking: {
        peerId,
        channel,
        isOwned: (obj: SceneObjectData) => isOwnedSceneObject(obj, peerId),
        withOwnership: <T extends Record<string, unknown>>(obj: T) =>
          withOwnership(obj, peerId),
        dispose() {
          channel.dispose();
          disposeTransport();
        },
      },
    };
  };
