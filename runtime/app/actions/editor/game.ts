import { filterScene, type SceneNode } from "../../utilities/scene.ts";
import { selectedObjects } from "../../utilities/selected-objects.ts";
import { colliderTrait } from "../../utilities/physics.ts";
import { createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { createViewport } from "../../utilities/viewport/viewport.ts";

export function game(canvas: HTMLCanvasElement, scene?: SceneNode) {
  if (!scene) return;

  const updateLoop = createUpdateLoop();
  const viewport = createViewport(canvas);

  updateLoop.onUpdate(() => {
    viewport.beginDrawing();

    for (const image of filterScene(scene, imageTrait)) {
      viewport.drawImage(image);
    }

    for (const text of filterScene(scene, textTrait)) {
      viewport.drawText(text);
    }

    for (const frame of filterScene(scene, frameTrait)) {
      viewport.drawFrame(frame);
    }

    for (const collider of filterScene(scene, colliderTrait)) {
      viewport.drawPhysicsCollider(collider);
    }

    for (const object of selectedObjects) {
      viewport.drawBoundingBox(object);
    }
  });

  updateLoop.start();
  return () => {
    updateLoop.destroy();
    viewport.destroy();
  };
}
