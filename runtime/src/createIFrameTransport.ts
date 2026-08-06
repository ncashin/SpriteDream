import { editorStoreMessageSchema, type EditorStoreMessage } from "./editorStoreSchema";

export const createIFrameTransport = (
  targetWindow?: Window,
  options?: {
    targetOrigin?: string;
    sourceWindow?: Window;
  },
) => {
  const targetOrigin = options?.targetOrigin ?? "*";
  const sourceWindow = options?.sourceWindow ?? window;

  let currentTargetWindow = targetWindow;

  const handlers = new Set<(message: EditorStoreMessage) => void>();

  const handleMessage = (event: MessageEvent) => {
    if (currentTargetWindow && event.source !== currentTargetWindow) {
      return;
    }

    const message = editorStoreMessageSchema.parse(event.data);

    handlers.forEach((handler) => {
      handler(message);
    });
  };

  sourceWindow.addEventListener("message", handleMessage);

  return {
    setTargetWindow(window: Window) {
      currentTargetWindow = window;
    },

    sendMessage(message: EditorStoreMessage) {
      if (!currentTargetWindow) return;

      currentTargetWindow.postMessage(message, targetOrigin);
    },

    onMessage(messageHandler: (message: EditorStoreMessage) => () => void) {
      handlers.add(messageHandler);

      return () => {
        handlers.delete(messageHandler);

        if (handlers.size === 0) {
          sourceWindow.removeEventListener("message", handleMessage);
        }
      };
    },
  };
};
