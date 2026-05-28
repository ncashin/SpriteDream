import type { SceneChannelTransport } from "./sceneChannelTransport.js";

const SCENE_CHANNEL_API = "/__gameide/scene/channel";

const inboundHandlers = new Set<(message: unknown) => void>();

let transport: SceneChannelTransport | undefined;

export function getDevSceneChannelTransport(): SceneChannelTransport {
  if (!transport) {
    transport = {
      send(message: unknown) {
        void fetch(SCENE_CHANNEL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(message),
        });
      },
      onMessage(handler: (message: unknown) => void) {
        inboundHandlers.add(handler);
        return () => {
          inboundHandlers.delete(handler);
        };
      },
    };
  }
  return transport;
}

export function receiveDevSceneChannelMessage(message: unknown): void {
  for (const handler of inboundHandlers) {
    handler(message);
  }
}
