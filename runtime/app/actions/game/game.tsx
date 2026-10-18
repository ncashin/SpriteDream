import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { joinRoom } from "../editor/room.tsx";
import { contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { copyAndPaste } from "../../utilities/copy-and-paste.ts";
import { inputMap } from "../../utilities/input.ts";
import { Mode, setMode } from "../../utilities/mode.ts";
import {
  colliderTrait,
  physics as createPhysics,
  physicsBodyTrait,
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
import { traits } from "../../utilities/trait/trait.ts";
import { updateLoop } from "../../utilities/update-loop.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { viewport } from "../../utilities/viewport/viewport.ts";

const RUN_SPEED = 280;
const JUMP_SPEED = -560;

function objectAtPoint(point: WorldPoint) {
  const found = filterScene(scene, (node) => {
    const bounds = lookupBoundingBox(node);
    if (!bounds || !contains(bounds, point)) return;
    return node;
  });
  return found[0];
}

export const Game = clientEntry(import.meta.url, function Game(handle: Handle) {
  let hovering = false;

  function onWorldHover(point: WorldPoint) {
    const next = objectAtPoint(point) !== undefined;
    if (hovering === next) return;
    hovering = next;
    handle.update();
  }

  function onWorldClick(point: WorldPoint) {
    const node = objectAtPoint(point);
    selectObjects(node === undefined ? [] : [node]);
  }

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
            cursor: hovering ? "pointer" : undefined,
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
              onWorldHover,
              onWorldClick,
            });
            canvas.addEventListener(
              "pointerleave",
              () => {
                if (!hovering) return;
                hovering = false;
                handle.update();
              },
              { signal },
            );

            const input = inputMap(
              {
                buttons: {
                  deselect: ["escape"],
                  jump: [" ", "w", "arrowup"],
                },
                axes: {
                  x: {
                    positive: ["d", "arrowright"],
                    negative: ["a", "arrowleft"],
                  },
                },
              },
              { signal },
            );
            copyAndPaste({ signal });

            const loop = updateLoop();
            const physics = createPhysics();

            const syncMode = () => {
              if (room.state.mode === Mode.Play && room.isHost) {
                snapshotScene();
                return;
              }
              if (restoreScene()) selectObjects([]);
            };
            
            let before = structuredClone(scene);
            const room = joinRoom(signal, {
              onScene(patch) {
                applyScenePatch(patch);
                applyScenePatch(patch, before);
              },
              onModeChange(next) {
                setMode(next, next === Mode.Play && room.isHost);
                syncMode();
              },
              onHostChange: syncMode,
            });
            syncMode();

            let sentSelection = "";
            let sentInput = "";

            loop.onUpdate(({ deltaTime }) => {
              const playing = room.state.mode === Mode.Play;
              const mine = { x: input.axes.x, jump: input.buttons.jump.down };
              if (playing) {
                const encoded = JSON.stringify(mine);
                if (encoded !== sentInput) {
                  sentInput = encoded;
                  room.sendInput(mine);
                }
              }

              if (playing && room.isHost) {
                let x = 0;
                let jumped = false;
                for (const person of Object.values(room.state.people)) {
                  const controls = person.id === room.you ? mine : person.input;
                  const axis = controls?.x;
                  if (typeof axis === "number") x += axis;
                  jumped ||= controls?.jump === true;
                }
                x = Math.max(-1, Math.min(1, x));

                const player = physicsBodyTrait(scene.player);
                if (player) {
                  player.physicsBody.velocity.x = x * RUN_SPEED;
                  const grounded = physics.contacts().some((contact) => {
                    if (!contact.touching) return false;
                    if (contact.a === scene.player) return contact.normalY > 0.5;
                    if (contact.b === scene.player) return contact.normalY < -0.5;
                    return false;
                  });
                  if (jumped && grounded) {
                    player.physicsBody.velocity.y = JUMP_SPEED;
                  }
                }

                physics.beginFrame(deltaTime);

                for (const object of filterScene(
                  scene,
                  (node) => physicsBodyTrait(node) || colliderTrait(node),
                )) {
                  physics.simulate(object);
                }

                physics.endFrame();
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
                  });
                }
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

            loop.start();

            signal.addEventListener("abort", () => {
              loop.stop();
            });
          }),
        ]}
      />
    </main>
  );
});
