import { applyPatch, getScene } from "../scene/scene";

const JSON_PATCH_MESSAGE = "gameide-json-patch";

let applyingRemotePatch = false;

export type SyncIFrameSceneOptions = {
  targetWindow: Window | null;
  origin?: string;
  sendInitialState?: boolean;
  onPatchApplied?: () => void;
};

function sendJSONPatch(
  targetWindow: Window,
  payload: Record<string, unknown>,
  origin: string
): void {
  try {
    const serializable = JSON.parse(
      JSON.stringify(payload)
    ) as Record<string, unknown>;
    targetWindow.postMessage(
      { type: JSON_PATCH_MESSAGE, payload: serializable },
      origin
    );
  } catch (_) {}
}

export function syncIFrameScene({
  targetWindow,
  origin = "*",
  sendInitialState = false,
  onPatchApplied,
}: SyncIFrameSceneOptions): () => void {
  if (!targetWindow) return () => {};

  const scene = getScene();
  const unsubScene = scene.subscribe(() => {
    if (applyingRemotePatch) return;
    try {
      const plain = JSON.parse(
        JSON.stringify(getScene() as Record<string, unknown>)
      ) as Record<string, unknown>;
      sendJSONPatch(targetWindow, plain, origin);
    } catch (_) {}
  });

  const handleMessage = (event: MessageEvent) => {
    if (event.source !== targetWindow) return;
    if (origin !== "*" && event.origin !== origin) return;
    const data = event.data;
    if (!data || data.type !== JSON_PATCH_MESSAGE) return;

    const payload = data.payload;
    if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
      return;
    }

    try {
      applyingRemotePatch = true;
      applyPatch(getScene(), payload as Record<string, unknown>);
      onPatchApplied?.();
    } catch (_) {
    } finally {
      applyingRemotePatch = false;
    }
  };

  window.addEventListener("message", handleMessage);

  let initialSendTimeout: ReturnType<typeof setTimeout> | undefined;
  if (sendInitialState) {
    const sendInitial = () => {
      try {
        const plain = JSON.parse(
          JSON.stringify(getScene() as Record<string, unknown>)
        ) as Record<string, unknown>;
        sendJSONPatch(targetWindow, plain, origin);
      } catch (_) {}
    };
    sendInitial();
    initialSendTimeout = setTimeout(sendInitial, 150);
  }

  return () => {
    if (initialSendTimeout != null) clearTimeout(initialSendTimeout);
    unsubScene();
    window.removeEventListener("message", handleMessage);
  };
}
