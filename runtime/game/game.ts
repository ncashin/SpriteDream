import { contains, lookupBoundingBox } from "../app/utilities/bounding-box.ts";
import { isObject } from "../app/utilities/is-object.ts";
import { applyScenePatch, diffScene, filterScene } from "../app/utilities/scene.ts";
import type { SceneContext } from "../app/actions/editor/sceneViewer/scene-viewer.tsx";
import { colliderTrait } from "../app/utilities/physics.ts";
import { createUpdateLoop } from "../app/utilities/update-loop.ts";
import { imageTrait } from "../app/utilities/viewport/draw-image.ts";
import { textTrait } from "../app/utilities/viewport/draw-text.ts";
import { frameTrait } from "../app/utilities/viewport/frame.tsx";
import { createViewport } from "../app/utilities/viewport/viewport.ts";

export function game({
  canvas,
  scene,
  signal,
  document,
  selection,
  presence,
}: SceneContext) {
  if (!scene || signal.aborted) return;

  let previous = structuredClone(scene);
  let writing = false;

  function applyDocument() {
    const parsed = JSON.parse(document.read());

    const patch = diffScene(scene, parsed);

    if (patch.length === 0) return;

    applyScenePatch(patch, scene);
    
    previous = structuredClone(scene);
  }

  const unsubscribe = document.subscribe(() => {
    if (writing) return;
    applyDocument();
  });
  signal.addEventListener("abort", unsubscribe);

  const updateLoop = createUpdateLoop();
  const viewport = createViewport(canvas, {
    onWorldHover(point) {
      presence.sendCursor(point);
    },
    onWorldClick(point) {
      const hit = Object.values(scene).findLast((object) => {
        if (!isObject(object)) return false;
        const bounds = lookupBoundingBox(object);
        return bounds !== undefined && contains(bounds, point);
      });
      selection.selectObjects(hit ? [hit] : []);
    },
  });
  signal.addEventListener("abort", () => {
    updateLoop.destroy();
    viewport.destroy();
  });

  updateLoop.onUpdate(() => {
    viewport.beginDrawing();

    for (const image of filterScene(scene, imageTrait)) {
      viewport.drawImage(image);
    }

    for (const text of filterScene(scene, textTrait)) {
      viewport.drawText(text);
    }

    for (const frame of filterScene(scene, frameTrait)) {
      viewport.drawFrame(frame, scene);
    }

    for (const collider of filterScene(scene, colliderTrait)) {
      viewport.drawPhysicsCollider(collider);
    }

    for (const object of selection.selected) {
      viewport.drawBoundingBox(object);
    }

    for (const id in presence.cursors) {
      const point = presence.cursors[id];
      if (!point) continue;
      viewport.drawCursor(point, id);
    }

    const patch = diffScene(previous, scene);
    if (patch.length === 0) return;
    previous = structuredClone(scene);
    writing = true;
    document.write(`${JSON.stringify(scene, null, 2)}\n`);
    writing = false;
  });

  updateLoop.start();
}
