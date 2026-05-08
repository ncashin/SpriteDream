import {
  type Body,
  type BodyType,
  type Contact,
  type Fixture,
  Settings,
  World,
  Vec2,
  WorldManifold,
} from "planck";
import { update, start, gameUpdate } from "../../lifecycle/gameloop.js";
import { GameIDEMode, getMode } from "../../lifecycle/mode.js";
import { getGameContext } from "../../lifecycle/initialization.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import { peerIntegratesPhysicsForObject } from "../networkingPlugin/distributedSimulation.js";
import type { BaseSceneObject } from "../../scene/scene.js";
import { getScene } from "../../scene/scene.js";
import {
  hasSceneAddition,
  registerSceneAddition,
} from "../../scene/sceneAdditions/sceneAdditions.js";
import { query } from "../../scene/query/query.js";
import {
  colliderSignature,
  createBodyForObject,
  getBodyData,
  isColliderNode,
  type PlanckRecord,
} from "./planckBodies.js";
import { wrapRigidbody2D, type Rigidbody2D } from "./rigidbody2d.js";

export function getSceneBodyType(obj: BaseSceneObject): BodyType {
  const raw = (obj as { collisionBody?: { type?: BodyType } }).collisionBody;
  const declaredType = raw?.type;
  if (
    declaredType === "static" ||
    declaredType === "kinematic" ||
    declaredType === "dynamic"
  ) {
    return declaredType;
  }
  return "static";
}

export function sceneBodyIsStatic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "static";
}

export function sceneBodyIsKinematic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "kinematic";
}

export function sceneBodyIsDynamic(obj: BaseSceneObject): boolean {
  return getSceneBodyType(obj) === "dynamic";
}

export function getEffectivePlanckBodyType(
  obj: BaseSceneObject,
  simulatesDynamics: (obj: BaseSceneObject) => boolean,
): BodyType {
  const sceneBodyType = getSceneBodyType(obj);
  if (sceneBodyType === "dynamic" && !simulatesDynamics(obj)) return "kinematic";
  return sceneBodyType;
}

export type PlanckPluginOptions = {
  pixelsPerMeter?: number;
  lengthUnitsPerMeter?: number;
  gravity?: { x: number; y: number };
  jitterThreshold?: number;
  simulatesDynamics?: (obj: BaseSceneObject) => boolean;
};

type PlanckPluginNetworkingContext = {
  networking?: { peerId: string };
  dispose: (fn: () => void) => void;
};

export type PlanckContactPhase = "enter" | "exit";

export type PlanckCollisionInfo = {
  phase: PlanckContactPhase;
  self: BaseSceneObject;
  normal?: { x: number; y: number };
};

export type PlanckCollisionHandler = (
  other: BaseSceneObject,
  collisionInfo: PlanckCollisionInfo,
) => void;

export type PlanckSceneCollisionBindings = {
  onCollision: (handler: PlanckCollisionHandler) => () => void;
};

declare module "../../scene/scene.js" {
  interface SceneNodeVirtualProperties extends PlanckSceneCollisionBindings {}
}

export type PlanckPluginAPI = {
  world: World;
  onCollision: (self: BaseSceneObject, handler: PlanckCollisionHandler) => () => void;
  onTrigger: (self: BaseSceneObject, handler: PlanckCollisionHandler) => () => void;
  getRigidbody: (self: BaseSceneObject) => Rigidbody2D | null;
  getBody: (self: BaseSceneObject) => Body | null;
  getBodyType: (self: BaseSceneObject) => BodyType;
  isStatic: (self: BaseSceneObject) => boolean;
  isKinematic: (self: BaseSceneObject) => boolean;
  isDynamic: (self: BaseSceneObject) => boolean;
};

