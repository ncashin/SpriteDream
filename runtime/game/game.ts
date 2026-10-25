import { contains, lookupBoundingBox } from "../app/utilities/bounding-box.ts";
import { isObject } from "../app/utilities/is-object.ts";
import { diffScene, filterScene } from "../app/utilities/scene.ts";
import type { SceneContext } from "../app/actions/editor/scene-viewer.tsx";
import {
  selectObjects,
  selectedObjects,
} from "../app/utilities/selected-objects.ts";
import { colliderTrait } from "../app/utilities/physics.ts";
import { createUpdateLoop } from "../app/utilities/update-loop.ts";
import { imageTrait } from "../app/utilities/viewport/draw-image.ts";
import { textTrait } from "../app/utilities/viewport/draw-text.ts";
import { frameTrait } from "../app/utilities/viewport/frame.tsx";
import { createViewport } from "../app/utilities/viewport/viewport.ts";

export function game({
  canvas,
  scene,
  room,
  sceneKey,
  signal,
  onPatch,
}: SceneContext) {
  if (!scene || signal.aborted) return;

  let previous = structuredClone(scene);
  const cursors: Record<string, { x: number; y: number }> = {};
  let sentX = 0;
  let sentY = 0;

  room.onMessageType("cursor", (message) => {
    if (message.id === room.you.id) return;
    if (message.sceneKey !== sceneKey) {
      delete cursors[message.id];
      return;
    }
    cursors[message.id] = { x: message.x, y: message.y };
  });

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

    for (const id in cursors) {
      const point = cursors[id];
      if (point) viewport.drawCursor(point, id);
    }

    const { x, y } = viewport.state.cursorPoint;
    if (x !== sentX || y !== sentY) {
      sentX = x;
      sentY = y;
      room.send({
        messageType: "cursor",
        id: room.you.id,
        sceneKey,
        x,
        y,
      });
    }

    const patch = diffScene(previous, scene);
    if (patch.length === 0) return;
    previous = structuredClone(scene);
    onPatch(patch);
  });

  updateLoop.start();
}
