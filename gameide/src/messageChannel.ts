export interface MessageTransport {
  send(message: unknown): void;
  onMessage(handler: (message: unknown) => void): () => void;
}

export interface PostMessageTransportOptions {
  target: Window;
  source?: Window;
  origin?: string;
}

export function createPostMessageTransport(
  options: PostMessageTransportOptions
): MessageTransport {
  const { target, source = typeof window !== "undefined" ? window : undefined, origin } = options;
  const win = source ?? (typeof globalThis !== "undefined" ? (globalThis as unknown as Window) : undefined);

  if (!win) {
    return {
      send: () => {},
      onMessage: () => () => {},
    };
  }

  const handlers = new Set<(message: unknown) => void>();

  const listener = (event: MessageEvent): void => {
    if (origin != null && event.origin !== origin) return;
    const msg = event.data;
    if (msg == null || typeof msg !== "object") return;
    for (const h of handlers) h(msg);
  };

  return {
    send(message: unknown) {
      target.postMessage(message, "*");
    },
    onMessage(handler: (message: unknown) => void) {
      if (handlers.size === 0) win.addEventListener("message", listener);
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
        if (handlers.size === 0) win.removeEventListener("message", listener);
      };
    },
  };
}
