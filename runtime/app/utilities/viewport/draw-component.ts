import { createRoot } from "remix/component";
import type { RemixNode, VirtualRoot } from "remix/component";

type Slot = {
  host: HTMLDivElement;
  root: VirtualRoot;
  placed: boolean;
};

export type DrawComponent = {
  (transform: DOMMatrix, node: RemixNode): void;
  dispose(): void;
};

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

  let slots: Slot[] = [];
  let used = 0;
  let epoch = 0;
  let open = false;
  let disposed = false;
  let pendingClear = 0;

  function slotAt(index: number) {
    let slot = slots[index];
    if (slot) return slot;

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
    slot = { host, root: createRoot(host), placed: false };
    slots[index] = slot;
    return slot;
  }

  function clearSlot(slot: Slot) {
    if (!slot.placed) return;
    slot.placed = false;
    slot.host.style.visibility = "hidden";
    slot.host.style.transform = "";
  }

  function drawComponent(transform: DOMMatrix, node: RemixNode) {
    if (disposed) return;
    if (!open) {
      open = true;
      used = 0;
      epoch += 1;
      let drawn = epoch;
      queueMicrotask(() => {
        if (disposed) return;
        open = false;
        for (let index = used; index < slots.length; index++) clearSlot(slots[index]!);
        if (pendingClear !== 0) cancelAnimationFrame(pendingClear);
        pendingClear = requestAnimationFrame(() => {
          pendingClear = 0;
          if (disposed || epoch !== drawn) return;
          for (let slot of slots) clearSlot(slot);
        });
      });
    }

    let slot = slotAt(used);
    used += 1;
    slot.root.render(node);
    slot.root.flush();
    slot.placed = true;
    slot.host.style.visibility = "visible";
    slot.host.style.transform = transform.toString();
  }

  drawComponent.dispose = () => {
    disposed = true;
    open = false;
    if (pendingClear !== 0) cancelAnimationFrame(pendingClear);
    pendingClear = 0;
    for (let slot of slots) {
      clearSlot(slot);
      slot.root.dispose();
      slot.host.remove();
    }
    slots = [];
    used = 0;
    layer.remove();
  };

  return drawComponent;
}
