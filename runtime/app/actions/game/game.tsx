import { clientEntry } from "remix/component";
import type { InferOutput } from "remix/data-schema";
import type { Handle } from "remix/component";

import { SceneViewer } from "../editor/scene-viewer.tsx";
import { blobColor } from "../editor/ui/blobs.tsx";
import { joinRoom } from "../../room/room.tsx";
import { center, contains, lookupBoundingBox } from "../../utilities/bounding-box.ts";
import { createInputMap } from "../../utilities/input.ts";
import { isObject } from "../../utilities/is-object.ts";
import { Mode, setMode } from "../../utilities/mode.ts";
import {
  colliderTrait,
  createPhysics,
  physicsBodyTrait,
} from "../../utilities/physics.ts";
import {
  applyScenePatch,
  diffScene,
  filterScene,
  fetchScene,
  objectAt,
  objectPath,
  scene,
} from "../../utilities/scene.ts";
import {
  selectObjects,
  selectedObjects,
} from "../../utilities/selected-objects.ts";
import { playerColor } from "../../utilities/player-color.ts";
import { createUpdateLoop } from "../../utilities/update-loop.ts";
import { whenImageReady } from "../../utilities/runtime-assets.ts";
import { imageTrait } from "../../utilities/viewport/draw-image.ts";
import { prepareFont, textTrait } from "../../utilities/viewport/draw-text.ts";
import { frameTrait } from "../../utilities/viewport/frame.tsx";
import { transform } from "../../utilities/viewport/transform.ts";
import type { WorldPoint } from "../../utilities/viewport/viewport.ts";
import { createViewport } from "../../utilities/viewport/viewport.ts";

const RUN_SPEED = 280;
const JUMP_SPEED = -560;
const PLAYER_GAP = 40;

function playerKey(id: string) {
  return `player:${id}`;
}

function objectAtPoint(point: WorldPoint) {
  const found = filterScene(scene, (node) => {
    const bounds = lookupBoundingBox(node);
    if (!bounds || !contains(bounds, point)) return;
    return node;
  });
  return found.at(-1);
}

function abortWhenDisconnected(canvas: HTMLCanvasElement) {
  const controller = new AbortController();
  const parent = canvas.parentNode;
  if (!parent) {
    controller.abort();
    return controller.signal;
  }

  const observer = new MutationObserver(() => {
    if (canvas.isConnected) return;
    observer.disconnect();
    controller.abort();
  });
  observer.observe(parent, { childList: true });
  controller.signal.addEventListener("abort", () => observer.disconnect());
  return controller.signal;
}

