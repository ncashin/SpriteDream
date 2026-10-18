import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { joinRoom } from "../editor/room.tsx";
import { contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { copyAndPaste } from "../../utilities/copy-and-paste.ts";
import { inputMap } from "../../utilities/input.ts";
import { Mode, setMode } from "../../utilities/mode.ts";
import {
  colliderTrait,
  physicsBodyTrait,
  resetPhysics,
  stepPhysics,
} from "../../utilities/physics.ts";
import {
  applyScenePatch,
  diffScene,
  filterScene,
  objectAt,
  objectPath,
  scene,
  restoreScene,
  snapshotScene,
} from "../../utilities/scene.ts";
import {
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { playerColor } from "../../utilities/player-color.ts";
import { updateLoop as createUpdateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { parentObject, transform } from "../../utilities/viewport/transform.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { viewport } from "../../utilities/viewport/viewport.ts";

const SPEED = 240;

function handleSelection(point: WorldPoint) {
  const found = filterScene(scene, (node) => {
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

            const editorViewport = viewport(canvas, {
              signal,
              handleSelection,
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

            editorLoop.onUpdate(() => {});

            const syncLoops = () => {
              if (room.state.mode === Mode.Play && room.isHost) {
                snapshotScene();
                editorLoop.stop();
                gameLoop.start();
                return;
              }
              gameLoop.stop();
              if (restoreScene()) {
                resetPhysics();
                selectObjects([]);
              }
              if (room.state.mode === Mode.Edit) editorLoop.start();
              else editorLoop.stop();
            };
            let before = structuredClone(scene);
            const room = joinRoom(signal, {
              onScene(patch) {
                applyScenePatch(patch);
                applyScenePatch(patch, before);
              },
              onModeChange(next) {
                setMode(next, next === Mode.Play && room.isHost);
                syncLoops();
              },
              onHostChange: syncLoops,
            });
            syncLoops();

            gameLoop.onUpdate(({ deltaTime }) => {
              stepPhysics(deltaTime);
              const dx = input.axes.x * SPEED * deltaTime;
              const dy = input.axes.y * SPEED * deltaTime;
              if (!dx && !dy) return;
              filterScene(scene, (node) => {
                const img = imageTrait(node);
                if (img && !parentObject(img) && !physicsBodyTrait(img)) {
                  const placement = transform(img);
                  if (placement) {
                    placement.position.x += dx;
                    placement.position.y += dy;
                  }
                }
              });
            });
       

            let sentSelection = "";

            updateLoop.onUpdate(() => {
              for (const object of selectedObjects)
                editorViewport.drawBoundingBox(object);

              for (const person of Object.values(room.state.people)) {
                if (person.id === room.you) continue;
                const color = playerColor(person.id);
                if (person.cursor) {
                  editorViewport.drawCursor(person.cursor, color);
                }
                
                for (const path of person.selectedObjects ?? []) {
                  const object = objectAt(scene, path);
                  if (!object) continue;
                  editorViewport.drawBoundingBox(object, {
                    color,
                    handles: false,
                    key: `${person.id}:${path.join("/")}`,
                  });
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

              room.sendCursor(editorViewport.state.cursorPoint);
              const paths = [...selectedObjects].flatMap((object) => {
                const path = objectPath(scene, object);
                return path ? [path] : [];
              });
              const selection = JSON.stringify(paths);
              if (selection !== sentSelection) {
                sentSelection = selection;
                room.sendSelectedObjects(paths);
              }

              const patch = diffScene(before, scene);
              if (patch.length === 0) return;
              applyScenePatch(patch, before);
              if (room.state.mode !== Mode.Play || room.isHost) {
                room.sendScenePatch(patch);
              }
            });

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
