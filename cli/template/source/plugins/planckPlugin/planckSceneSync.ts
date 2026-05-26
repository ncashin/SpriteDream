import type { BodyType, Vec2 as Vec2T } from "planck";
import { Vec2 } from "planck";
import type { GameObject, Scene } from "gameide";
import {
  syncBodyTransformFromObject,
  type PlanckRecord,
} from "./planckBodies.js";
import { getSceneBodyType } from "./planckBodyTypes.js";

type ScenePosition = { x: number; y: number };
type SceneRotation = { x?: number; y?: number; z: number };
type CollisionBodyVelocity = { x: number; y: number; angular: number };

export type PlanckSceneSyncContext = {
  scene: Scene;
  sceneKeyToPlanckRecord: Map<PropertyKey, PlanckRecord>;
  effectiveType: (object: GameObject) => BodyType;
  invPpm: number;
  pixelsPerMeter: number;
  jitterThreshold?: number;
  simulatesDynamics: (object: GameObject) => boolean;
  kinematicScenePosePrev: WeakMap<GameObject, { x: number; y: number; angle: number }>;
};

function finiteNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readScenePosition(sceneObject: GameObject): ScenePosition {
  const position = (sceneObject as { position?: Partial<ScenePosition> }).position;
  return {
    x: finiteNumberOr(position?.x, 0),
    y: finiteNumberOr(position?.y, 0),
  };
}

function readSceneRotation(sceneObject: GameObject): SceneRotation {
  const rotation = (sceneObject as { rotation?: Partial<SceneRotation> }).rotation;
  return {
    x: finiteNumberOr(rotation?.x, 0),
    y: finiteNumberOr(rotation?.y, 0),
    z: finiteNumberOr(rotation?.z, 0),
  };
}

function readSceneAngleRadians(sceneObject: GameObject): number {
  return readSceneRotation(sceneObject).z;
}

function readCollisionBodyVelocity(sceneObject: GameObject): CollisionBodyVelocity {
  const velocity =
    (
      sceneObject as {
        collisionBody?: { velocity?: Partial<CollisionBodyVelocity> };
      }
    ).collisionBody?.velocity ?? {};
  return {
    x: velocity.x ?? 0,
    y: velocity.y ?? 0,
    angular: velocity.angular ?? 0,
  };
}

function writeDynamicPhysicsResultsToScene(
  ctx: PlanckSceneSyncContext,
  sceneObject: GameObject,
  physicsPosition: Vec2T,
  physicsAngleRadians: number,
  linearVelocity: Vec2T,
  angularVelocity: number,
): void {
  let position = (sceneObject as { position?: ScenePosition }).position;
  if (!position) {
    (sceneObject as { position: ScenePosition }).position = {
      x: physicsPosition.x * ctx.pixelsPerMeter,
      y: physicsPosition.y * ctx.pixelsPerMeter,
    };
  } else {
    position.x = physicsPosition.x * ctx.pixelsPerMeter;
    position.y = physicsPosition.y * ctx.pixelsPerMeter;
  }
  const rotation = readSceneRotation(sceneObject);
  (sceneObject as { rotation: SceneRotation }).rotation = {
    ...rotation,
    z: physicsAngleRadians,
  };
  const collisionBody = (
    sceneObject as { collisionBody?: { velocity?: CollisionBodyVelocity } }
  ).collisionBody;
  if (!collisionBody) return;
  if (!collisionBody.velocity) {
    collisionBody.velocity = { x: 0, y: 0, angular: 0 };
  }
  collisionBody.velocity.x = linearVelocity.x * ctx.pixelsPerMeter;
  collisionBody.velocity.y = linearVelocity.y * ctx.pixelsPerMeter;
  collisionBody.velocity.angular = angularVelocity;
}

function forEachTracked(
  ctx: PlanckSceneSyncContext,
  visit: (sceneObjectLive: GameObject, planckRecord: PlanckRecord) => void,
): void {
  for (const [sceneOwnedIdentifier, planckRecord] of ctx.sceneKeyToPlanckRecord) {
    const candidateScenePayload = Reflect.get(ctx.scene.get(), sceneOwnedIdentifier);
    if (candidateScenePayload === undefined) continue;
    visit(candidateScenePayload as GameObject, planckRecord);
  }
}

function applyScenePoseToBody(
  sceneObjectLive: GameObject,
  planckRecord: PlanckRecord,
  ctx: PlanckSceneSyncContext,
): void {
  syncBodyTransformFromObject(
    planckRecord.body,
    sceneObjectLive,
    ctx.pixelsPerMeter,
  );
}

