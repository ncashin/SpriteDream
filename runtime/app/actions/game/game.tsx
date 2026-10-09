import { clientEntry, css, ref } from "remix/component";
import type { Handle } from "remix/component";
import { defaulted, object, parseSafe, string } from "remix/data-schema";
import type { InferOutput } from "remix/data-schema";
import { number } from "remix/data-schema/coerce";

import { createDrawComponent } from "../../draw-component.ts";
import { inputMap } from "../../input.ts";
import { Mode, mode, onModeChange } from "../../mode.ts";
import { scene, queryScene } from "../../scene.ts";
import { selectObjects, selectedObjects } from "../../selected-objects.ts";
import { ObjectTree } from "../editor/object-tree.tsx";
import type { GameObject } from "../editor/object-tree.tsx";
import type { WorldPoint } from "../../viewport.ts";
import { viewport } from "../../viewport.ts";
import { updateLoop as createUpdateLoop } from "../../update-loop.ts";

const SPEED = 240;
const POPOVER_GAP = 10;

const spriteSchema = object({
  x: number(),
  y: number(),
  width: number(),
  height: number(),
  rotation: number(),
  tint: string(),
  image: defaulted(string(), ""),
});

type Sprite = InferOutput<typeof spriteSchema>;

function isSprite(value: unknown): Sprite | undefined {
  let result = parseSafe(spriteSchema, value);
  if (!result.success) return;
  return result.value;
}

function gameObject(value: unknown): GameObject | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return;
  return value as GameObject;
}

function radians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function center(sprite: Sprite) {
  return {
    x: sprite.x + sprite.width / 2,
    y: sprite.y + sprite.height / 2,
  };
}

function contains(sprite: Sprite, point: WorldPoint) {
  let origin = center(sprite);
  let angle = -radians(sprite.rotation);
  let cos = Math.cos(angle);
  let sin = Math.sin(angle);
  let dx = point.x - origin.x;
  let dy = point.y - origin.y;
  let localX = dx * cos - dy * sin;
  let localY = dx * sin + dy * cos;
  return (
    localX >= -sprite.width / 2 &&
    localY >= -sprite.height / 2 &&
    localX < sprite.width / 2 &&
    localY < sprite.height / 2
  );
}

const images = new Map<string, HTMLImageElement>();

function loadedImage(src: string): HTMLImageElement | undefined {
  if (src === "") return;
  let image = images.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    images.set(src, image);
  }
  if (!image.complete || image.naturalWidth === 0) return;
  return image;
}

function drawSprite(context: CanvasRenderingContext2D, sprite: Sprite) {
  let origin = center(sprite);
  let x = -sprite.width / 2;
  let y = -sprite.height / 2;
  context.save();
  context.translate(origin.x, origin.y);
  context.rotate(radians(sprite.rotation));

  let image = loadedImage(sprite.image);
  if (!image) {
    context.fillStyle = sprite.tint;
    context.fillRect(x, y, sprite.width, sprite.height);
    context.restore();
    return;
  }

  context.drawImage(image, x, y, sprite.width, sprite.height);
  context.globalCompositeOperation = "multiply";
  context.fillStyle = sprite.tint;
  context.fillRect(x, y, sprite.width, sprite.height);
  context.globalCompositeOperation = "destination-in";
  context.drawImage(image, x, y, sprite.width, sprite.height);
  context.restore();
}

function selectableAt(point: WorldPoint): GameObject | undefined {
  let hit: GameObject | undefined;
  for (const node of Object.values(scene)) {
    let sprite = isSprite(node);
    if (!sprite) continue;
    if (contains(sprite, point)) hit = gameObject(node);
  }
  return hit;
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
            const drawComponent = createDrawComponent(canvas);
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
                const sprite = isSprite(object);
                if (!sprite) continue;

                const origin = center(sprite);
                drawComponent(
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
              let dx = input.axes.x * SPEED * deltaTime;
              let dy = input.axes.y * SPEED * deltaTime;
              if (dx === 0 && dy === 0) return;
              for (const node of Object.values(scene)) {
                let sprite = isSprite(node);
                let object = gameObject(node);
                if (!sprite || !object) continue;
                object.x = String(sprite.x + dx);
                object.y = String(sprite.y + dy);
              }
            });

            updateLoop.onUpdate(() => {
              const context = view.context;
              for (const sprite of queryScene(scene, isSprite)) {
                drawSprite(context, sprite);
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
              drawComponent.dispose();
            });
          }),
        ]}
      />
    </main>
  );
});
