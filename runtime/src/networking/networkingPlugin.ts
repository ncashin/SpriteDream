import type { GameContext, Plugin } from "../runtime/plugin";
import { defineObject } from "../scene/objectDefinition";
import { applyPatch, getScene } from "../scene/scene";
import { createWebRTCMesh } from "./webrtcMesh";

/** Objects with __networked and __ownerId are synced; only the owner peer sends their patches. */
export const NetworkedObjectDefinition = defineObject({
  __networked: true,
  __ownerId: (v: unknown) => typeof v === "string",
});

let applyingRemotePatch = false;

export type NetworkingPluginOptions = {
  /** BroadcastChannel name for WebRTC signaling (default: "gameide-webrtc-signal") */
  channelName?: string;
};

export type NetworkingContext = GameContext & {
  networking: {
    getPeerCount: () => number;
    peerId: string;
    close: () => void;
  } | null;
};

/** Patch op: set a value at path or remove the key at path. */
export type ScenePatchOp =
  | { op: "set"; path: string; value: unknown }
  | { op: "remove"; path: string };

/** Message: full scene snapshot (e.g. on connect). */
type FullSceneMessage = { _full: true; data: Record<string, unknown> };

/** Message: incremental patch as one object — path → value for sets, optional removes list. */
type PatchMessage = { _patch: true; data: Record<string, unknown>; removes?: string[] };

function getParentAndKey(
  scene: Record<string, unknown>,
  path: string
): [Record<string, unknown> | null, string] {
  const parts = path.split(".");
  if (parts.length === 0) return [null, ""];
  if (parts.length === 1) return [scene, parts[0]];
  let obj: Record<string, unknown> = scene;
  for (let i = 0; i < parts.length - 1; i++) {
    const next = obj[parts[i]];
    if (next == null || typeof next !== "object" || Array.isArray(next)) return [null, parts[parts.length - 1]];
    obj = next as Record<string, unknown>;
  }
  return [obj, parts[parts.length - 1]];
}

function deleteByPath(scene: Record<string, unknown>, path: string): void {
  const [parent, key] = getParentAndKey(scene, path);
  if (parent && key in parent) delete parent[key];
}

/** Build nested map by root key (first path segment) for one applyPatch per object. */
function applyPatchPayload(
  scene: Record<string, unknown>,
  data: Record<string, unknown>,
  removes: string[] = []
): void {
  const byRoot: Record<string, Record<string, unknown>> = {};
  for (const path of Object.keys(data)) {
    const value = data[path];
    const parts = path.split(".");
    const root = parts[0];
    if (!root) continue;
    let obj = byRoot[root];
    if (!obj) obj = byRoot[root] = {};
    for (let i = 1; i < parts.length - 1; i++) {
      const p = parts[i];
      let next = obj[p];
      if (next == null || typeof next !== "object" || Array.isArray(next)) {
        next = {};
        obj[p] = next;
      }
      obj = next as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
  }
  for (const root of Object.keys(byRoot)) {
    const nested = byRoot[root];
    const existing = scene[root];
    const existingIsProxy =
      existing != null &&
      typeof existing === "object" &&
      (existing as Record<string, unknown>).__isProxy === true;
    if (existingIsProxy) {
      applyPatch(existing as Record<string, unknown>, nested);
    } else {
      scene[root] = nested;
    }
  }
  for (const path of removes) deleteByPath(scene, path);
}

function jsonClone(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}

/** Collect leaf path→value (primitives only) from obj for diffing; prefix is the root key (e.g. object id). */
function collectPaths(
  obj: Record<string, unknown>,
  prefix: string,
  out: Record<string, unknown>
): void {
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;
    if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype) {
      collectPaths(v as Record<string, unknown>, path, out);
    } else {
      out[path] = v;
    }
  }
}

/**
 * Plugin that syncs scene over a WebRTC mesh. On peer connect, sends full scene;
 * on scene changes, sends incremental patches. Applies full or patch messages
 * via the scene proxy so reactivity is preserved.
 */