export const syncStaticBodies = {
  beforePhysics(ctx: PlanckSceneSyncContext): void {
    forEachTracked(ctx, (object, rec) => {
      if (ctx.effectiveType(object) !== "static") return;
      applyScenePoseToBody(object, rec, ctx);
    });
  },
  afterPhysics(ctx: PlanckSceneSyncContext): void {
    forEachTracked(ctx, (object, rec) => {
      if (ctx.effectiveType(object) !== "static") return;
      applyScenePoseToBody(object, rec, ctx);
    });
  },
} as const;

export const syncKinematicBodies = {
  beforePhysics(ctx: PlanckSceneSyncContext, physicsStepSeconds: number): void {
    const inverseDeltaTime = physicsStepSeconds > 0 ? 1 / physicsStepSeconds : 0;
    forEachTracked(ctx, (sceneObjectLive, planckRecord) => {
      if (ctx.effectiveType(sceneObjectLive) !== "kinematic") return;

      const scenePosition = readScenePosition(sceneObjectLive);
      const sceneAngleRadians = readSceneAngleRadians(sceneObjectLive);
      planckRecord.body.setTransform(
        new Vec2(scenePosition.x * ctx.invPpm, scenePosition.y * ctx.invPpm),
        sceneAngleRadians,
      );

      const useReplicatedDynamicVelocity =
        getSceneBodyType(sceneObjectLive) === "dynamic" &&
        !ctx.simulatesDynamics(sceneObjectLive);
      if (useReplicatedDynamicVelocity) {
        const collisionVelocity = readCollisionBodyVelocity(sceneObjectLive);
        planckRecord.body.setLinearVelocity(
          new Vec2(collisionVelocity.x * ctx.invPpm, collisionVelocity.y * ctx.invPpm),
        );
        planckRecord.body.setAngularVelocity(collisionVelocity.angular);
      } else {
        const previousScenePose = ctx.kinematicScenePosePrev.get(sceneObjectLive);
        if (previousScenePose && physicsStepSeconds > 0) {
          planckRecord.body.setLinearVelocity(
            new Vec2(
              ((scenePosition.x - previousScenePose.x) * inverseDeltaTime) * ctx.invPpm,
              ((scenePosition.y - previousScenePose.y) * inverseDeltaTime) * ctx.invPpm,
            ),
          );
          planckRecord.body.setAngularVelocity(
            (sceneAngleRadians - previousScenePose.angle) * inverseDeltaTime,
          );
        } else {
          planckRecord.body.setLinearVelocity(new Vec2(0, 0));
          planckRecord.body.setAngularVelocity(0);
        }
      }
      ctx.kinematicScenePosePrev.set(sceneObjectLive, {
        x: scenePosition.x,
        y: scenePosition.y,
        angle: sceneAngleRadians,
      });
    });
  },
  afterPhysics(ctx: PlanckSceneSyncContext): void {
    forEachTracked(ctx, (object, rec) => {
      if (ctx.effectiveType(object) !== "kinematic") return;
      applyScenePoseToBody(object, rec, ctx);
    });
  },
} as const;

export const syncDynamicBodies = {
  beforePhysics(ctx: PlanckSceneSyncContext): void {
    forEachTracked(ctx, (sceneObjectLive, planckRecord) => {
      if (ctx.effectiveType(sceneObjectLive) !== "dynamic") return;
      applyScenePoseToBody(sceneObjectLive, planckRecord, ctx);

      const authoredVelocity = readCollisionBodyVelocity(sceneObjectLive);
      planckRecord.body.setLinearVelocity(
        new Vec2(authoredVelocity.x * ctx.invPpm, authoredVelocity.y * ctx.invPpm),
      );
      planckRecord.body.setAngularVelocity(authoredVelocity.angular);
    });
  },
  afterPhysics(ctx: PlanckSceneSyncContext): void {
    forEachTracked(ctx, (sceneObjectLive, planckRecord) => {
      if (ctx.effectiveType(sceneObjectLive) !== "dynamic") return;

      const body = planckRecord.body;
      const linearVelocity = body.getLinearVelocity();
      let lvX = linearVelocity.x;
      let lvY = linearVelocity.y;
      if (ctx.jitterThreshold !== undefined) {
        const speedPx = Math.hypot(lvX * ctx.pixelsPerMeter, lvY * ctx.pixelsPerMeter);
        if (speedPx <= ctx.jitterThreshold) {
          lvX = 0;
          lvY = 0;
          body.setLinearVelocity(new Vec2(0, 0));
        }
      }

      writeDynamicPhysicsResultsToScene(
        ctx,
        sceneObjectLive,
        body.getPosition(),
        body.getAngle(),
        new Vec2(lvX, lvY),
        body.getAngularVelocity(),
      );
    });
  },
} as const;
