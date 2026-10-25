import { contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { isObject } from "../../utilities/is-object.ts";
import { diffScene, filterScene } from "../../utilities/scene.ts";
import type { SceneContext } from "./scene-viewer.tsx";
import { selectObjects, selectedObjects } from "../../utilities/selected-objects.ts";
import { colliderTrait } from "../../utilities/physics.ts";
import { createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { createViewport } from "../../utilities/viewport/viewport.ts";

export function game({ canvas, scene, room, signal, onPatch }: SceneContext) {
  if (!scene || signal.aborted) return;

  let previous = structuredClone(scene);

  const updateLoop = createUpdateLoop();
  const viewport = createViewport(canvas, {
    onWorldClick(point) {
      const hit = Object.values(scene).findLast((object) => {
        if (!isObject(object)) return false;
        const bounds = lookupBoundingBox(object);
        return bounds !== undefined && contains(bounds, point);
      });
      selectObjects(hit ? [hit] : []);
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

    for (const object of selectedObjects) {
      viewport.drawBoundingBox(object);
    }

    const patch = diffScene(previous, scene);
    if (patch.length === 0) return;
    previous = structuredClone(scene);
    onPatch(patch);
  });

  updateLoop.start();
}