async function mountGame(canvas: HTMLCanvasElement) {
  const signal = abortWhenDisconnected(canvas);

  const updateLoop = createUpdateLoop({ signal });

  const input = createInputMap(
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
  type Input = InferOutput<typeof input.schema>;

  let previousScene = structuredClone(scene);
  const playerInputs: Record<string, Input> = {};
  const room = joinRoom(signal, {
    messages: { input: input.schema },
    onMessage(message) {
      switch (message.name) {
        case "input":
          playerInputs[message.from] = message.data;
          break;
      }
    },
    onPersonLeave(person) {
      delete playerInputs[person.id];
    },
    onScenePatch(patch) {
      applyScenePatch(patch, scene);
      applyScenePatch(patch, previousScene);
    },
    onModeChange(next) {
      setMode(next);
    },
  });

  let sentInput = "";
  updateLoop.onUpdate(() => {
    input.update();

    if (room.state.mode !== Mode.Play) return;
    const encoded = JSON.stringify(input);
    if (encoded === sentInput) return;
    sentInput = encoded;
    room.send("input", JSON.parse(encoded));
  });

  let playerTemplate: Awaited<ReturnType<typeof fetchScene>> | undefined;

  const spawnPlayers = () => {
    const people = Object.values(room.state.people);
    const live = new Set(people.map((person) => playerKey(person.id)));

    for (const key of Object.keys(scene)) {
      if (key.startsWith("player:") && !live.has(key)) delete scene[key];
    }

    people.forEach((person, index) => {
      const key = playerKey(person.id);
      if (scene[key] || !isObject(playerTemplate?.player)) return;

      const player = structuredClone(playerTemplate.player);

      const playerTransform = transform(player);

      playerTransform.position.x = 400 + index * PLAYER_GAP;
      playerTransform.position.y = 524;

      if (isObject(player.image)) {
        player.image.tint = `${playerColor(person.id)}ff`;
      }

      scene[key] = player;
    });
  };

  const physics = createPhysics();
  updateLoop.onUpdate(() => {
    if (room.state.mode !== Mode.Play || !room.isHost) return;

    spawnPlayers();

    for (const person of Object.values(room.state.people)) {
      const player = physicsBodyTrait(scene[playerKey(person.id)]);
      if (!player) continue;

      const controls =
        person.id === room.you ? input : playerInputs[person.id];
      const axis = Math.max(-1, Math.min(1, controls?.axes.x ?? 0));
      player.physicsBody.velocity.x = axis * RUN_SPEED;

      const grounded = physics
        .contacts()
        .some(({ a, b, normalY, touching }) => {
          if (!touching) return false;
          if (a === player) return normalY > 0.5;
          if (b === player) return normalY < -0.5;
          return false;
        });

      if (grounded && controls?.buttons.jump.down) {
        player.physicsBody.velocity.y = JUMP_SPEED;
      }
    }
  });

  updateLoop.onUpdate(({ deltaTime }) => {
    if (room.state.mode !== Mode.Play || !room.isHost) return;

    physics.beginFrame(deltaTime);

    for (const object of filterScene(
      scene,
      (node) => physicsBodyTrait(node) || colliderTrait(node),
    )) {
      physics.simulate(object);
    }

    physics.endFrame();
  });

  const selectionPaths = () =>
    [...selectedObjects].flatMap((object) => {
      const path = objectPath(scene, object);
      return path ? [path] : [];
    });

  let previousSelection = selectionPaths();

  updateLoop.onUpdate(() => {
    const patch = diffScene(previousScene, scene);
    const selection = selectionPaths();
    if (patch.length === 0) {
      previousSelection = selection;
      return;
    }

    applyScenePatch(patch, previousScene);
    previousSelection = selection;
    room.sendScenePatch(patch);
  });

  let sentSelection = "";
  const editorViewport = createViewport(canvas, {
    signal,
    onWorldHover(point) {
      canvas.style.cursor = objectAtPoint(point) ? "pointer" : "";
    },
    onWorldClick(point) {
      const node = objectAtPoint(point);
      selectObjects(node === undefined ? [] : [node]);
    },
  });

  updateLoop.onUpdate(() => {
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

    for (const object of selectedObjects) {
      editorViewport.drawBoundingBox(object);
    }

    for (const person of Object.values(room.state.people)) {
      if (person.id === room.you) continue;

      const color = blobColor(person.id);

      let look: { x: number; y: number } | undefined;
      for (const path of person.selectedObjects ?? []) {
        const object = objectAt(scene, path);

        if (!object) continue;

        editorViewport.drawBoundingBox(object, {
          color,
          handles: false,
        });
        if (!look) {
          const bounds = lookupBoundingBox(object);
          if (bounds) look = center(bounds);
        }
      }

      if (person.cursor) editorViewport.drawCursor(person.cursor, person.id, look);
    }

    room.sendCursor(editorViewport.state.cursorPoint);
    const paths = selectionPaths();
    const selection = JSON.stringify(paths);
    if (selection !== sentSelection) {
      sentSelection = selection;
      room.sendSelectedObjects(paths);
    }
  });

  const images = filterScene(scene, imageTrait).map((image) => whenImageReady(image.image.image));
  const fonts = filterScene(scene, textTrait).map((text) => prepareFont(text.text.font));
  playerTemplate = await fetchScene("Player");
  await Promise.all([document.fonts.ready, ...images, ...fonts]);
  updateLoop.start();
}

export const Game = clientEntry(import.meta.url, function Game(_handle: Handle) {
  return () => <SceneViewer onMount={(canvas) => void mountGame(canvas)} />;
});
