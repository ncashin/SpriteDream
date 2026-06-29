import { connectWebSocketRoomTransport } from "../../room/webSocketRoomTransport.js";
import { createSceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import type { SceneChannel } from "../../scene/sceneChannel/sceneChannel.js";
import type { GameObject, Scene, SceneObject } from "../../scene/scene.js";
import type { GameModule } from "../../lifecycle/gameModule.js";
import { onDispose } from "../../lifecycle/gameloop.js";
import {
  isOwnedSceneObject,
  withOwnership,
  OWNER_ID,
} from "./distributedSimulation.js";
import { ownerTrait } from "./ownerTrait.js";

export {
  OWNER_ID as OWNER_ID,
  isOwnedSceneObject,
  isOwnedSceneUpdate,
  withOwnership,
} from "./distributedSimulation.js";
export { ownerTrait };

export type NetworkingGameModuleOptions = {
  room?: string;
  url?: string;
};

export type NetworkingGameModuleRequiredContext = {
  rootElement: HTMLElement;
  scene: Scene;
  initialScene?: SceneObject;
};

export type NetworkingAPI = {
  peerIdentifier: string;
  getPeers: () => string[];
  onPeersChange: (handler: (peers: string[]) => void) => () => void;
  channel: SceneChannel;
  isOwned: (object: GameObject) => boolean;
  withOwnership: <T extends Record<string, unknown>>(
    object: T
  ) => T & Record<typeof OWNER_ID, string>;
};

export default function networkingGameModule(
  options: NetworkingGameModuleOptions = {},
): GameModule<NetworkingGameModuleRequiredContext, { networking: NetworkingAPI }> {
  return async (input) => {
    const room = options.room ?? "default";

    const { transport, peerIdentifier, dispose: disposeTransport } =
      await connectWebSocketRoomTransport({ room, url: options.url });

    const shouldBootstrapScene = transport.getPeers().length === 1;
    if (shouldBootstrapScene && input.initialScene !== undefined) {
      input.scene.replace(input.initialScene);
    }

    const channel = await createSceneChannel({
      transport,
      scene: input.scene,
      initializeScene: !shouldBootstrapScene,
    });

    const networking: NetworkingAPI = {
      peerIdentifier,
      getPeers: () => transport.getPeers(),
      onPeersChange: (handler: (peers: string[]) => void) =>
        transport.onPeersChange(handler),
      channel,
      isOwned: (obj: GameObject) => isOwnedSceneObject(obj, peerIdentifier),
      withOwnership: <T extends Record<string, unknown>>(obj: T) =>
        withOwnership(obj, peerIdentifier),
    };

    onDispose(() => {
      channel.dispose();
      disposeTransport();
    });

    return {
      ...input,
      networking,
    };
  };
}