export function planckPlugin(
  options: PlanckPluginOptions = {},
): Plugin<PlanckPluginNetworkingContext, { planck: PlanckPluginAPI }> {
  return (context) => {
    const networking = context.networking;
    const simulatesDynamics =
      options.simulatesDynamics ??
      (networking
        ? (obj: BaseSceneObject) =>
            peerIntegratesPhysicsForObject(obj, networking.peerId)
        : () => true);

    const effectiveType = (obj: BaseSceneObject) =>
      getEffectivePlanckBodyType(obj, simulatesDynamics);
    const pixelsPerMeter =
      typeof options.pixelsPerMeter === "number" &&
      Number.isFinite(options.pixelsPerMeter) &&
      options.pixelsPerMeter > 0
        ? options.pixelsPerMeter
        : 30;
    Settings.lengthUnitsPerMeter = options.lengthUnitsPerMeter ?? 1;
    const invPpm = 1 / pixelsPerMeter;
    const gravity = options.gravity ?? { x: 0, y: 0 };
    const jitterThreshold =
      typeof options.jitterThreshold === "number" &&
      Number.isFinite(options.jitterThreshold) &&
      options.jitterThreshold > 0
        ? options.jitterThreshold
        : undefined;
    const world = new World({
      gravity: new Vec2(gravity.x, gravity.y),
    });

    const objectToRecord = new Map<BaseSceneObject, PlanckRecord>();
    const kinematicScenePosePrev = new WeakMap<
      BaseSceneObject,
      { x: number; y: number; angle: number }
    >();
    const collisionHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();
    const triggerHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();
    const collisionWorldManifold = new WorldManifold();

    type ScenePosition = { x: number; y: number };
    type SceneRotation = { x?: number; y?: number; z: number };
    type CollisionBodyVelocity = { x: number; y: number; angular: number };

    const readScenePosition = (sceneObject: BaseSceneObject): ScenePosition =>
      (sceneObject as { position: ScenePosition }).position;

    const readSceneRotation = (sceneObject: BaseSceneObject): SceneRotation =>
      (sceneObject as { rotation: SceneRotation }).rotation;

    const readSceneAngleRadians = (sceneObject: BaseSceneObject): number =>
      readSceneRotation(sceneObject).z;

    const readCollisionBodyVelocity = (
      sceneObject: BaseSceneObject,
    ): CollisionBodyVelocity => {
      const velocity =
        (sceneObject as { collisionBody?: { velocity?: Partial<CollisionBodyVelocity> } })
          .collisionBody?.velocity ?? {};
      return {
        x: velocity.x ?? 0,
        y: velocity.y ?? 0,
        angular: velocity.angular ?? 0,
      };
    };

    const writeDynamicPhysicsResultsToScene = (
      sceneObject: BaseSceneObject,
      physicsPosition: Vec2,
      physicsAngleRadians: number,
      linearVelocity: Vec2,
      angularVelocity: number,
    ): void => {
      const position = readScenePosition(sceneObject);
      position.x = physicsPosition.x * pixelsPerMeter;
      position.y = physicsPosition.y * pixelsPerMeter;
      const rotation = readSceneRotation(sceneObject);
      (sceneObject as { rotation: SceneRotation }).rotation = {
        ...rotation,
        z: physicsAngleRadians,
      };
      const collisionBody = (sceneObject as { collisionBody?: { velocity?: CollisionBodyVelocity } })
        .collisionBody;
      if (!collisionBody) return;
      if (!collisionBody.velocity) {
        collisionBody.velocity = { x: 0, y: 0, angular: 0 };
      }
      collisionBody.velocity.x = linearVelocity.x * pixelsPerMeter;
      collisionBody.velocity.y = linearVelocity.y * pixelsPerMeter;
      collisionBody.velocity.angular = angularVelocity;
    };

    const addHandler = (
      map: Map<BaseSceneObject, Set<PlanckCollisionHandler>>,
      self: BaseSceneObject,
      handler: PlanckCollisionHandler,
    ) => {
      let handlerSet = map.get(self);
      if (!handlerSet) {
        handlerSet = new Set();
        map.set(self, handlerSet);
      }
      handlerSet.add(handler);
      return () => {
        handlerSet?.delete(handler);
        if (handlerSet && handlerSet.size === 0) {
          map.delete(self);
        }
      };
    };

    const notifyContactHandlers = (
      map: Map<BaseSceneObject, Set<PlanckCollisionHandler>>,
      self: BaseSceneObject,
      other: BaseSceneObject,
      phase: PlanckContactPhase,
      contact: Contact,
      selfFixture: Fixture,
    ) => {
      const handlerSet = map.get(self);
      if (!handlerSet) return;
      const worldManifold = contact.getWorldManifold(collisionWorldManifold);
      const manifoldNormal = worldManifold?.normal;
      const selfIsFixtureA = selfFixture === contact.getFixtureA();
      const collisionInfo: PlanckCollisionInfo = {
        phase,
        self,
        normal: manifoldNormal
          ? {
              x: selfIsFixtureA ? -manifoldNormal.x : manifoldNormal.x,
              y: selfIsFixtureA ? -manifoldNormal.y : manifoldNormal.y,
            }
          : undefined,
      };
      for (const handlerFn of handlerSet) {
        try {
          handlerFn(other, collisionInfo);
        } catch (err) {
          console.error("planckPlugin handler error", err);
        }
      }
    };

    const runContact = (contact: Contact, phase: PlanckContactPhase) => {
      const bodyA = contact.getFixtureA().getBody();
      const bodyB = contact.getFixtureB().getBody();
      const bodyDataA = getBodyData(bodyA);
      const bodyDataB = getBodyData(bodyB);
      if (!bodyDataA || !bodyDataB || bodyDataA === bodyDataB) return;
      const fixtureA = contact.getFixtureA();
      const fixtureB = contact.getFixtureB();
      const isTrigger = fixtureA.isSensor() || fixtureB.isSensor();
      if (isTrigger) {
        notifyContactHandlers(triggerHandlers, bodyDataA, bodyDataB, phase, contact, fixtureA);
        notifyContactHandlers(triggerHandlers, bodyDataB, bodyDataA, phase, contact, fixtureB);
      } else {
        notifyContactHandlers(collisionHandlers, bodyDataA, bodyDataB, phase, contact, fixtureA);
        notifyContactHandlers(collisionHandlers, bodyDataB, bodyDataA, phase, contact, fixtureB);
      }
    };

    const onBegin = (contact: Contact) => runContact(contact, "enter");
    const onEnd = (contact: Contact) => runContact(contact, "exit");

    world.on("begin-contact", onBegin);
    world.on("end-contact", onEnd);
    const onRemoveBody = (body: Body) => {
      const sceneObjectFromBody = getBodyData(body);
      if (sceneObjectFromBody) {
        collisionHandlers.delete(sceneObjectFromBody);
        triggerHandlers.delete(sceneObjectFromBody);
        kinematicScenePosePrev.delete(sceneObjectFromBody);
        objectToRecord.delete(sceneObjectFromBody);
      }
    };
    world.on("remove-body", onRemoveBody);

    const syncColliderBodiesWithSceneGraph = () => {
      const scene = getScene();
      const collidersInScene = query(scene, isColliderNode);
      const collidersStillPresent = new Set<BaseSceneObject>();

      for (const sceneObject of collidersInScene) {
        collidersStillPresent.add(sceneObject);
        const effectiveBodyType = effectiveType(sceneObject);
        const nextColliderSignature = colliderSignature(sceneObject, effectiveBodyType);
        if (!nextColliderSignature) continue;

        const existingPlanckRecord = objectToRecord.get(sceneObject);
        if (existingPlanckRecord) {
          if (existingPlanckRecord.signature === nextColliderSignature) continue;
          world.destroyBody(existingPlanckRecord.body);
        }

        const createdPlanckRecord = createBodyForObject(
          world,
          sceneObject,
          effectiveBodyType,
          pixelsPerMeter,
        );
        if (createdPlanckRecord) {
          objectToRecord.set(sceneObject, createdPlanckRecord);
        }
      }

      const sceneObjectsToRemove: BaseSceneObject[] = [];
      for (const trackedSceneObject of objectToRecord.keys()) {
        if (!collidersStillPresent.has(trackedSceneObject)) {
          sceneObjectsToRemove.push(trackedSceneObject);
        }
      }
      for (const sceneObjectToRemove of sceneObjectsToRemove) {
        const planckRecord = objectToRecord.get(sceneObjectToRemove);
        if (planckRecord) {
          world.destroyBody(planckRecord.body);
        }
        objectToRecord.delete(sceneObjectToRemove);
      }
    };

    const syncStaticAndKinematicBodiesFromSceneBeforePhysicsStep = (
      physicsStepSeconds: number,
    ) => {
      const inverseDeltaTime = physicsStepSeconds > 0 ? 1 / physicsStepSeconds : 0;

      for (const [sceneObject, planckRecord] of objectToRecord) {
        const bodyType = effectiveType(sceneObject);
        if (bodyType !== "static" && bodyType !== "kinematic") continue;

        const scenePosition = readScenePosition(sceneObject);
        const sceneAngleRadians = readSceneAngleRadians(sceneObject);
        planckRecord.body.setTransform(
          new Vec2(scenePosition.x * invPpm, scenePosition.y * invPpm),
          sceneAngleRadians,
        );

        if (bodyType !== "kinematic") continue;

        const useReplicatedDynamicVelocity =
          getSceneBodyType(sceneObject) === "dynamic" && !simulatesDynamics(sceneObject);
        if (useReplicatedDynamicVelocity) {
          const collisionVelocity = readCollisionBodyVelocity(sceneObject);
          planckRecord.body.setLinearVelocity(
            new Vec2(collisionVelocity.x * invPpm, collisionVelocity.y * invPpm),
          );
          planckRecord.body.setAngularVelocity(collisionVelocity.angular);
        } else {
          const previousScenePose = kinematicScenePosePrev.get(sceneObject);
          if (previousScenePose && physicsStepSeconds > 0) {
            planckRecord.body.setLinearVelocity(
              new Vec2(
                ((scenePosition.x - previousScenePose.x) * inverseDeltaTime) * invPpm,
                ((scenePosition.y - previousScenePose.y) * inverseDeltaTime) * invPpm,
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
        kinematicScenePosePrev.set(sceneObject, {
          x: scenePosition.x,
          y: scenePosition.y,
          angle: sceneAngleRadians,
        });
      }
    };

    const syncStaticAndKinematicBodiesFromSceneAfterPhysicsStep = () => {
      for (const [sceneObject, planckRecord] of objectToRecord) {
        const bodyType = effectiveType(sceneObject);
        if (bodyType !== "static" && bodyType !== "kinematic") continue;

        const scenePosition = readScenePosition(sceneObject);
        const sceneAngleRadians = readSceneAngleRadians(sceneObject);
        planckRecord.body.setTransform(
          new Vec2(scenePosition.x * invPpm, scenePosition.y * invPpm),
          sceneAngleRadians,
        );
      }
    };

    const syncDynamicBodiesFromSceneBeforePhysicsStep = () => {
      for (const [sceneObject, planckRecord] of objectToRecord) {
        if (effectiveType(sceneObject) !== "dynamic") continue;

        const scenePosition = readScenePosition(sceneObject);
        const sceneAngleRadians = readSceneAngleRadians(sceneObject);
        planckRecord.body.setTransform(
          new Vec2(scenePosition.x * invPpm, scenePosition.y * invPpm),
          sceneAngleRadians,
        );

        const authoredVelocity = readCollisionBodyVelocity(sceneObject);
        planckRecord.body.setLinearVelocity(
          new Vec2(authoredVelocity.x * invPpm, authoredVelocity.y * invPpm),
        );
        planckRecord.body.setAngularVelocity(authoredVelocity.angular);
      }
    };

    const syncDynamicBodiesToSceneAfterPhysicsStep = () => {
      for (const [sceneObject, planckRecord] of objectToRecord) {
        if (effectiveType(sceneObject) !== "dynamic") continue;

        const body = planckRecord.body;
        const linearVelocity = body.getLinearVelocity();
        let lvX = linearVelocity.x;
        let lvY = linearVelocity.y;
        if (jitterThreshold !== undefined) {
          const speedPx = Math.hypot(lvX * pixelsPerMeter, lvY * pixelsPerMeter);
          if (speedPx <= jitterThreshold) {
            lvX = 0;
            lvY = 0;
            body.setLinearVelocity(new Vec2(0, 0));
          }
        }

        writeDynamicPhysicsResultsToScene(
          sceneObject,
          body.getPosition(),
          body.getAngle(),
          new Vec2(lvX, lvY),
          body.getAngularVelocity(),
        );
      }
    };

    const api: PlanckPluginAPI = {
      world,
      onCollision: (self, handler) => addHandler(collisionHandlers, self, handler),
      onTrigger: (self, handler) => addHandler(triggerHandlers, self, handler),
      getRigidbody: (self) => {
        const planckBody = objectToRecord.get(self)?.body;
        return planckBody ? wrapRigidbody2D(planckBody, pixelsPerMeter) : null;
      },
      getBody: (self) => objectToRecord.get(self)?.body ?? null,
      getBodyType: (self) => getSceneBodyType(self),
      isStatic: (self) => sceneBodyIsStatic(self),
      isKinematic: (self) => sceneBodyIsKinematic(self),
      isDynamic: (self) => sceneBodyIsDynamic(self),
    };

    if (!hasSceneAddition("onCollision")) {
      registerSceneAddition(
        "onCollision",
        (sceneNode: BaseSceneObject) => (handler: PlanckCollisionHandler) => {
          const { planck } = getGameContext() as { planck?: PlanckPluginAPI };
          if (!planck) {
            throw new Error(
              'Scene addition "onCollision" requires planckPlugin to be installed.',
            );
          }
          return planck.onCollision(sceneNode, handler);
        },
      );
    }

    context.dispose(() => {
      world.off("begin-contact", onBegin);
      world.off("end-contact", onEnd);
      world.off("remove-body", onRemoveBody);
      let bodyList = world.getBodyList();
      while (bodyList) {
        const nextBody = bodyList.getNext();
        world.destroyBody(bodyList);
        bodyList = nextBody;
      }
      collisionHandlers.clear();
      triggerHandlers.clear();
    });

    let disposed = false;
    let physicsGameUpdateRegistered = false;
    update(() => {
      if (disposed) return;
      if (getMode() !== GameIDEMode.Game) return;
      syncColliderBodiesWithSceneGraph();
    });

    start(() => {
      if (physicsGameUpdateRegistered) return;
      physicsGameUpdateRegistered = true;
      gameUpdate((deltaTime) => {
        if (disposed) return;
        if (getMode() !== GameIDEMode.Game) return;
        const clampedDeltaSeconds = Math.min(deltaTime, 0.1);

        syncColliderBodiesWithSceneGraph();

        syncStaticAndKinematicBodiesFromSceneBeforePhysicsStep(clampedDeltaSeconds);

        syncDynamicBodiesFromSceneBeforePhysicsStep();

        world.step(clampedDeltaSeconds, 12, 4);

        syncDynamicBodiesToSceneAfterPhysicsStep();

        syncStaticAndKinematicBodiesFromSceneAfterPhysicsStep();
      });
    });

    return { ...context, planck: api };
  };
}
