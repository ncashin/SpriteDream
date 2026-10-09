import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";

import { center, contains, drawBoundingBox } from "../../utilities/bounding.ts";
import { inputMap } from "../../utilities/input.ts";
import { Mode, mode, onModeChange } from "../../utilities/mode.ts";
import { scene, queryScene } from "../../utilities/scene.ts";
import {
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { updateLoop as createUpdateLoop } from "../../utilities/update-loop.ts";
import { image as imageTrait } from "../../utilities/viewport/draw-image.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { viewport } from "../../utilities/viewport/viewport.ts";
import { ObjectTree } from "../editor/object-tree.tsx";
import type { GameObject } from "../editor/object-tree.tsx";

const SPEED = 240;
const POPOVER_GAP = 10;

function selectableAt(point: WorldPoint): GameObject | undefined {
  const found = queryScene(scene, imageTrait).find((node) => {
    return contains(node, point);
  });
  return found;
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

            const view = viewport(canvas, {
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

            const updateLoop = createUpdateLoop();

            updateLoop.onUpdate(() => {
              input.update();
              if (input.buttons.deselect.pressed) selectObjects([]);
            });

            const editorLoop = createUpdateLoop(updateLoop);
            const gameLoop = createUpdateLoop(updateLoop);

            editorLoop.onUpdate(() => {
              for (const object of selectedObjects) {
                const sprite = imageTrait(object);
                if (!sprite) continue;

                const origin = center(sprite);
                view.drawComponent(
                  new DOMMatrix()
                    .translate(origin.x, origin.y)
                    .rotate(sprite.rotation)
                    .translate(
                      -sprite.width / 2,
                      -sprite.height / 2 - POPOVER_GAP,
                    ),
                  <div
                    mix={css({
                      position: "absolute",
                      left: "0",
                      bottom: "0",
                      width: "max-content",
                      background: "black",
                      color: "#f4f4f5",
                      fontSize: "0.875rem",
                      lineHeight: "1.25rem",
                      padding: "0.5rem",
                      "--text-light": "#d4d4d4",
                    })}
                  >
                    <ObjectTree object={object} />
                  </div>,
                );
              }
            });

            gameLoop.onUpdate(({ deltaTime }) => {
              const dx = input.axes.x * SPEED * deltaTime;
              const dy = input.axes.y * SPEED * deltaTime;
              for (const image of queryScene(scene, imageTrait)) {
                image.x += dx;
                image.y += dy;
              }
            });

            updateLoop.onUpdate(() => {
              for (const image of queryScene(scene, imageTrait)) {
                view.drawImage(image);
              }

              if (mode !== Mode.Edit) return;
              for (const object of selectedObjects) {
                const image = imageTrait(object);
                if (!image) continue;
                drawBoundingBox(view.context, image);
              }
            });

            onModeChange((next) => {
              if (next === Mode.Play) {
                editorLoop.stop();
                gameLoop.start();
              } else {
                gameLoop.stop();
                editorLoop.start();
              }
            }, signal);

            if (mode === Mode.Play) gameLoop.start();
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
