import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  SCENE_CHANNEL,
  type SceneEditorState,
} from "./sceneChannel/sceneChannel.js";
import { getDevSceneChannelTransport } from "./sceneChannel/sceneChannelDevTransport.js";

const SCENES_API = "/__gameide/scenes";
const STORAGE_KEY = "gameide-scene-file";

function isEmbeddedInParentFrame(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

function sendSceneChannelMessage(message: {
  type: string;
  content?: unknown;
}): void {
  if (isEmbeddedInParentFrame()) {
    window.parent.postMessage(message, "*");
    return;
  }

  getDevSceneChannelTransport().send(message);
}

async function fetchSceneList(): Promise<string[]> {
  try {
    const res = await fetch(SCENES_API);
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

function pickActiveScene(
  scenes: readonly string[],
  preferred: string,
): string {
  if (preferred && scenes.includes(preferred)) return preferred;
  return scenes[0] ?? "";
}

function isSceneEditorStateMessage(
  raw: unknown,
): raw is { type: string; content?: unknown } {
  return (
    !!raw &&
    typeof raw === "object" &&
    typeof (raw as { type?: unknown }).type === "string"
  );
}

function parseSceneEditorState(content: unknown): SceneEditorState | null {
  if (!content || typeof content !== "object") return null;
  const state = content as Partial<SceneEditorState>;
  if (typeof state.path !== "string") return null;
  if (typeof state.dirty !== "boolean") return null;
  if (typeof state.saving !== "boolean") return null;
  return { path: state.path, dirty: state.dirty, saving: state.saving };
}

type SceneFileStore = {
  activeScenePath: string;
  scenes: string[];
  dirty: boolean;
  saving: boolean;
  scenesLoaded: boolean;
  setScenes: (scenes: string[]) => void;
  setActiveScenePath: (
    path: string,
    options?: { notifyHost?: boolean },
  ) => void;
  applyHostEditorState: (state: SceneEditorState) => void;
  loadScenes: () => Promise<void>;
  requestSave: () => void;
};

export const useSceneFileStore = create<SceneFileStore>()(
  persist(
    (set, get) => ({
      activeScenePath: "",
      scenes: [],
      dirty: false,
      saving: false,
      scenesLoaded: false,

      setScenes: (scenes) => {
        const activeScenePath = pickActiveScene(scenes, get().activeScenePath);
        set({ scenes, activeScenePath });
      },

      setActiveScenePath: (path, options) => {
        if (!path || path === get().activeScenePath) return;
        set({ activeScenePath: path });
        if (options?.notifyHost !== false) {
          sendSceneChannelMessage({
            type: SCENE_CHANNEL.requestSceneSwitch,
            content: path,
          });
        }
      },

      applyHostEditorState: (state) => {
        const updates: Pick<SceneFileStore, "dirty" | "saving" | "activeScenePath"> =
          {
            dirty: state.dirty,
            saving: state.saving,
            activeScenePath: get().activeScenePath,
          };

        if (state.path) {
          if (isEmbeddedInParentFrame() || !get().activeScenePath) {
            updates.activeScenePath = state.path;
          }
        }

        set(updates);
      },

      loadScenes: async () => {
        if (get().scenesLoaded) return;
        const scenes = await fetchSceneList();
        const previousPath = get().activeScenePath;
        const activeScenePath = pickActiveScene(scenes, previousPath);
        set({ scenes, activeScenePath, scenesLoaded: true });
        if (activeScenePath && activeScenePath !== previousPath) {
          sendSceneChannelMessage({
            type: SCENE_CHANNEL.requestSceneSwitch,
            content: activeScenePath,
          });
        }
      },

      requestSave: () => {
        sendSceneChannelMessage({ type: SCENE_CHANNEL.requestSceneSave });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ activeScenePath: state.activeScenePath }),
    },
  ),
);

export async function hydrateSceneFileStore(): Promise<string> {
  await useSceneFileStore.persist.rehydrate();
  return useSceneFileStore.getState().activeScenePath;
}

export function subscribeSceneFileHostState(): () => void {
  function handleHostState(raw: unknown): void {
    if (!isSceneEditorStateMessage(raw)) return;
    if (raw.type !== SCENE_CHANNEL.sceneEditorState) return;

    const state = parseSceneEditorState(raw.content);
    if (!state) return;
    useSceneFileStore.getState().applyHostEditorState(state);
  }

  function onParentMessage(event: MessageEvent): void {
    if (event.source !== window.parent) return;
    handleHostState(event.data);
  }

  window.addEventListener("message", onParentMessage);

  const unsubscribeDev = getDevSceneChannelTransport().onMessage(handleHostState);

  return () => {
    window.removeEventListener("message", onParentMessage);
    unsubscribeDev();
  };
}
