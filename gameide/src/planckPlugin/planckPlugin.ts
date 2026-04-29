import {
  type Body,
  type BodyType,
  type Contact,
  type Fixture,
  Settings,
  World,
  Vec2,
} from "planck";
import { update, start, gameUpdate } from "../lifecycle/gameloop.js";
import type { Plugin } from "../lifecycle/plugin.js";
import { peerIntegratesPhysicsForObject } from "../networking/distributedSimulation.js";
import type { BaseSceneObject } from "../scene/scene.js";
import { getScene } from "../scene/scene.js";
import { query } from "../scene/query/query.js";
import {
  getEffectivePlanckBodyType,
  getSceneBodyType,
  sceneBodyIsDynamic,
  sceneBodyIsKinematic,
  sceneBodyIsStatic,
} from "./physicsTypes.js";
import {
  colliderSignature,
  createBodyForObject,
  getBodyData,
  isColliderNode,
  sceneVec,
  type PlanckRecord,
} from "./planckBodies.js";
import { wrapRigidbody2D, type Rigidbody2D } from "./rigidbody2d.js";

export type PlanckPluginOptions = {
  lengthUnitsPerMeter?: number;
  gravity?: { x: number; y: number };
  simulatesDynamics?: (obj: BaseSceneObject) => boolean;
};

type PlanckPluginNetworkingContext = {
  networking?: { peerId: string };
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
  dispose: () => void;
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

    const syncBodiesWithScene = () => {
      const scene = getScene();
      const colliders = query(scene, isColliderNode);
      const alive = new Set<BaseSceneObject>();

      for (const obj of colliders) {
        alive.add(obj);
        const eff = effectiveType(obj);
        const nextSig = colliderSignature(obj, eff);
        if (!nextSig) continue;
        const rec = objectToRecord.get(obj);
        if (rec) {
          if (rec.signature === nextSig) continue;
          world.destroyBody(rec.body);
        }
        const next = createBodyForObject(world, obj, eff);
        if (next) {
          objectToRecord.set(obj, next);
        }
      }

      const toRemove: BaseSceneObject[] = [];
      for (const obj of objectToRecord.keys()) {
        if (!alive.has(obj)) toRemove.push(obj);
      }
      for (const obj of toRemove) {
        const rec = objectToRecord.get(obj);
        if (rec) {
          world.destroyBody(rec.body);
        }
        objectToRecord.delete(obj);
      }
    };

    const syncKinematicAndStaticFromSceneBeforeStep = (stepDt: number) => {
      const invDt = stepDt > 0 ? 1 / stepDt : 0;
      for (const [obj, rec] of objectToRecord) {
        const t = effectiveType(obj);
        if (t !== "static" && t !== "kinematic") continue;
        const pos = (obj as { position: { x: number; y: number } }).position;
        const rotZ = (obj as { rotation: { z: number } }).rotation.z;
        rec.body.setTransform(sceneVec(pos.x, pos.y), rotZ);
        if (t === "kinematic") {
          const prev = kinematicScenePosePrev.get(obj);
          if (prev && stepDt > 0) {
            rec.body.setLinearVelocity(
              new Vec2((pos.x - prev.x) * invDt, (pos.y - prev.y) * invDt),
            );
            rec.body.setAngularVelocity((rotZ - prev.angle) * invDt);
          } else {
            rec.body.setLinearVelocity(new Vec2(0, 0));
            rec.body.setAngularVelocity(0);
          }
          kinematicScenePosePrev.set(obj, { x: pos.x, y: pos.y, angle: rotZ });
        }
      }
    };

    /** After dynamics integrate, snap static/kinematic transforms to scene (transform only). */
    const syncKinematicAndStaticFromSceneAfterStep = () => {
      for (const [obj, rec] of objectToRecord) {
        const t = effectiveType(obj);
        if (t !== "static" && t !== "kinematic") continue;
        const pos = (obj as { position: { x: number; y: number } }).position;
        const rotZ = (obj as { rotation: { z: number } }).rotation.z;
        rec.body.setTransform(sceneVec(pos.x, pos.y), rotZ);
      }
    };

    /** Scene transform → physics before step so inspector/teleports/scripts can move dynamics; otherwise we'd only integrate from last-frame body state. */
    const syncDynamicTransformFromScene = () => {
      for (const [obj, rec] of objectToRecord) {
        if (effectiveType(obj) !== "dynamic") continue;
        const pos = (obj as { position: { x: number; y: number } }).position;
        const rotZ = (obj as { rotation: { z: number } }).rotation.z;
        rec.body.setTransform(sceneVec(pos.x, pos.y), rotZ);
      }
    };

    const syncDynamicVelocityFromScene = () => {
      for (const [obj, rec] of objectToRecord) {
        if (effectiveType(obj) !== "dynamic") continue;
        const vel =
          (obj as { collisionBody?: { velocity?: { x: number; y: number; angular?: number } } })
            .collisionBody?.velocity ?? { x: 0, y: 0, angular: 0 };
        rec.body.setLinearVelocity(new Vec2(vel.x, vel.y));
        rec.body.setAngularVelocity(vel.angular ?? 0);
      }
    };

    const syncDynamicBodiesToScene = () => {
      for (const [obj, rec] of objectToRecord) {
        if (effectiveType(obj) !== "dynamic") continue;
        const p = rec.body.getPosition();
        const a = rec.body.getAngle();
        const v = rec.body.getLinearVelocity();
        const angVel = rec.body.getAngularVelocity();
        (obj as { position: { x: number; y: number } }).position.x = p.x;
        (obj as { position: { x: number; y: number } }).position.y = p.y;
        const rot = (obj as { rotation: { x?: number; y?: number; z: number } }).rotation;
        (obj as { rotation: { x?: number; y?: number; z: number } }).rotation = { ...rot, z: a };
        const cb = (obj as {
          collisionBody?: { velocity?: { x: number; y: number; angular?: number } };
        }).collisionBody;
        if (cb) {
          if (!cb.velocity) cb.velocity = { x: 0, y: 0, angular: 0 };
          cb.velocity.x = v.x;
          cb.velocity.y = v.y;
          cb.velocity.angular = angVel;
        }
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
      dispose: () => {
        world.off("begin-contact", onBegin);
        world.off("end-contact", onEnd);
        world.off("remove-body", onRemoveBody);
        let b = world.getBodyList();
        while (b) {
          const next = b.getNext();
          world.destroyBody(b);
          b = next;
        }
        collisionHandlers.clear();
        triggerHandlers.clear();
      },
    };

    let disposed = false;
    let physicsGameUpdateRegistered = false;
    update(() => {
      if (disposed) return;
      syncBodiesWithScene();
    });

    start(() => {
      if (physicsGameUpdateRegistered) return;
      physicsGameUpdateRegistered = true;
      gameUpdate((dt) => {
        if (disposed) return;
        const clamped = Math.min(dt, 0.1);
        /** After game code mutates `collisionBody` (e.g. `disabled`), pick up changes before the step. */
        syncBodiesWithScene();
        syncKinematicAndStaticFromSceneBeforeStep(clamped);
        syncDynamicTransformFromScene();
        syncDynamicVelocityFromScene();
        world.step(clamped, 8, 3);
        syncDynamicBodiesToScene();
        syncKinematicAndStaticFromSceneAfterStep();
      });
    });

    return { ...context, planck: api };
  };
}
