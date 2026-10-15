import { routes } from "../routes.ts";

export type SceneNode = string | DOMMatrix | { [name: string]: SceneNode };

export function createScene(): { [name: string]: SceneNode } {
  return {
    square: {
      transform: new DOMMatrix().translate(350, 300),
      image: {
        width: "64",
        height: "64",
        tint: "#f4f4f5ff",
        image: "default.png",
      },
      booleanValue: "true",
      physicsBody: {
        body: "dynamic",
        density: "1",
        fixedRotation: "false",
        gravity: "9.8",
        velocity: { x: "0", y: "0" },
      },
      collider: {
        friction: "0.4",
        restitution: "0.2",
      },
      propagateCollision: "true",
    },
    ground: {
      transform: new DOMMatrix().translate(400, 560),
      image: {
        width: "720",
        height: "24",
        tint: "#a1a1aaff",
        image: "default.png",
      },
      collider: {
        friction: "0.6",
        restitution: "0",
      },
    },
    rectangle: {
      transform: new DOMMatrix().translate(80, 60),
      image: {
        width: "96",
        height: "48",
        tint: "#d4d4d8ff",
        image: "default.png",
      },
      collider: {
        friction: "0.4",
        restitution: "0.2",
      },
      parent: "square",
    },
    panel: {
      transform: new DOMMatrix().translate(560, 160),
      frame: {
        frameSource: routes.game.panel.href(),
        width: "220",
        height: "120",
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

export function queryScene<Result>(
  scene: { [name: string]: SceneNode },
  check: (value: SceneNode) => Result,
): NonNullable<Result>[] {
  return Object.values(scene)
    .map(check)
    .filter((node): node is NonNullable<Result> => node != null);
}
