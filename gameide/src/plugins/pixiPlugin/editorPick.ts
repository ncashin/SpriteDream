import type { Container } from "pixi.js";
import type { World } from "planck";
import { Vec2 } from "planck";
import { getBodyData } from "../planckPlugin/planckBodies.js";
import type { GameObject } from "../../scene/scene.js";
import { getScene } from "../../scene/scene.js";

export type SpriteBindingForPick = {
  root: Container;
  innerSprite: { width: number; height: number };
};

function pickSpriteObjectAtScenePoint(
  sceneContainer: Container,
  scenePoint: { x: number; y: number },
  spriteBindingsBySceneKey: Map<PropertyKey, SpriteBindingForPick>,
): GameObject | null {
  const scene = getScene();
  const children = sceneContainer.children;
  for (let index = children.length - 1; index >= 0; index--) {
    const child = children[index];
    for (const [key, binding] of spriteBindingsBySceneKey) {
      if (binding.root !== child) continue;
      const localPoint = binding.root.toLocal(scenePoint, sceneContainer);
      const halfWidth = binding.innerSprite.width / 2;
      const halfHeight = binding.innerSprite.height / 2;
      if (
        Math.abs(localPoint.x) <= halfWidth &&
        Math.abs(localPoint.y) <= halfHeight
      ) {
        const gameObject = scene.get()[key];
        return gameObject !== undefined ? (gameObject as GameObject) : null;
      }
    }
  }
  return null;
}

function pickColliderObjectAtScenePoint(
  physicsWorld: World,
  scenePoint: { x: number; y: number },
  pixelsPerMeter: number,
): GameObject | null {
  const metersPerPixel = 1 / pixelsPerMeter;
  const pointInMeters = new Vec2(
    scenePoint.x * metersPerPixel,
    scenePoint.y * metersPerPixel,
  );
  let found: GameObject | null = null;
  for (
    let body = physicsWorld.getBodyList();
    body;
    body = body.getNext()
  ) {
    for (
      let fixture = body.getFixtureList();
      fixture;
      fixture = fixture.getNext()
    ) {
      if (fixture.testPoint(pointInMeters)) {
        const gameObject = getBodyData(body);
        if (gameObject) found = gameObject;
      }
    }
  }
  return found;
}

export function pickSceneObjectAtWorldPoint(options: {
  sceneContainer: Container;
  worldPoint: { x: number; y: number };
  spriteBindingsBySceneKey: Map<PropertyKey, SpriteBindingForPick>;
  planckWorld?: World;
  pixelsPerMeter?: number;
}): GameObject | null {
  const fromSprite = pickSpriteObjectAtScenePoint(
    options.sceneContainer,
    options.worldPoint,
    options.spriteBindingsBySceneKey,
  );
  if (fromSprite) return fromSprite;
  if (options.planckWorld) {
    const pixelsPerMeter = options.pixelsPerMeter ?? 30;
    return pickColliderObjectAtScenePoint(
      options.planckWorld,
      options.worldPoint,
      pixelsPerMeter,
    );
  }
  return null;
}
