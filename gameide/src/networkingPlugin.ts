import { connectWebSocketRoomTransport } from "./websocketRoomTransport.js";
import { createSceneChannel } from "./scene/sceneChannel.js";
import {
  getScene,
  setScene,
  onSceneUpdate,
  applyScenePatchToRootTarget,
} from "./scene/scene.js";
import type { SceneObjectData } from "./scene/scene.js";
import { isOwnedSceneObject, withOwnership } from "./distributedSimulation.js";

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
  async (input: { rootElement: HTMLElement; initialScene: SceneObjectData }) => {
    const room = options.room ?? "default";
    
    const { transport, dispose: disposeTransport } =
      await connectWebSocketRoomTransport({ room, url: options.url });

    const shouldBootstrapScene = transport.getPeers().length === 1;
    if (shouldBootstrapScene) {
      setScene(input.initialScene);
    }

    const peerId = crypto.randomUUID();
    const channel = await createSceneChannel({
      transport,
      getScene,
      setScene,
      applyScenePatch: (_scene, patch) => applyScenePatchToRootTarget(patch),
      onSceneUpdate,
      getInitialSceneContent: () => JSON.stringify(getScene()),
      initializeScene: !shouldBootstrapScene,
    });

    return {
      ...input,
      networking: {
        peerId,
        get peers() {
          return transport.getPeers();
        },
        onPeersChange: (handler: (peers: string[]) => void) =>
          transport.onPeersChange(handler),
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
