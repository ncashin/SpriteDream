import { createRoot } from "remix/component";
import type { FrameHandle, RemixNode, VirtualRoot } from "remix/component";

let appFrame: FrameHandle | undefined;

export function setAppFrame(frame: FrameHandle) {
  appFrame = frame;
}

import type { ViewportWithTransforms } from "./viewportTransforms.ts";

type Slot = {
  host: HTMLDivElement;
  root: VirtualRoot;
  placed: boolean;
};

export type DrawComponent = {
  (
    viewportWithTransforms: ViewportWithTransforms,
    key: object | string,
    transform: DOMMatrix,
    node: RemixNode,
  ): void;
  dispose(): void;
};

const keys = new WeakMap<object, Map<string, object>>();

export function drawComponentKey(source: object, name = "") {
  let byName = keys.get(source);
  if (!byName) keys.set(source, (byName = new Map()));
  let key = byName.get(name);
  if (!key) byName.set(name, (key = {}));
  return key;
}

export function createDrawComponent(canvas: HTMLCanvasElement): DrawComponent {
  let parent = canvas.parentElement;
  if (!parent) throw new Error("Canvas has no parent element");
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";

  let layer = canvas.ownerDocument.createElement("div");
  layer.style.position = "absolute";
  layer.style.inset = "0";
  layer.style.overflow = "hidden";
  layer.style.pointerEvents = "none";
  layer.style.zIndex = "1";
  canvas.after(layer);

  const passthrough = canvas.ownerDocument.createElement("style");
  passthrough.textContent = `[data-alt-pointer-passthrough], [data-alt-pointer-passthrough] * { pointer-events: none !important; }`;
  canvas.ownerDocument.head.append(passthrough);

  function setAltPassthrough(active: boolean) {
    layer.toggleAttribute("data-alt-pointer-passthrough", active);
  }

  function onAltKey(event: KeyboardEvent) {
    if (event.key !== "Alt") return;
    setAltPassthrough(event.type === "keydown");
  }

  function clearAltPassthrough() {
    setAltPassthrough(false);
  }

  const view = canvas.ownerDocument.defaultView;
  view?.addEventListener("keydown", onAltKey);
  view?.addEventListener("keyup", onAltKey);
  view?.addEventListener("blur", clearAltPassthrough);

  let slots = new Map<object | string, Slot>();
  let pool: Slot[] = [];
  let seen: (object | string)[] = [];
  let epoch = 0;
  let open = false;
  let disposed = false;
  let pendingClear = 0;

  function createSlot(): Slot {
    let host = canvas.ownerDocument.createElement("div");
    host.style.position = "absolute";
    host.style.left = "0";
    host.style.top = "0";
    host.style.margin = "0";
    host.style.width = "fit-content";
    host.style.height = "fit-content";
    host.style.transformOrigin = "0 0";
    host.style.pointerEvents = "none";
    host.style.visibility = "hidden";
    layer.append(host);
    return { host, root: createRoot(host, appFrame ? { frame: appFrame } : undefined), placed: false };
  }

  function slotFor(key: object | string) {
    let slot = slots.get(key);
    if (slot) return slot;
    slot = pool.pop() ?? createSlot();
    slots.set(key, slot);
    return slot;
  }

  function release(key: object | string, slot: Slot) {
    clearSlot(slot);
    slot.root.dispose();
    slot.root = createRoot(slot.host, appFrame ? { frame: appFrame } : undefined);
    slots.delete(key);
    pool.push(slot);
  }

  function clearSlot(slot: Slot) {
    if (!slot.placed) return;
    slot.placed = false;
    slot.host.style.visibility = "hidden";
    slot.host.style.transform = "";
  }

  function drawComponent(
    viewportWithTransforms: ViewportWithTransforms,
    key: object | string,
    transform: DOMMatrix,
    node: RemixNode,
  ) {
    if (disposed) return;
    if (!open) {
      open = true;
      seen = [];
      epoch += 1;
      let drawn = epoch;
      queueMicrotask(() => {
        if (disposed) return;
        open = false;
        let live = new Set(seen);
        for (let [slotKey, slot] of slots) {
          if (!live.has(slotKey)) release(slotKey, slot);
        }
        if (pendingClear !== 0) cancelAnimationFrame(pendingClear);
        pendingClear = requestAnimationFrame(() => {
          pendingClear = 0;
          if (disposed || epoch !== drawn) return;
          for (let slot of slots.values()) clearSlot(slot);
        });
      });
    }

    seen.push(key);
    let slot = slotFor(key);
    slot.root.render(node);
    slot.root.flush();
    slot.placed = true;
    slot.host.style.visibility = "visible";
    slot.host.style.transform = viewportWithTransforms.worldToScreenMatrix(transform).toString();
  }

  drawComponent.dispose = () => {
    disposed = true;
    open = false;
    if (pendingClear !== 0) cancelAnimationFrame(pendingClear);
    pendingClear = 0;
    for (let slot of slots.values()) {
      clearSlot(slot);
      slot.root.dispose();
      slot.host.remove();
    }
    for (let slot of pool) {
      slot.root.dispose();
      slot.host.remove();
    }
    slots = new Map();
    pool = [];
    seen = [];
    view?.removeEventListener("keydown", onAltKey);
    view?.removeEventListener("keyup", onAltKey);
    view?.removeEventListener("blur", clearAltPassthrough);
    passthrough.remove();
    layer.remove();
  };

  return drawComponent;
}
