import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { copyAndPaste } from "../../utilities/copy-and-paste.ts";
import { inputMap } from "../../utilities/input.ts";
import { isObject } from "../../utilities/is-object.ts";
import { Mode, mode, onModeChange, simulating } from "../../utilities/mode.ts";
import { colliderTrait, physicsBodyTrait, resetPhysics, stepPhysics } from "../../utilities/physics.ts";
import { applyScenePatch, filterScene, objectAt, objectPath, scene, restoreScene, snapshotScene, takeScenePatch } from "../../utilities/scene.ts";
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

declare global {
  interface Window {
    spritedream?: {
      screenToWorld(clientX: number, clientY: number): { x: number; y: number };
      worldToScreen(x: number, y: number): { x: number; y: number };
      selection(): string[][];
      remoteSelections: { id: string; color: string; paths: string[][] }[];
      scene: typeof scene;
    };
  }
}

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
            const canvasSpace = {
              screenToWorld: (clientX: number, clientY: number) => editorViewport.screenToWorld(clientX, clientY),
              worldToScreen: (x: number, y: number) => editorViewport.worldToScreen(x, y),
              selection: () =>
                [...selectedObjects].flatMap((object) => {
                  const path = objectPath(scene, object);
                  return path ? [path] : [];
                }),
              remoteSelections: [] as { id: string; color: string; paths: string[][] }[],
              scene,
            };
            window.spritedream = canvasSpace;
            signal.addEventListener("abort", () => {
              if (window.spritedream === canvasSpace) delete window.spritedream;
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

            const remoteKeys = new Map<string, object>();
            updateLoop.onUpdate(() => {
              for (const object of selectedObjects) editorViewport.drawBoundingBox(object);
              for (const person of canvasSpace.remoteSelections) {
                for (const path of person.paths) {
                  const object = objectAt(scene, path);
                  if (!object || selectedObjects.has(object)) continue;
                  const name = `${person.id}:${path.join("\0")}`;
                  let key = remoteKeys.get(name);
                  if (!key) remoteKeys.set(name, (key = {}));
                  editorViewport.drawBoundingBox(object, { color: person.color, handles: false, key });
                }
              }

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

              const patch = takeScenePatch();
              if (patch.length > 0 && (mode !== Mode.Play || simulating)) {
                window.postMessage({ scene: patch, local: true }, location.origin);
              }
            });

            let ownsSnapshot = false;
            const followRoom = () => {
              const running = mode === Mode.Play && simulating;
              if (running) {
                if (!ownsSnapshot) {
                  snapshotScene();
                  ownsSnapshot = true;
                }
                editorLoop.stop();
                gameLoop.start();
                return;
              }
              gameLoop.stop();
              if (ownsSnapshot) {
                restoreScene();
                resetPhysics();
                selectObjects([]);
                ownsSnapshot = false;
              }
              if (mode === Mode.Edit) editorLoop.start();
              else editorLoop.stop();
            };

            const onPatch = (event: MessageEvent) => {
              if (event.origin !== location.origin || event.data?.local || !Array.isArray(event.data?.scene)) return;
              applyScenePatch(event.data.scene);
            };
            window.addEventListener("message", onPatch);
            signal.addEventListener("abort", () => window.removeEventListener("message", onPatch));

            onModeChange(() => followRoom(), signal);
            followRoom();
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
