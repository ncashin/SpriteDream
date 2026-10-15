import type { IconNode } from "lucide";
import Atom from "lucide/dist/esm/icons/atom.mjs";
import AppWindow from "lucide/dist/esm/icons/app-window.mjs";
import ImageIcon from "lucide/dist/esm/icons/image.mjs";
import Square from "lucide/dist/esm/icons/square.mjs";
import Type from "lucide/dist/esm/icons/type.mjs";

import { routes } from "../routes.ts";

export type SceneNode = string | DOMMatrix | IconNode | { [name: string]: SceneNode };

export function createScene(): { [name: string]: SceneNode } {
  return {
    square: {
      transform: new DOMMatrix().translate(350, 180),
      image: {
        __icon: ImageIcon,
        width: "64",
        height: "64",
        tint: "#f4f4f5ff",
        image: "default.png",
      },
      booleanValue: "true",
      physicsBody: {
        __icon: Atom,
        body: "dynamic",
        density: "1",
        fixedRotation: "false",
        gravity: "9.8",
        velocity: { x: "0", y: "0" },
      },
      collider: {
        __icon: Square,
        width: "64",
        height: "64",
        friction: "0.4",
        restitution: "0.2",
        propagateCollision: "true",
      },
    },
    ground: {
      transform: new DOMMatrix().translate(400, 560),
      image: {
        __icon: ImageIcon,
        width: "720",
        height: "24",
        tint: "#a1a1aaff",
        image: "default.png",
      },
      collider: {
        __icon: Square,
        width: "720",
        height: "24",
        friction: "0.6",
        restitution: "0",
      },
    },
    rectangle: {
      transform: new DOMMatrix().translate(70, 80).rotateSelf(25),
      image: {
        __icon: ImageIcon,
        width: "36",
        height: "36",
        tint: "#d4d4d8ff",
        image: "default.png",
      },
      collider: {
        __icon: Square,
        width: "36",
        height: "36",
        friction: "0.05",
        restitution: "0.4",
      },
      parent: "square",
    },
    panel: {
      transform: new DOMMatrix().translate(560, 160),
      frame: {
        __icon: AppWindow,
        frameSource: routes.game.panel.href(),
        width: "220",
        height: "120",
      },
      collider: {
        __icon: Square,
        width: "220",
        height: "120",
        friction: "0.4",
        restitution: "0",
      },
    },
    label: {
      transform: new DOMMatrix().translate(400, 40),
      text: {
        __icon: Type,
        value: "Spritedream",
        font: "/fonts/Ethnocentric Rg.otf",
        fontSize: "32",
        color: "#f4f4f5ff",
      },
    },
    key: "property",
    test: { nested: { objects: "hello"}},
  };
}

export const scene = createScene();

let snapshot: { [name: string]: SceneNode } | undefined;

export function snapshotScene() {
  snapshot = structuredClone(scene);
}

export function restoreScene() {
  if (!snapshot) return;
  for (const key of Object.keys(scene)) delete scene[key];
  Object.assign(scene, structuredClone(snapshot));
}

export function filterScene<Result>(
  scene: { [name: string]: SceneNode },
  check: (value: SceneNode) => Result,
): NonNullable<Result>[] {
  return Object.values(scene)
    .map(check)
    .filter((node): node is NonNullable<Result> => node != null);
}
