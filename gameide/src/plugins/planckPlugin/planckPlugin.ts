import {
  type Body,
  type BodyType,
  type Contact,
  type Fixture,
  Settings,
  World,
  Vec2,
} from "planck";
import { update, start, gameUpdate } from "../../lifecycle/gameloop.js";
import type { Plugin } from "../../lifecycle/plugin.js";
import { peerIntegratesPhysicsForObject } from "../networkingPlugin/distributedSimulation.js";
import type { BaseSceneObject } from "../../scene/scene.js";
import { getScene } from "../../scene/scene.js";
import { query } from "../../scene/query/query.js";
import {
  colliderSignature,
  createBodyForObject,
  getBodyData,
  isColliderNode,
  sceneVec,
  type PlanckRecord,
} from "./planckBodies.js";
import { wrapRigidbody2D, type Rigidbody2D } from "./rigidbody2d.js";

export function getSceneBodyType(obj: BaseSceneObject): BodyType {
  const raw = (obj as { collisionBody?: { type?: BodyType } }).collisionBody;
  const t = raw?.type;
  if (t === "static" || t === "kinematic" || t === "dynamic") return t;
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
  const sceneT = getSceneBodyType(obj);
  if (sceneT === "dynamic" && !simulatesDynamics(obj)) return "kinematic";
  return sceneT;
}

export type PlanckPluginOptions = {
  lengthUnitsPerMeter?: number;
  gravity?: { x: number; y: number };
  simulatesDynamics?: (obj: BaseSceneObject) => boolean;
};

type PlanckPluginNetworkingContext = {
  networking?: { peerId: string };
  dispose: (fn: () => void) => void;
};

export type PlanckContactPhase = "enter" | "exit";
export type PlanckCallbackEvent = {
  phase: PlanckContactPhase;
  self: BaseSceneObject;
  other: BaseSceneObject;
  contact: Contact;
  selfFixture: Fixture;
  otherFixture: Fixture;
};

