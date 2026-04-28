import { connectWebSocketRoomTransport } from "./websocketRoomTransport.js";
import { createSceneChannel } from "../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../scene/sceneChannel/sceneChannel.js";
import {
  getScene,
  getRawScene,
  setScene,
  subscribeToScene,
  applyPatch as applyScenePatch,
} from "../scene/scene.js";
import type { BaseSceneObject } from "../scene/scene.js";
import type { Plugin } from "../lifecycle/plugin.js";
import {
  isOwnedSceneObject,
  withOwnership,
  OWNER_ID,
  simulatesPhysicsForObject,
} from "./distributedSimulation.js";

export {
  OWNER_ID as OWNER_ID,
  isOwnedSceneObject,
  isOwnedSceneUpdate,
  withOwnership,
  simulatesPhysicsForObject,
} from "./distributedSimulation.js";

export type NetworkingPluginOptions = {
  room?: string;
  url?: string;
};

export type NetworkingPluginRequiredContext = {
  rootElement: HTMLElement;
  initialScene?: BaseSceneObject;
};

export type NetworkingApi = {
  peerId: string;
  getPeers: () => string[];
  onPeersChange: (handler: (peers: string[]) => void) => () => void;
  channel: SceneChannel;
  isOwned: (obj: BaseSceneObject) => boolean;
  /** True if this client runs Box2D integration for `obj` (false for other peers' owned bodies — scene-driven kinematic proxy). */
  simulatesPhysics: (obj: BaseSceneObject) => boolean;
  withOwnership: <T extends Record<string, unknown>>(
    obj: T
  ) => T & Record<typeof OWNER_ID, string>;
  dispose(): void;
};

export const networkingPlugin = (
  options: NetworkingPluginOptions = {},
): Plugin<NetworkingPluginRequiredContext, { networking: NetworkingApi }> =>
  async (input) => {
    const room = options.room ?? "default";

    const { transport, dispose: disposeTransport } =
      await connectWebSocketRoomTransport({ room, url: options.url });

    const shouldBootstrapScene = transport.getPeers().length === 1;
    if (shouldBootstrapScene && input.initialScene !== undefined) {
      setScene(input.initialScene);
    }

    const peerId = crypto.randomUUID();
    const channel = await createSceneChannel({
      transport,
      getScene,
      getRawScene,
      setScene,
      applyPatch: applyScenePatch,
      subscribeToScene,
      getInitialSceneContent: () => JSON.stringify(getScene()),
      initializeScene: !shouldBootstrapScene,
    });

    return {
      ...input,
      networking: {
        peerId,
        getPeers: () => transport.getPeers(),
        onPeersChange: (handler: (peers: string[]) => void) =>
          transport.onPeersChange(handler),
        channel,
        isOwned: (obj: BaseSceneObject) => isOwnedSceneObject(obj, peerId),
        simulatesPhysics: (obj: BaseSceneObject) =>
          simulatesPhysicsForObject(obj, peerId),
        withOwnership: <T extends Record<string, unknown>>(obj: T) =>
          withOwnership(obj, peerId),
        dispose() {
          channel.dispose();
          disposeTransport();
        },
      },
    };
  };
