import { clientEntry, css, on, ref } from "remix/component";
import type { Handle } from "remix/component";

import { isObject } from "../../utilities/is-object.ts";
import { objectAt, scene } from "../../utilities/scene.ts";

let panelRoot: Element | undefined;

function countObject() {
  if (typeof window === "undefined" || !panelRoot) return;
  const frameHost = window.frameElement instanceof HTMLElement ? window.frameElement.closest("[data-scene-object]") : null;
  const host = panelRoot.closest("[data-scene-object]") ?? frameHost;
  const name = host instanceof HTMLElement ? host.dataset.sceneObject : undefined;
  if (!scene || !name) return;
  return objectAt(scene, name.split("."));
}

function readCount(object: { count?: unknown } | undefined, fallback: number) {
  if (!object) return fallback;
  const count = Number(object.count);
  return Number.isFinite(count) ? count : 0;
}

export const Panel = clientEntry(import.meta.url, function Panel(handle: Handle) {
  let localCount = 0;

  let shown = localCount;
  if (typeof requestAnimationFrame === "function") {
    let frame = requestAnimationFrame(function tick() {
      if (handle.signal.aborted) return;
      const next = readCount(countObject(), localCount);
      if (next !== shown) {
        shown = next;
        handle.update();
      }
      frame = requestAnimationFrame(tick);
    });
    handle.signal.addEventListener("abort", () => cancelAnimationFrame(frame));
  }

  return () => {
    const object = countObject();
    const count = readCount(object, localCount);
    shown = count;

    return (
      <section
        mix={[
          ref((node) => {
            panelRoot = node;
          }),
          css({
            boxSizing: "border-box",
            width: "100%",
            height: "100%",
            margin: 0,
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            background: "#18181b",
            color: "#f4f4f5",
            font: "14px system-ui, sans-serif",
          }),
        ]}
      >
        <p mix={[css({ margin: 0 })]}>Pressed {count} times</p>
        <button
          type="button"
          mix={[
            css({
              alignSelf: "start",
              padding: "6px 10px",
              border: "1px solid #3f3f46",
              borderRadius: "6px",
              background: "#27272a",
              color: "inherit",
              cursor: "pointer",
            }),
            on("click", () => {
              const target = countObject();
              const next = readCount(target, localCount) + 1;
              if (target && isObject(target)) target.count = String(next);
              else localCount = next;
              handle.update();
            }),
          ]}
        >
          Press
        </button>
      </section>
    );
  };
});
