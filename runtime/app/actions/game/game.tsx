import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { copyAndPaste } from "../../utilities/copy-and-paste.ts";
import { inputMap } from "../../utilities/input.ts";
import { isObject } from "../../utilities/is-object.ts";
import { Mode, mode, onModeChange } from "../../utilities/mode.ts";
import { colliderTrait, physicsBodyTrait, resetPhysics, stepPhysics } from "../../utilities/physics.ts";
import { filterScene, scene, restoreScene, snapshotScene } from "../../utilities/scene.ts";
import {
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { updateLoop as createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { parentObject, transform } from "../../utilities/viewport/transform.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { viewport } from "../../utilities/viewport/viewport.ts";
import type { GameObject } from "../editor/object-tree.tsx";

const SPEED = 240;

function selectableAt(point: WorldPoint): GameObject | undefined {
  const found = filterScene(scene, (node) => {
    if (!isObject(node) || node instanceof DOMMatrix) return;
    const bounds = lookupBoundingBox(node);
    if (!bounds || !contains(bounds, point)) return;
    return node;
  });
  return found[0];
}

export const Game = clientEntry(import.meta.url, function Game(handle: Handle) {
  let hovering = false;

  return () => (
    <main
      mix={[
        css({
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }),
      ]}
    >
      <canvas
        aria-label="Game view"
        tabIndex={-1}
        mix={[
          css({
            display: "block",
            width: "100%",
            height: "100%",
            cursor: hovering ? "pointer" : "grab",
            touchAction: "none",
            background: "#262626",
            outline: "none",
          }),
          ref((node, signal) => {
            const isCanvas = node instanceof HTMLCanvasElement;
            if (!isCanvas) return;
            const canvas = node;
            canvas.addEventListener(
              "pointerdown",
              (event) => {
                if (event.target !== canvas) return;
                canvas.focus({ preventScroll: true });
              },
              { signal },
            );

            const editorViewport = viewport(canvas, {
              signal,
              handleSelection: selectableAt,
              handleHoverSelectable(next) {
                if (hovering === next) return;
                hovering = next;
                handle.update();
              },
            });
            const input = inputMap(
              {
                buttons: {
                  deselect: ["escape"],
                },
                axes: {
                  x: {
                    positive: ["d", "arrowright"],
                    negative: ["a", "arrowleft"],
                  },
                  y: {
                    positive: ["s", "arrowdown"],
                    negative: ["w", "arrowup"],
                  },
                },
              },
              { signal },
            );
            copyAndPaste({ signal });

            const updateLoop = createUpdateLoop();
            const editorLoop = createUpdateLoop(updateLoop);
            const gameLoop = createUpdateLoop(updateLoop);

            editorLoop.onUpdate(() => {
            });

            gameLoop.onUpdate(({ deltaTime }) => {
              stepPhysics(deltaTime);
              const dx = input.axes.x * SPEED * deltaTime;
              const dy = input.axes.y * SPEED * deltaTime;
              if (dx === 0 && dy === 0) return;
              for (const image of filterScene(scene, (node) => {
                const image = imageTrait(node);
                if (!image || parentObject(image) || physicsBodyTrait(image)) return;
                return image;
              })) {
                const placement = transform(image);
                if (!placement) continue;
                placement.position.x += dx;
                placement.position.y += dy;
              }
            });

            updateLoop.onUpdate(() => {
              for (const object of selectedObjects) editorViewport.drawBoundingBox(object);

              input.update();
              if (input.buttons.deselect.pressed) selectObjects([]);
              
              editorViewport.beginDrawing();
              for (const image of filterScene(scene, imageTrait)) {
                editorViewport.drawImage(image);
              }
              for (const text of filterScene(scene, textTrait)) {
                editorViewport.drawText(text);
              }
              for (const frame of filterScene(scene, frameTrait)) {
                editorViewport.drawFrame(frame);
              }
              for (const collider of filterScene(scene, colliderTrait)) {
                editorViewport.drawPhysicsCollider(collider);
              }
            });

            onModeChange((next) => {
              switch (next) {
                case Mode.Play:
                  snapshotScene();
                  editorLoop.stop();
                  gameLoop.start();
                  break;
                case Mode.Edit:
                  gameLoop.stop();
                  restoreScene();
                  resetPhysics();
                  selectObjects([]);
                  editorLoop.start();
                  break;
              }
            }, signal);

            if (mode === Mode.Play) {
              snapshotScene();
              gameLoop.start();
            }
            else editorLoop.start();
            updateLoop.start();

            signal.addEventListener("abort", () => {
              updateLoop.stop();
              editorLoop.stop();
              gameLoop.stop();
            });
          }),
        ]}
      />
    </main>
  );
});
