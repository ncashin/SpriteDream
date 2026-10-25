import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { holdAppReady } from "../../utilities/app-ready.ts";
import { whenImageReady } from "../../utilities/runtime-assets.ts";
import { filterScene, scene as liveScene, type SceneNode } from "../../utilities/scene.ts";
import { selectedObjects } from "../../utilities/selected-objects.ts";
import { colliderTrait } from "../../utilities/physics.ts";
import { createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { prepareFont, textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { createViewport } from "../../utilities/viewport/viewport.ts";

function abortWhenDisconnected(canvas: HTMLCanvasElement) {
  const controller = new AbortController();
  const parent = canvas.parentNode;
  if (!parent) {
    controller.abort();
    return controller.signal;
  }

  const observer = new MutationObserver(() => {
    if (canvas.isConnected) return;
    observer.disconnect();
    controller.abort();
  });
  observer.observe(parent, { childList: true });
  controller.signal.addEventListener("abort", () => observer.disconnect());
  return controller.signal;
}

async function mountSceneViewer(canvas: HTMLCanvasElement, readScene: () => SceneNode) {
  const release = holdAppReady();
  try {
    const signal = abortWhenDisconnected(canvas);
    const updateLoop = createUpdateLoop({ signal });
    const viewport = createViewport(canvas, { signal });

    updateLoop.onUpdate(() => {
      const drawn = readScene();
      viewport.beginDrawing();

      for (const image of filterScene(drawn, imageTrait)) {
        viewport.drawImage(image);
      }

      for (const text of filterScene(drawn, textTrait)) {
        viewport.drawText(text);
      }

      for (const frame of filterScene(drawn, frameTrait)) {
        viewport.drawFrame(frame);
      }

      for (const collider of filterScene(drawn, colliderTrait)) {
        viewport.drawPhysicsCollider(collider);
      }

      for (const object of selectedObjects) {
        viewport.drawBoundingBox(object);
      }
    });

    const drawn = readScene();
    const images = filterScene(drawn, imageTrait).map((image) => whenImageReady(image.image.image));
    const fonts = filterScene(drawn, textTrait).map((text) => prepareFont(text.text.font));
    await Promise.all([document.fonts.ready, ...images, ...fonts]);
    if (signal.aborted) return;
    updateLoop.start();
  } finally {
    release();
  }
}

export const SceneViewer = clientEntry(
  import.meta.url,
  function SceneViewer(handle: Handle<{ scene?: SceneNode }>) {
    return () => (
      <canvas
        aria-label="Scene view"
        tabIndex={-1}
        mix={[
          css({
            display: "block",
            width: "100%",
            height: "100%",
            touchAction: "none",
            background: "#1c1c1e",
            outline: "none",
          }),
          ref((node) => {
            if (!(node instanceof HTMLCanvasElement)) return;
            if (node.dataset.mounted === "true") return;
            node.dataset.mounted = "true";
            void mountSceneViewer(node, () => handle.props.scene ?? liveScene);
          }),
        ]}
      />
    );
  },
);
