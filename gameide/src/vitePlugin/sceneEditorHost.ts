import {
  curryScene,
  createSceneChannel,
  type SceneChannelTransport,
  type SceneObject,
} from "gameide";

function createIframeSceneTransport(
  frame: HTMLIFrameElement,
): SceneChannelTransport {
  const handlers = new Set<(message: unknown) => void>();

  function listener(event: MessageEvent) {
    if (event.source !== frame.contentWindow) return;
    if (!event.data || typeof event.data !== "object") return;
    handlers.forEach((handler) => handler(event.data));
  }

  return {
    send(message: unknown) {
      frame.contentWindow?.postMessage(message, "*");
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

const RUNTIME_QUERY = "gameide-runtime";
const SCENE_API = "/__gameide/scene";
const SCENES_API = "/__gameide/scenes";

const select = document.getElementById(
  "gameide-scene-select",
) as HTMLSelectElement | null;
const saveButton = document.getElementById(
  "gameide-scene-save",
) as HTMLButtonElement | null;
const statusLabel = document.getElementById(
  "gameide-scene-status",
) as HTMLSpanElement | null;
const iframe = document.getElementById(
  "gameide-runtime-frame",
) as HTMLIFrameElement | null;

if (!select || !saveButton || !statusLabel || !iframe) {
  throw new Error("Scene editor shell markup is missing");
}

const runtimeUrl = new URL(window.location.href);
runtimeUrl.searchParams.set(RUNTIME_QUERY, "1");
iframe.src = runtimeUrl.pathname + runtimeUrl.search;

const rawScene: SceneObject = {};
const scene = curryScene(rawScene);

/** Project-relative path of the scene file currently open in the editor. */
let activeScenePath = "";
/** JSON snapshot of the last saved (or loaded-from-disk) scene for dirty checks. */
let savedSnapshot = "";
let isSaving = false;

function sceneSnapshot(): string {
  return JSON.stringify(scene.getRaw());
}

function isDirty(): boolean {
  if (!activeScenePath) return false;
  return sceneSnapshot() !== savedSnapshot;
}

function updateDocumentChrome(): void {
  const dirty = isDirty();
  statusLabel.textContent = dirty ? "Unsaved" : "Saved";
  statusLabel.dataset.dirty = dirty ? "true" : "false";
  saveButton.disabled = !dirty || !activeScenePath || isSaving;
  const titlePath = activeScenePath || "Scene Editor";
  document.title = dirty ? `${titlePath} *` : titlePath;
}

function markCleanFromDisk(data: SceneObject): void {
  savedSnapshot = JSON.stringify(data);
  updateDocumentChrome();
}

function markDirty(): void {
  updateDocumentChrome();
}

function syncSceneQueryParam(relativePath: string): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(RUNTIME_QUERY);
  if (relativePath) url.searchParams.set("scene", relativePath);
  else url.searchParams.delete("scene");
  history.replaceState(null, "", `${url.pathname}${url.search}`);
}

async function fetchSceneList(): Promise<string[]> {
  const res = await fetch(SCENES_API);
  if (!res.ok) throw new Error(`Failed to list scenes (${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.filter((entry): entry is string => typeof entry === "string");
}

function replaceScene(data: SceneObject): void {
  const snapshot = structuredClone(data ?? {});
  for (const key of Object.keys(rawScene)) {
    delete rawScene[key];
  }
  Object.assign(rawScene, snapshot);
}

async function persistActiveScene(): Promise<void> {
  const pathToSave = activeScenePath;
  if (!pathToSave) return;

  isSaving = true;
  updateDocumentChrome();

  const body = JSON.stringify(scene.getRaw(), null, 2);
  const res = await fetch(
    `${SCENE_API}?file=${encodeURIComponent(pathToSave)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
    },
  );

  isSaving = false;

  if (!res.ok) {
    updateDocumentChrome();
    throw new Error(`Failed to save scene (${res.status})`);
  }

  // Only mark clean if we are still editing the same file (no race with scene switch).
  if (activeScenePath === pathToSave) {
    savedSnapshot = sceneSnapshot();
    updateDocumentChrome();
  }
}

async function fetchSceneFile(relativePath: string): Promise<SceneObject> {
  const res = await fetch(
    `${SCENE_API}?file=${encodeURIComponent(relativePath)}`,
  );
  if (!res.ok) throw new Error(`Failed to load scene (${res.status})`);
  return (await res.json()) as SceneObject;
}

async function loadSceneFile(relativePath: string): Promise<void> {
  const data = await fetchSceneFile(relativePath);
  channel.pause();
  replaceScene(data);
  activeScenePath = relativePath;
  markCleanFromDisk(data);
  select!.value = relativePath;
  syncSceneQueryParam(relativePath);
  channel.sendSceneChange(JSON.stringify(rawScene, null, 2));
  channel.unpause();
}

function populateSceneDropdown(paths: readonly string[]): void {
  select!.replaceChildren();
  for (const file of paths) {
    const option = document.createElement("option");
    option.value = file;
    option.textContent = file;
    select!.appendChild(option);
  }
}

function confirmDiscardUnsaved(): boolean {
  if (!isDirty() || !activeScenePath) return true;
  return window.confirm(
    `Discard unsaved changes to ${activeScenePath}?`,
  );
}

const scenes = await fetchSceneList();
populateSceneDropdown(scenes);

await new Promise<void>((resolve) => {
  if (iframe.contentDocument?.readyState === "complete") {
    resolve();
    return;
  }
  iframe.addEventListener("load", () => resolve(), { once: true });
});

const channel = await createSceneChannel({
  transport: createIframeSceneTransport(iframe),
  scene,
  initializeScene: false,
});

scene.onChange(() => markDirty());

saveButton.addEventListener("click", () => {
  void persistActiveScene().catch((err) => {
    console.error("[gameide] scene save failed:", err);
  });
});

window.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    if (!saveButton.disabled) {
      void persistActiveScene().catch((err) => {
        console.error("[gameide] scene save failed:", err);
      });
    }
  }
});

select.addEventListener("change", () => {
  const next = select.value;
  if (!next || next === activeScenePath) return;

  if (!confirmDiscardUnsaved()) {
    select.value = activeScenePath;
    return;
  }

  void loadSceneFile(next).catch((err) => {
    console.error("[gameide] scene load failed:", err);
    select.value = activeScenePath;
  });
});

window.addEventListener("beforeunload", (event) => {
  if (!isDirty()) return;
  event.preventDefault();
});

const initial =
  new URL(window.location.href).searchParams.get("scene") ??
  scenes[0] ??
  "";

if (initial) {
  try {
    await loadSceneFile(initial);
  } catch (err) {
    console.error("[gameide] initial scene load failed:", err);
    updateDocumentChrome();
  }
} else {
  updateDocumentChrome();
}