export type PlanckCollisionHandler = (
  other: BaseSceneObject,
  e: PlanckCallbackEvent,
) => void;

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
    Settings.lengthUnitsPerMeter = options.lengthUnitsPerMeter ?? 64;
    const g = options.gravity ?? { x: 0, y: 0 };
    const world = new World({
      gravity: sceneVec(g.x, g.y),
    });

    const objectToRecord = new Map<BaseSceneObject, PlanckRecord>();
    /** Last scene pose before the current step — used to set Planck velocities on kinematic bodies. */
    const kinematicScenePosePrev = new WeakMap<
      BaseSceneObject,
      { x: number; y: number; angle: number }
    >();
    const collisionHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();
    const triggerHandlers = new Map<BaseSceneObject, Set<PlanckCollisionHandler>>();

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
      position.x = physicsPosition.x;
      position.y = physicsPosition.y;
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
      collisionBody.velocity.x = linearVelocity.x;
      collisionBody.velocity.y = linearVelocity.y;
      collisionBody.velocity.angular = angularVelocity;
    };

    const addHandler = (
      map: Map<BaseSceneObject, Set<PlanckCollisionHandler>>,
      self: BaseSceneObject,
      handler: PlanckCollisionHandler,
    ) => {
      let set = map.get(self);
      if (!set) {
        set = new Set();
        map.set(self, set);
      }
      set.add(handler);
      return () => {
        set?.delete(handler);
        if (set && set.size === 0) {
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
      otherFixture: Fixture,
    ) => {
      const set = map.get(self);
      if (!set) return;
      const e: PlanckCallbackEvent = {
        phase,
        self,
        other,
        contact,
        selfFixture,
        otherFixture,
      };
      for (const fn of set) {
        try {
          fn(other, e);
        } catch (err) {
          console.error("planckPlugin handler error", err);
        }
      }
    };

    const runContact = (contact: Contact, phase: PlanckContactPhase) => {
      const bodyA = contact.getFixtureA().getBody();
      const bodyB = contact.getFixtureB().getBody();
      const a = getBodyData(bodyA);
      const b = getBodyData(bodyB);
      if (!a || !b || a === b) return;
      const fa = contact.getFixtureA();
      const fb = contact.getFixtureB();
      const isTrigger = fa.isSensor() || fb.isSensor();
      if (isTrigger) {
        notifyContactHandlers(triggerHandlers, a, b, phase, contact, fa, fb);
        notifyContactHandlers(triggerHandlers, b, a, phase, contact, fb, fa);
      } else {
        notifyContactHandlers(collisionHandlers, a, b, phase, contact, fa, fb);
        notifyContactHandlers(collisionHandlers, b, a, phase, contact, fb, fa);
      }
    };

    const onBegin = (c: Contact) => runContact(c, "enter");
    const onEnd = (c: Contact) => runContact(c, "exit");

    world.on("begin-contact", onBegin);
    world.on("end-contact", onEnd);
    const onRemoveBody = (b: Body) => {
      const o = getBodyData(b);
      if (o) {
        objectToRecord.delete(o);
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
          sceneVec(scenePosition.x, scenePosition.y),
          sceneAngleRadians,
        );

        if (bodyType !== "kinematic") continue;

        const useReplicatedDynamicVelocity =
          getSceneBodyType(sceneObject) === "dynamic" && !simulatesDynamics(sceneObject);
        if (useReplicatedDynamicVelocity) {
          const v = readCollisionBodyVelocity(sceneObject);
          planckRecord.body.setLinearVelocity(new Vec2(v.x, v.y));
          planckRecord.body.setAngularVelocity(v.angular);
        } else {
          const previousScenePose = kinematicScenePosePrev.get(sceneObject);
          if (previousScenePose && physicsStepSeconds > 0) {
            planckRecord.body.setLinearVelocity(
              new Vec2(
                (scenePosition.x - previousScenePose.x) * inverseDeltaTime,
                (scenePosition.y - previousScenePose.y) * inverseDeltaTime,
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
          sceneVec(scenePosition.x, scenePosition.y),
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
          sceneVec(scenePosition.x, scenePosition.y),
          sceneAngleRadians,
        );

        const authoredVelocity = readCollisionBodyVelocity(sceneObject);
        planckRecord.body.setLinearVelocity(
          new Vec2(authoredVelocity.x, authoredVelocity.y),
        );
        planckRecord.body.setAngularVelocity(authoredVelocity.angular);
      }
    };

    const syncDynamicBodiesToSceneAfterPhysicsStep = () => {
      for (const [sceneObject, planckRecord] of objectToRecord) {
        if (effectiveType(sceneObject) !== "dynamic") continue;

        writeDynamicPhysicsResultsToScene(
          sceneObject,
          planckRecord.body.getPosition(),
          planckRecord.body.getAngle(),
          planckRecord.body.getLinearVelocity(),
          planckRecord.body.getAngularVelocity(),
        );
      }
    };

    const api: PlanckPluginAPI = {
      world,
      onCollision: (self, handler) => addHandler(collisionHandlers, self, handler),
      onTrigger: (self, handler) => addHandler(triggerHandlers, self, handler),
      getRigidbody: (self) => {
        const b = objectToRecord.get(self)?.body;
        return b ? wrapRigidbody2D(b) : null;
      },
      getBody: (self) => objectToRecord.get(self)?.body ?? null,
      getBodyType: (self) => getSceneBodyType(self),
      isStatic: (self) => sceneBodyIsStatic(self),
      isKinematic: (self) => sceneBodyIsKinematic(self),
      isDynamic: (self) => sceneBodyIsDynamic(self),
    };

    context.dispose(() => {
      world.off("begin-contact", onBegin);
      world.off("end-contact", onEnd);
      world.off("remove-body", onRemoveBody);
      let bodyList = world.getBodyList();
      while (bodyList) {
        const next = bodyList.getNext();
        world.destroyBody(bodyList);
        bodyList = next;
      }
      collisionHandlers.clear();
      triggerHandlers.clear();
    });

    let disposed = false;
    let physicsGameUpdateRegistered = false;
    update(() => {
      if (disposed) return;
      syncColliderBodiesWithSceneGraph();
    });

    start(() => {
      if (physicsGameUpdateRegistered) return;
      physicsGameUpdateRegistered = true;
      gameUpdate((deltaTime) => {
        if (disposed) return;
        const clampedDeltaSeconds = Math.min(deltaTime, 0.1);

        syncColliderBodiesWithSceneGraph();

        syncStaticAndKinematicBodiesFromSceneBeforePhysicsStep(clampedDeltaSeconds);

        syncDynamicBodiesFromSceneBeforePhysicsStep();

        world.step(clampedDeltaSeconds, 8, 3);

        syncDynamicBodiesToSceneAfterPhysicsStep();

        syncStaticAndKinematicBodiesFromSceneAfterPhysicsStep();
      });
    });

    return { ...context, planck: api };
  };
}