export const networkingPlugin =
  (options?: NetworkingPluginOptions): Plugin<NetworkingContext> =>
  async (context) => {
    const mesh = createWebRTCMesh({ channelName: options?.channelName });
    if (!mesh) {
      console.log("[networking] WebRTC mesh not available (no BroadcastChannel/RTCPeerConnection)");
      return { ...context, networking: null };
    }

    console.log("[networking] scene sync enabled, peerId:", mesh.peerId.slice(0, 8));
    const scene = getScene();

    // Frame-based sync: sample scene once per frame, diff, send one packet. No per-change handlers.
    let lastSent: Record<string, unknown> = {};
    let lastRootKeys: string[] = [];
    let rafId: number | null = null;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if (mesh.getPeerCount() === 0) return;
      const query = scene.query(NetworkedObjectDefinition) as Record<string, Record<string, unknown>>;
      const rootKeys = Object.keys(query);
      const current: Record<string, unknown> = {};
      for (const key of rootKeys) {
        const obj = query[key];
        if (obj?.__ownerId !== mesh.peerId) continue;
        collectPaths(obj, key, current);
      }
      const removedRoots = lastRootKeys.filter((k) => !rootKeys.includes(k));
      const data: Record<string, unknown> = {};
      for (const path of Object.keys(current)) {
        if (current[path] !== lastSent[path]) data[path] = current[path];
      }
      const removes = removedRoots.length > 0 ? removedRoots : undefined;
      if (Object.keys(data).length === 0 && !removes?.length) {
        lastRootKeys = rootKeys;
        return;
      }
      try {
        const msg: PatchMessage = removes?.length ? { _patch: true, data, removes } : { _patch: true, data };
        mesh.sendToAll(JSON.stringify(msg));
      } catch (_) {
        // ignore
      }
      for (const path of Object.keys(current)) lastSent[path] = current[path];
      for (const r of removedRoots) {
        for (const path of Object.keys(lastSent)) {
          if (path === r || path.startsWith(r + ".")) delete lastSent[path];
        }
      }
      lastRootKeys = rootKeys;
    };

    rafId = requestAnimationFrame(tick);

    const unsubPeerConnected = mesh.onPeerConnected((peerId) => {
      if (applyingRemotePatch) return;
      // Defer send so the other peer's data channel and message handlers are ready to receive
      queueMicrotask(() => {
        try {
          const data = jsonClone(scene as Record<string, unknown>) as Record<string, unknown>;
          const msg: FullSceneMessage = { _full: true, data };
          mesh.sendTo(peerId, JSON.stringify(msg));
          console.log("[networking] sent full scene to", peerId.slice(0, 8));
        } catch (_) {
          // ignore
        }
      });
    });

    const unsubMesh = mesh.onMessage((data, fromPeerId) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(data) as Record<string, unknown>;
      } catch (_) {
        return;
      }
      if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
        return;
      }
      try {
        applyingRemotePatch = true;
        if (payload._full === true && payload.data != null && typeof payload.data === "object" && !Array.isArray(payload.data)) {
          const keyCount = Object.keys(payload.data as Record<string, unknown>).length;
          console.log("[networking] received full scene from", fromPeerId.slice(0, 8), keyCount, "key(s)");
          applyPatch(getScene(), payload.data as Record<string, unknown>);
          console.log("[networking] applied initial scene (patch) from", fromPeerId.slice(0, 8));
        } else if (payload._patch === true && payload.data != null && typeof payload.data === "object" && !Array.isArray(payload.data)) {
          const data = payload.data as Record<string, unknown>;
          const removes = Array.isArray(payload.removes) ? (payload.removes as string[]) : [];
          console.log("[networking] received patch from", fromPeerId.slice(0, 8), Object.keys(data).length, "set(s)", removes.length, "remove(s)");
          applyPatchPayload(getScene(), data, removes);
        }
      } catch (err) {
        console.error("[networking] failed to apply scene update from", fromPeerId.slice(0, 8), err);
      } finally {
        applyingRemotePatch = false;
      }
    });

    const originalClose = mesh.close;
    mesh.close = () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
      unsubPeerConnected();
      unsubMesh();
      originalClose.call(mesh);
    };

    return {
      ...context,
      networking: {
        getPeerCount: mesh.getPeerCount,
        peerId: mesh.peerId,
        close: mesh.close,
      },
    };
  };
