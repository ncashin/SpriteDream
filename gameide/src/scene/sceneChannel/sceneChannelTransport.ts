export interface SceneChannelTransport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
}


export interface PostMessageTransportOptions {
  target: Window;
  source?: Window;
  origin?: string;
}

export function createSceneTransportPostMessage(
  options: PostMessageTransportOptions
): SceneChannelTransport {
  const target = options.target;
  if (!window) {
    return {
      send: () => {},
      onMessage: () => () => {},
    };
  }

  const handlers = new Set<(message: unknown) => void>();

  function listener(event: MessageEvent) {
    if (options.origin && event.origin !== options.origin) return;
    if (!event.data || typeof event.data !== "object") return;
    handlers.forEach((handler) => handler(event.data));
  }

  return {
    send(message: unknown) {
      target.postMessage(message, "*");
    },
    onMessage(handler: (message: unknown) => void) {
      if (!handlers.size) window.addEventListener("message", listener);
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
        if (!handlers.size) window.removeEventListener("message", listener);
      };
    },
  };
}
