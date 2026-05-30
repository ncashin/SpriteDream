import fs from "node:fs";
import path from "node:path";
import type { ViteDevServer } from "vite";
import {
  SCENE_CHANNEL,
  type SceneChannelMessage,
  type SceneEditorState,
} from "../scene/sceneChannel/sceneChannel.js";
import {
  curryScene,
  stripScenePatchSentinels,
  type Scene,
  type SceneObject,
} from "../scene/scene.js";
import { listProjectScenes } from "./projectCatalog";
import { invalidateCatalogModules } from "./virtualCatalog";

export const SCENE_CHANNEL_HOT_EVENT = "gameide:scene-channel";

const SCENE_FILE_DEBOUNCE_MS = 150;

function toPosixRelative(base: string, absolutePath: string): string {
  return path.relative(base, absolutePath).split(path.sep).join("/");
}

function isSafeSceneRelativePath(
  projectRoot: string,
  relativePath: string,
): boolean {
  if (!relativePath.endsWith(".scene")) return false;
  const normalized = path.normalize(relativePath);
  if (path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`)) {
    return false;
  }
  const absolute = path.join(projectRoot, normalized);
  const rel = path.relative(projectRoot, absolute);
  return rel !== "" && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel);
}

function resolveSceneAbsolutePath(
  projectRoot: string,
  relativePath: string,
): string | null {
  if (!isSafeSceneRelativePath(projectRoot, relativePath)) return null;
  return path.join(projectRoot, path.normalize(relativePath));
}

function readSceneFile(absolutePath: string): SceneObject {
  const raw = fs.readFileSync(absolutePath, "utf8");
  return stripScenePatchSentinels(JSON.parse(raw) as SceneObject);
}

function writeSceneFile(absolutePath: string, data: SceneObject): void {
  fs.writeFileSync(absolutePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function sceneSnapshot(data: SceneObject): string {
  return JSON.stringify(data);
}

class DevSceneDocument {
  private readonly rawScene: SceneObject;
  private savedSnapshot: string;
  readonly scene: Scene;

  constructor(initialData: SceneObject) {
    this.rawScene = structuredClone(initialData ?? {});
    this.savedSnapshot = sceneSnapshot(this.rawScene);
    this.scene = curryScene(this.rawScene);
  }

  getData(): SceneObject {
    return structuredClone(stripScenePatchSentinels(this.rawScene));
  }

  replace(data: SceneObject): void {
    this.scene.replace(data);
    this.savedSnapshot = sceneSnapshot(this.rawScene);
  }

  revertFromDisk(data: SceneObject): void {
    this.scene.replace(data);
    this.savedSnapshot = sceneSnapshot(this.rawScene);
  }

  applyPatch(patch: SceneObject): void {
    this.scene.applyPatch(patch);
  }

  markSaved(): void {
    this.savedSnapshot = sceneSnapshot(this.rawScene);
  }

  isDirty(): boolean {
    return sceneSnapshot(this.rawScene) !== this.savedSnapshot;
  }
}

export class DevSceneChannelHost {
  private readonly projectRoot: string;
  private readonly server: ViteDevServer;
  private activePath = "";
  private document = new DevSceneDocument({});
  private saving = false;
  private readonly pendingReloads = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(server: ViteDevServer, projectRoot: string) {
    this.server = server;
    this.projectRoot = projectRoot;
  }

  attachFileWatcher(): void {
    const trackScene = (file: string): void => {
      if (path.normalize(file).endsWith(".scene")) {
        this.server.watcher.add(file);
      }
    };

    for (const relativePath of listProjectScenes(this.projectRoot)) {
      trackScene(path.join(this.projectRoot, relativePath));
    }

    const onSceneFileEvent = (file: string): void => {
      trackScene(file);
      invalidateCatalogModules(this.server);
      this.scheduleReloadFromDisk(file);
    };

    this.server.watcher.on("add", onSceneFileEvent);
    this.server.watcher.on("change", onSceneFileEvent);
  }

  handleMessage(raw: unknown): void {
    if (!raw || typeof raw !== "object" || typeof (raw as { type?: unknown }).type !== "string") {
      return;
    }

    const message = raw as SceneChannelMessage;
    switch (message.type) {
      case SCENE_CHANNEL.requestInitialScene:
        void this.handleRequestInitialScene(
          typeof message.content === "string" ? message.content : undefined,
        );
        return;
      case SCENE_CHANNEL.scenePatch:
        if (!this.activePath || typeof message.content !== "object") return;
        this.document.applyPatch(message.content);
        this.broadcastEditorState();
        return;
      case SCENE_CHANNEL.requestSceneSave:
        void this.handleSave();
        return;
      case SCENE_CHANNEL.requestSceneSwitch:
        if (typeof message.content !== "string" || !message.content) return;
        void this.switchScene(message.content);
        return;
    }
  }

  private async handleRequestInitialScene(preferredPath?: string): Promise<void> {
    if (!this.activePath) {
      const scenes = listProjectScenes(this.projectRoot);
      const initial = preferredPath && scenes.includes(preferredPath)
        ? preferredPath
        : scenes[0] ?? "";
      if (initial) {
        await this.loadScene(initial, { sendInitialScene: true });
        return;
      }
    }

    this.broadcast({
      type: SCENE_CHANNEL.initialScene,
      content: this.document.getData(),
    });
    this.broadcastEditorState();
  }

  private async handleSave(): Promise<void> {
    if (!this.activePath || this.saving || !this.document.isDirty()) return;

    const absolute = resolveSceneAbsolutePath(this.projectRoot, this.activePath);
    if (!absolute) return;

    this.saving = true;
    this.broadcastEditorState();
    try {
      writeSceneFile(absolute, this.document.getData());
      this.document.markSaved();
    } finally {
      this.saving = false;
      this.broadcastEditorState();
    }
  }

  private async switchScene(relativePath: string): Promise<void> {
    if (!relativePath || relativePath === this.activePath) return;
    await this.loadScene(relativePath, { sendSceneChange: true });
  }

  private async loadScene(
    relativePath: string,
    options: { sendInitialScene?: boolean; sendSceneChange?: boolean } = {},
  ): Promise<void> {
    const absolute = resolveSceneAbsolutePath(this.projectRoot, relativePath);
    if (!absolute) return;

    try {
      const data = readSceneFile(absolute);
      this.activePath = relativePath;
      this.document.replace(data);

      if (options.sendInitialScene) {
        this.broadcast({
          type: SCENE_CHANNEL.initialScene,
          content: this.document.getData(),
        });
      } else if (options.sendSceneChange) {
        this.broadcast({
          type: SCENE_CHANNEL.sceneChange,
          content: this.document.getData(),
        });
      }

      this.broadcastEditorState();
    } catch {
      // Ignore unreadable scenes.
    }
  }

  private scheduleReloadFromDisk(absolutePath: string): void {
    const normalized = path.normalize(absolutePath);
    if (!normalized.endsWith(".scene")) return;

    const relativePath = toPosixRelative(this.projectRoot, normalized);
    if (!this.activePath || relativePath !== this.activePath) return;

    const existing = this.pendingReloads.get(relativePath);
    if (existing) clearTimeout(existing);

    this.pendingReloads.set(
      relativePath,
      setTimeout(() => {
        this.pendingReloads.delete(relativePath);
        void this.reloadActiveSceneFromDisk(normalized);
      }, SCENE_FILE_DEBOUNCE_MS),
    );
  }

  private async reloadActiveSceneFromDisk(absolutePath: string): Promise<void> {
    if (!this.activePath || this.saving) return;

    try {
      const data = readSceneFile(absolutePath);
      this.document.revertFromDisk(data);
      this.broadcast({
        type: SCENE_CHANNEL.sceneChange,
        content: this.document.getData(),
      });
      this.broadcastEditorState();
    } catch {
      // Ignore unreadable scenes.
    }
  }

  private broadcastEditorState(): void {
    const state: SceneEditorState = {
      path: this.activePath,
      dirty: this.document.isDirty(),
      saving: this.saving,
    };
    this.broadcast({
      type: SCENE_CHANNEL.sceneEditorState,
      content: state,
    });
  }

  private broadcast(message: SceneChannelMessage): void {
    this.server.ws.send({
      type: "custom",
      event: SCENE_CHANNEL_HOT_EVENT,
      data: message,
    });
  }
}

export function attachDevSceneChannelHost(
  server: ViteDevServer,
  projectRoot: string,
): DevSceneChannelHost {
  const host = new DevSceneChannelHost(server, projectRoot);
  host.attachFileWatcher();
  return host;
}
